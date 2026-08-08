# Запуск Android-эмулятора + Metro (Expo Dev Client) для APN mobile.
# Двойной клик: scripts\dev-android.bat
# Флаги: -Build, -Docker, -DockerDown, -StopEmulator, -StopStack, -Avd, -NoMetro, -Clear, -MaestroSmoke
# Device: -ReleaseBuild, -ReleaseInstall, -DeviceMaestro, -EnsureSmokeUser
# API: -ApiTarget local|server  или  dev-android.bat api local|server|status
# DB: -DbBackup / -DbWipe / -DbRestore — цель = текущий API_TARGET (меню 11)

param(
    [switch]$Build,
    [switch]$Docker,
    [switch]$DockerDown,
    [switch]$StopEmulator,
    [switch]$StopStack,
    [switch]$NoMetro,
    [switch]$Clear,
    [switch]$MaestroSmoke,
    [switch]$ReleaseBuild,
    [switch]$ReleaseInstall,
    [switch]$DeviceMaestro,
    [switch]$EnsureSmokeUser,
    [switch]$DbBackup,
    [switch]$DbWipe,
    [switch]$DbRestore,
    [switch]$Force,
    [string]$BackupFile = '',
    [string]$LogFile = '',
    [string]$Avd = 'Pixel_9',
    [ValidateSet('local', 'server', 'status', '')]
    [string]$ApiTarget = '',
    [switch]$SetApiTarget
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'apps\mobile'
$apiTargetFile = Join-Path $PSScriptRoot 'api-target.env'
$appId = 'com.aipoker.notes'
$script:AdbSerial = $null

function Write-LogLine {
    param([string]$Message)
    if ($LogFile) {
        Add-Content -Path $LogFile -Value $Message -Encoding UTF8
    }
}

function Write-Step {
    param([string]$Message)
    Write-Host $Message
    Write-LogLine $Message
}

function New-MetroLaunchCmd {
    param(
        [string]$ApiUrl = '',
        [string]$NpmScript = 'npm run start:dev-client'
    )
    # cmd.exe — конкатенация, иначе `"$mobile`" ломает парсер PS 5.1
    $dir = $mobile
    if ($ApiUrl) {
        return 'cd /d "' + $dir + '" && set EXPO_PUBLIC_API_URL=' + $ApiUrl + ' && ' + $NpmScript
    }
    return 'cd /d "' + $dir + '" && set EXPO_PUBLIC_API_URL= && ' + $NpmScript
}

function Read-ApiTargetFile {
    $target = 'local'
    $serverUrl = ''
    if (Test-Path $apiTargetFile) {
        foreach ($line in Get-Content $apiTargetFile) {
            if ($line -match '^\s*#') { continue }
            if ($line -match '^\s*API_TARGET\s*=\s*(.+)\s*$') {
                $target = $Matches[1].Trim().ToLower()
            }
            if ($line -match '^\s*SERVER_API_URL\s*=\s*(.+)\s*$') {
                $serverUrl = $Matches[1].Trim()
            }
        }
    }
    if ($target -notin @('local', 'server')) { $target = 'local' }
    return @{ Target = $target; ServerUrl = $serverUrl }
}

function Resolve-ServerApiUrl {
    param([string]$ConfiguredUrl)
    if ($ConfiguredUrl) { return $ConfiguredUrl }
    # Public alpha: no private deploy env. Set SERVER_API_URL in scripts/api-target.env yourself.
    Write-Error 'SERVER_API_URL empty. For a remote API set it in scripts/api-target.env (API_TARGET=server).'
}

function Write-ApiTargetFile {
    param(
        [string]$Target,
        [string]$ServerUrl
    )
    @(
        '# API target for dev-android (Metro reads EXPO_PUBLIC_API_URL).',
        '# Values: local | server',
        "API_TARGET=$Target",
        '',
        '# Used when API_TARGET=server — set your own URL (no private defaults).',
        "SERVER_API_URL=$ServerUrl"
    ) | Set-Content -Path $apiTargetFile -Encoding UTF8
}

function Get-ApiRuntimeConfig {
    param(
        [switch]$ForceLocal
    )
    $cfg = Read-ApiTargetFile
    $target = if ($ApiTarget -and $ApiTarget -ne 'status') { $ApiTarget } else { $cfg.Target }
    if ($ForceLocal) { $target = 'local' }

    if ($target -eq 'server') {
        $url = Resolve-ServerApiUrl -ConfiguredUrl $cfg.ServerUrl
        return @{
            Target = 'server'
            Label = "SERVER $url"
            ExpoApiUrl = $url
            UseAdbReverseApi = $false
        }
    }

    return @{
        Target = 'local'
        Label = 'LOCAL (127.0.0.1:8000 + adb reverse)'
        ExpoApiUrl = 'http://127.0.0.1:8000'
        UseAdbReverseApi = $true
    }
}

function Read-EnvFileMap {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $map[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $map
}

function Get-PostgresDbConfig {
    # defaults из docker-compose; override из корневого .env
    $user = 'postgres'
    $password = 'postgres'
    $db = 'aipoker'
    $map = Read-EnvFileMap (Join-Path $root '.env')
    if ($map['POSTGRES_USER']) { $user = $map['POSTGRES_USER'] }
    if ($map['POSTGRES_PASSWORD']) { $password = $map['POSTGRES_PASSWORD'] }
    if ($map['POSTGRES_DB']) { $db = $map['POSTGRES_DB'] }
    return @{
        User = $user
        Password = $password
        Db = $db
        Container = 'apn-postgres'
        BackendContainer = 'apn-backend'
    }
}

function Get-ApnDeploySshConfig {
    Write-Error 'Remote SSH DB ops are not part of the public alpha. Use local Docker (API_TARGET=local).'
}

function Invoke-SshRemote {
    param(
        [hashtable]$Ssh,
        [string]$RemoteCommand,
        [switch]$AllocateTty,
        [switch]$AllowPasswordPrompt
    )
    $sshArgs = @(
        '-i', $Ssh.Key,
        '-p', $Ssh.Port,
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ConnectTimeout=20'
    )
    if (-not $AllowPasswordPrompt) {
        $sshArgs += @('-o', 'BatchMode=yes')
    }
    if ($AllocateTty) { $sshArgs = @('-t') + $sshArgs }
    $sshArgs += @(
        "$($Ssh.User)@$($Ssh.Host)",
        $RemoteCommand
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    if ($AllocateTty -or $AllowPasswordPrompt) {
        # прямой ssh без пайпа и без cmd /c — TTY для sudo, корректный exit code
        & ssh.exe @sshArgs
        $code = $LASTEXITCODE
        $ErrorActionPreference = $prev
        Write-Host ("  ssh exit code: {0}" -f $code) -ForegroundColor DarkGray
        return @{ ExitCode = $code; Output = @() }
    }
    $out = & ssh.exe @sshArgs 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return @{ ExitCode = $code; Output = $out }
}

function Get-RemoteDockerPrefix {
    param([hashtable]$Ssh)
    # внутри remote-скрипта всегда `docker`: non-root запускает скрипт через `sudo bash`
    return 'docker'
}

function Invoke-ScpToRemote {
    param(
        [hashtable]$Ssh,
        [string]$LocalPath,
        [string]$RemotePath
    )
    $scpArgs = @(
        '-i', $Ssh.Key,
        '-P', $Ssh.Port,
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ConnectTimeout=20',
        $LocalPath,
        "$($Ssh.User)@$($Ssh.Host):$RemotePath"
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & scp @scpArgs 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) { Write-Error "scp to remote failed: $code" }
}

function Invoke-ScpFromRemote {
    param(
        [hashtable]$Ssh,
        [string]$RemotePath,
        [string]$LocalPath
    )
    $scpArgs = @(
        '-i', $Ssh.Key,
        '-P', $Ssh.Port,
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ConnectTimeout=20',
        "$($Ssh.User)@$($Ssh.Host):$RemotePath",
        $LocalPath
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & scp @scpArgs 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) { Write-Error "scp from remote failed: $code ($RemotePath -> $LocalPath)" }
}

function Invoke-RemoteBashScript {
    param(
        [hashtable]$Ssh,
        [string]$ScriptBody,
        [string]$RemoteName
    )
    $localTmp = Join-Path $env:TEMP $RemoteName
    # LF для bash на Linux
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($localTmp, ($ScriptBody -replace "`r`n", "`n"), $utf8NoBom)

    $remotePath = "/tmp/$RemoteName"
    Write-Host "  upload $RemoteName ..." -ForegroundColor DarkGray
    Invoke-ScpToRemote -Ssh $Ssh -LocalPath $localTmp -RemotePath $remotePath
    Remove-Item $localTmp -Force -ErrorAction SilentlyContinue

    Write-Host ''
    if ($Ssh.User -ne 'root') {
        Write-Host '>>> Enter sudo password if asked (same as deploy.bat) <<<' -ForegroundColor Yellow
    }
    Write-Host ''
    # как deploy.bat: ssh -t ... "sudo bash /tmp/..."
    $run = if ($Ssh.User -eq 'root') {
        "bash $remotePath"
    } else {
        "sudo bash $remotePath"
    }
    $res = Invoke-SshRemote -Ssh $Ssh -RemoteCommand $run -AllocateTty -AllowPasswordPrompt
    Invoke-SshRemote -Ssh $Ssh -RemoteCommand "rm -f $remotePath" | Out-Null
    return $res
}

function Test-LocalPostgresReady {
    param([hashtable]$Pg)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker exec $Pg.Container pg_isready -U $Pg.User 2>&1 | Out-Null
    $ok = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $prev
    return $ok
}

function Ensure-LocalPostgresForDbOps {
    param([hashtable]$Pg)
    if (Test-LocalPostgresReady -Pg $Pg) { return }
    Write-Host 'Local postgres not ready - docker compose up -d...' -ForegroundColor Yellow
    Ensure-DockerDesktop
    Push-Location $root
    try {
        docker compose up -d
        if ($LASTEXITCODE -ne 0) { Write-Error "docker compose up failed: $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
    $deadline = (Get-Date).AddMinutes(2)
    while ((Get-Date) -lt $deadline) {
        if (Test-LocalPostgresReady -Pg $Pg) {
            Write-Host 'Local postgres ready.' -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    Write-Error "Container $($Pg.Container) not ready (pg_isready). Is Docker stack up?"
}

function New-DbBackupPath {
    param([string]$Scope)
    $dir = Join-Path $root 'artifacts\db-backups'
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    return Join-Path $dir "apn-$Scope-$stamp.sql"
}

function Invoke-LocalDbBackup {
    param([hashtable]$Pg)
    Ensure-LocalPostgresForDbOps -Pg $Pg
    $outFile = New-DbBackupPath -Scope 'local'
    Write-Host "Dumping $($Pg.Container)/$($Pg.Db) -> $outFile" -ForegroundColor Cyan
    # cmd redirect сохраняет байты pg_dump без PS encoding-сюрпризов
    $cmd = "docker exec $($Pg.Container) pg_dump -U $($Pg.User) --no-owner --no-acl $($Pg.Db) > `"$outFile`""
    cmd /c $cmd
    if ($LASTEXITCODE -ne 0) {
        if (Test-Path $outFile) { Remove-Item $outFile -Force -ErrorAction SilentlyContinue }
        Write-Error "pg_dump failed: $LASTEXITCODE"
    }
    $size = (Get-Item $outFile).Length
    if ($size -lt 50) { Write-Error "Backup looks empty ($size bytes): $outFile" }
    Write-Host "Backup OK ($size bytes): $outFile" -ForegroundColor Green
    return $outFile
}

function Invoke-ServerDbBackup {
    param([hashtable]$Pg)
    $ssh = Get-ApnDeploySshConfig
    $outFile = New-DbBackupPath -Scope 'server'
    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    $remoteTmp = "/tmp/apn-db-backup-$stamp.sql"
    $docker = Get-RemoteDockerPrefix -Ssh $ssh
    Write-Host "Remote dump $($ssh.User)@$($ssh.Host) -> $remoteTmp" -ForegroundColor Cyan

    $script = @"
#!/bin/bash
set -euo pipefail
echo "[apn] pg_dump $($Pg.Container)/$($Pg.Db) ..."
$docker exec $($Pg.Container) pg_dump -U $($Pg.User) --no-owner --no-acl $($Pg.Db) > $remoteTmp
chmod 644 $remoteTmp
ls -la $remoteTmp
echo "[apn] dump done"
"@
    $res = Invoke-RemoteBashScript -Ssh $ssh -ScriptBody $script -RemoteName "apn-db-backup-$stamp.sh"
    if ($res.ExitCode -ne 0) {
        Write-Error @"
Remote pg_dump failed ($($res.ExitCode)).
  User '$($ssh.User)' needs docker via sudo (like deploy.bat) or group docker / SSH_USER=root.
"@
    }
    Write-Host '  download dump via scp ...' -ForegroundColor DarkGray
    try {
        Invoke-ScpFromRemote -Ssh $ssh -RemotePath $remoteTmp -LocalPath $outFile
    } finally {
        Invoke-SshRemote -Ssh $ssh -RemoteCommand "rm -f $remoteTmp" | Out-Null
    }
    $size = (Get-Item $outFile).Length
    if ($size -lt 50) { Write-Error "Backup looks empty ($size bytes): $outFile" }
    Write-Host "Backup OK ($size bytes): $outFile" -ForegroundColor Green
    return $outFile
}

function Invoke-LocalDbWipe {
    param([hashtable]$Pg)
    Ensure-LocalPostgresForDbOps -Pg $Pg
    Write-Host "Wiping schema public on LOCAL $($Pg.Db)..." -ForegroundColor Yellow
    $sql = 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO ' + $Pg.User + ';'
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker exec $Pg.Container psql -U $Pg.User -d $Pg.Db -v ON_ERROR_STOP=1 -c $sql
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $prev
        Write-Error "Local DROP SCHEMA failed: $LASTEXITCODE"
    }
    Write-Host "Restarting $($Pg.BackendContainer) (alembic upgrade head)..." -ForegroundColor Cyan
    & docker restart $Pg.BackendContainer
    $ErrorActionPreference = $prev
    if ($LASTEXITCODE -ne 0) { Write-Error "docker restart $($Pg.BackendContainer) failed: $LASTEXITCODE" }
    $deadline = (Get-Date).AddMinutes(2)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) {
                Write-Host 'Local backend healthy after wipe.' -ForegroundColor Green
                return
            }
        } catch {
            # ждём
        }
        Start-Sleep -Seconds 2
    }
    Write-Host 'WARNING: wipe done but :8000/health not ready yet - check docker logs.' -ForegroundColor Yellow
}

function Invoke-ServerDbWipe {
    param([hashtable]$Pg)
    $ssh = Get-ApnDeploySshConfig
    $docker = Get-RemoteDockerPrefix -Ssh $ssh
    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    $pgUser = $Pg.User
    $pgDb = $Pg.Db
    $pgContainer = $Pg.Container
    $backend = $Pg.BackendContainer
    Write-Host "Wiping schema public on SERVER $($ssh.Host) /$pgDb..." -ForegroundColor Yellow

    # SQL через heredoc (без -c) — меньше сюрпризов с кавычками
    # Важно: $(seq ...) собираем так, чтобы PowerShell его не раскрыл
    $seqExpr = '$(seq 1 45)'
    $script = @"
#!/bin/bash
set -euo pipefail
echo "[apn] DROP SCHEMA public ..."
$docker exec -i $pgContainer psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1 <<'EOSQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO $pgUser;
EOSQL
echo "[apn] restart $backend (alembic) ..."
$docker restart $backend
echo "[apn] waiting for backend health inside container ..."
for i in $seqExpr; do
  if $docker exec $backend curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "[apn] backend health OK"
    exit 0
  fi
  sleep 2
done
echo "[apn] wipe SQL+restart done; health still warming up"
exit 0
"@
    $res = Invoke-RemoteBashScript -Ssh $ssh -ScriptBody $script -RemoteName "apn-db-wipe-$stamp.sh"
    Write-Host ("Wipe remote script finished, exit={0}" -f $res.ExitCode) -ForegroundColor Cyan
    if ($null -eq $res.ExitCode -or $res.ExitCode -ne 0) {
        Write-Error @"
Remote wipe failed ($($res.ExitCode)).
  User '$($ssh.User)' needs docker via sudo (or group docker / SSH_USER=root).
"@
    }
    Write-Host 'Waiting for remote /health...' -ForegroundColor Cyan
    $healthUrl = "http://$($ssh.Host):8000/health"
    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) {
                Write-Host "Server backend healthy: $healthUrl" -ForegroundColor Green
                return
            }
        } catch {
            # ждём
        }
        Start-Sleep -Seconds 3
    }
    Write-Host ("WARNING: wipe done but {0} not ready yet - check remote docker logs." -f $healthUrl) -ForegroundColor Yellow
}

function Confirm-DbWipe {
    param(
        [string]$TargetLabel,
        [switch]$ForceWipe
    )
    if ($ForceWipe) { return $true }
    Write-Host ''
    Write-Host '!!! FULL DATABASE WIPE !!!' -ForegroundColor Red
    Write-Host "Target: $TargetLabel" -ForegroundColor Red
    Write-Host 'This DROPS schema public (all tables/data), then restarts backend for alembic.' -ForegroundColor Yellow
    Write-Host 'Type WIPE to confirm (anything else = cancel):' -ForegroundColor Yellow
    $answer = Read-Host
    return ($answer -eq 'WIPE')
}

function Confirm-DbRestore {
    param(
        [string]$TargetLabel,
        [string]$DumpPath,
        [switch]$ForceRestore
    )
    if ($ForceRestore) { return $true }
    Write-Host ''
    Write-Host '!!! DATABASE RESTORE FROM BACKUP !!!' -ForegroundColor Red
    Write-Host "Target: $TargetLabel" -ForegroundColor Red
    Write-Host "Dump:   $DumpPath" -ForegroundColor Yellow
    Write-Host 'This DROPS current schema, then loads the SQL dump and restarts backend.' -ForegroundColor Yellow
    Write-Host 'Type RESTORE to confirm (anything else = cancel):' -ForegroundColor Yellow
    $answer = Read-Host
    return ($answer -eq 'RESTORE')
}

function Get-DbBackupDir {
    return (Join-Path $root 'artifacts\db-backups')
}

function Select-DbBackupFile {
    param(
        [string]$PreferredScope,
        [string]$ExplicitPath
    )
    if ($ExplicitPath) {
        if (-not (Test-Path -LiteralPath $ExplicitPath)) {
            Write-Error "Backup file not found: $ExplicitPath"
        }
        return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }

    $dir = Get-DbBackupDir
    if (-not (Test-Path $dir)) {
        Write-Error "No backups folder: $dir. Run menu 11 -> 5 (Backup) first."
    }
    $all = @(Get-ChildItem -LiteralPath $dir -Filter '*.sql' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending)
    if ($all.Count -eq 0) {
        Write-Error "No .sql dumps in $dir. Run menu 11 -> 5 (Backup) first."
    }

    $preferred = @($all | Where-Object { $_.Name -like "apn-$PreferredScope-*" })
    $list = if ($preferred.Count -gt 0) { $preferred } else { $all }
    $list = @($list | Select-Object -First 15)

    Write-Host ''
    if ($preferred.Count -gt 0) {
        Write-Host "Dumps for scope '$PreferredScope' (newest first):" -ForegroundColor Cyan
    } else {
        Write-Host "No apn-$PreferredScope-*.sql - showing all dumps:" -ForegroundColor Yellow
    }
    for ($i = 0; $i -lt $list.Count; $i++) {
        $f = $list[$i]
        $kb = [math]::Round($f.Length / 1KB, 1)
        Write-Host ("  [{0,2}] {1}  ({2} KB, {3:yyyy-MM-dd HH:mm})" -f ($i + 1), $f.Name, $kb, $f.LastWriteTime)
    }
    Write-Host '  [ P] Enter full path to .sql'
    Write-Host '  [ 0] Cancel'
    $choice = Read-Host 'Choose'
    if ($choice -eq '0' -or [string]::IsNullOrWhiteSpace($choice)) {
        return $null
    }
    if ($choice -match '^[Pp]$') {
        $path = Read-Host 'Full path to .sql'
        if (-not $path -or -not (Test-Path -LiteralPath $path)) {
            Write-Error "File not found: $path"
        }
        return (Resolve-Path -LiteralPath $path).Path
    }
    $n = 0
    if (-not [int]::TryParse($choice, [ref]$n) -or $n -lt 1 -or $n -gt $list.Count) {
        Write-Error "Invalid choice: $choice"
    }
    return $list[$n - 1].FullName
}

function Wait-LocalBackendHealth {
    param([int]$TimeoutSec = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) {
                Write-Host 'Local backend healthy.' -ForegroundColor Green
                return $true
            }
        } catch {
            # wait
        }
        Start-Sleep -Seconds 2
    }
    Write-Host 'WARNING: :8000/health not ready yet - check docker logs.' -ForegroundColor Yellow
    return $false
}

function Wait-ServerBackendHealth {
    param(
        [hashtable]$Ssh,
        [int]$TimeoutSec = 180
    )
    $healthUrl = "http://$($Ssh.Host):8000/health"
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) {
                Write-Host "Server backend healthy: $healthUrl" -ForegroundColor Green
                return $true
            }
        } catch {
            # wait
        }
        Start-Sleep -Seconds 3
    }
    Write-Host ("WARNING: {0} not ready yet - check remote docker logs." -f $healthUrl) -ForegroundColor Yellow
    return $false
}

function Invoke-LocalDbRestore {
    param(
        [hashtable]$Pg,
        [string]$DumpPath
    )
    Ensure-LocalPostgresForDbOps -Pg $Pg
    Write-Host "Restoring LOCAL $($Pg.Db) from:" -ForegroundColor Yellow
    Write-Host "  $DumpPath"
    $sql = 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO ' + $Pg.User + ';'
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker exec $Pg.Container psql -U $Pg.User -d $Pg.Db -v ON_ERROR_STOP=1 -c $sql
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $prev
        Write-Error "Local DROP SCHEMA before restore failed: $LASTEXITCODE"
    }
    # plain SQL dump via stdin
    $cmd = "docker exec -i $($Pg.Container) psql -U $($Pg.User) -d $($Pg.Db) -v ON_ERROR_STOP=1 < `"$DumpPath`""
    cmd /c $cmd
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $prev
        Write-Error "Local psql restore failed: $LASTEXITCODE"
    }
    Write-Host "Restarting $($Pg.BackendContainer)..." -ForegroundColor Cyan
    & docker restart $Pg.BackendContainer
    $ErrorActionPreference = $prev
    if ($LASTEXITCODE -ne 0) { Write-Error "docker restart $($Pg.BackendContainer) failed: $LASTEXITCODE" }
    Wait-LocalBackendHealth | Out-Null
}

function Invoke-ServerDbRestore {
    param(
        [hashtable]$Pg,
        [string]$DumpPath
    )
    $ssh = Get-ApnDeploySshConfig
    $docker = Get-RemoteDockerPrefix -Ssh $ssh
    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    $remoteSql = "/tmp/apn-db-restore-$stamp.sql"
    $pgUser = $Pg.User
    $pgDb = $Pg.Db
    $pgContainer = $Pg.Container
    $backend = $Pg.BackendContainer

    Write-Host "Restoring SERVER $($ssh.Host)/$pgDb from:" -ForegroundColor Yellow
    Write-Host "  $DumpPath"
    Write-Host "  upload dump -> $remoteSql ..." -ForegroundColor DarkGray
    Invoke-ScpToRemote -Ssh $ssh -LocalPath $DumpPath -RemotePath $remoteSql

    $seqExpr = '$(seq 1 45)'
    $script = @"
#!/bin/bash
set -euo pipefail
echo "[apn] DROP SCHEMA public ..."
$docker exec -i $pgContainer psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1 <<'EOSQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO $pgUser;
EOSQL
echo "[apn] psql restore from $remoteSql ..."
$docker exec -i $pgContainer psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1 < $remoteSql
echo "[apn] restart $backend ..."
$docker restart $backend
echo "[apn] waiting for backend health ..."
for i in $seqExpr; do
  if $docker exec $backend curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "[apn] backend health OK"
    exit 0
  fi
  sleep 2
done
echo "[apn] restore done; health still warming up"
exit 0
"@
    try {
        $res = Invoke-RemoteBashScript -Ssh $ssh -ScriptBody $script -RemoteName "apn-db-restore-$stamp.sh"
        Write-Host ("Restore remote script finished, exit={0}" -f $res.ExitCode) -ForegroundColor Cyan
        if ($null -eq $res.ExitCode -or $res.ExitCode -ne 0) {
            Write-Error "Remote restore failed ($($res.ExitCode))."
        }
    } finally {
        Invoke-SshRemote -Ssh $ssh -RemoteCommand "rm -f $remoteSql" | Out-Null
    }
    Wait-ServerBackendHealth -Ssh $ssh | Out-Null
}

function Invoke-DbBackupWorkflow {
    $runtime = Get-ApiRuntimeConfig
    $pg = Get-PostgresDbConfig
    Write-Host ''
    Write-Host '=== APN DB backup ===' -ForegroundColor Cyan
    Write-Host "API target: $($runtime.Label)"
    Write-Host "DB: $($pg.Db)  container: $($pg.Container)"
    Write-Host ''
    if ($runtime.Target -eq 'server') {
        Invoke-ServerDbBackup -Pg $pg | Out-Null
    } else {
        Invoke-LocalDbBackup -Pg $pg | Out-Null
    }
}

function Invoke-DbWipeWorkflow {
    param([switch]$ForceWipe)
    $runtime = Get-ApiRuntimeConfig
    $pg = Get-PostgresDbConfig
    Write-Host ''
    Write-Host '=== APN DB wipe ===' -ForegroundColor Cyan
    Write-Host "API target: $($runtime.Label)"
    Write-Host "DB: $($pg.Db)  container: $($pg.Container)"
    if (-not (Confirm-DbWipe -TargetLabel $runtime.Label -ForceWipe:$ForceWipe)) {
        Write-Host 'Cancelled.' -ForegroundColor Yellow
        exit 0
    }
    # авто-бэкап перед wipe - безопаснее, чем жалеть потом
    Write-Host 'Auto-backup before wipe...' -ForegroundColor Cyan
    if ($runtime.Target -eq 'server') {
        Invoke-ServerDbBackup -Pg $pg | Out-Null
        Invoke-ServerDbWipe -Pg $pg
    } else {
        Invoke-LocalDbBackup -Pg $pg | Out-Null
        Invoke-LocalDbWipe -Pg $pg
    }
    Write-Host 'Wipe complete. Smoke user: menu 11 -> 4 (ensure-smoke-user).' -ForegroundColor Green
}

function Invoke-DbRestoreWorkflow {
    param(
        [switch]$ForceRestore,
        [string]$DumpPath
    )
    $runtime = Get-ApiRuntimeConfig
    $pg = Get-PostgresDbConfig
    Write-Host ''
    Write-Host '=== APN DB restore ===' -ForegroundColor Cyan
    Write-Host "API target: $($runtime.Label)"
    Write-Host "DB: $($pg.Db)  container: $($pg.Container)"

    $selected = Select-DbBackupFile -PreferredScope $runtime.Target -ExplicitPath $DumpPath
    if (-not $selected) {
        Write-Host 'Cancelled.' -ForegroundColor Yellow
        exit 0
    }
    if (-not (Confirm-DbRestore -TargetLabel $runtime.Label -DumpPath $selected -ForceRestore:$ForceRestore)) {
        Write-Host 'Cancelled.' -ForegroundColor Yellow
        exit 0
    }

    Write-Host 'Auto-backup before restore...' -ForegroundColor Cyan
    if ($runtime.Target -eq 'server') {
        Invoke-ServerDbBackup -Pg $pg | Out-Null
        Invoke-ServerDbRestore -Pg $pg -DumpPath $selected
    } else {
        Invoke-LocalDbBackup -Pg $pg | Out-Null
        Invoke-LocalDbRestore -Pg $pg -DumpPath $selected
    }
    Write-Host "Restore complete from: $selected" -ForegroundColor Green
}

if ($SetApiTarget) {
    if (-not $ApiTarget) {
        Write-Error 'Use: dev-android.bat api local|server|status'
    }
    if ($ApiTarget -eq 'status') {
        $cfg = Read-ApiTargetFile
        $runtime = Get-ApiRuntimeConfig
        Write-Host "API_TARGET=$($cfg.Target)"
        Write-Host "Resolved=$($runtime.Label)"
        exit 0
    }
    $cfg = Read-ApiTargetFile
    Write-ApiTargetFile -Target $ApiTarget -ServerUrl $cfg.ServerUrl
    $runtime = Get-ApiRuntimeConfig
    Write-Host "API target set: $($runtime.Label)" -ForegroundColor Green
    exit 0
}

$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$emulator = Join-Path $sdk 'emulator\emulator.exe'

$apiRuntime = Get-ApiRuntimeConfig -ForceLocal:(
    $MaestroSmoke.IsPresent
)
if ($MaestroSmoke -and (Read-ApiTargetFile).Target -eq 'server') {
    Write-Host 'Maestro smoke: forcing LOCAL API (server target ignored for E2E).' -ForegroundColor Yellow
}

if ($MaestroSmoke) {
    $Build = $true
    $NoMetro = $false
}

# --- Stop helpers (меню 7): docker / emulator / Metro ---
function Stop-ApnDockerCompose {
    Write-Host '=== Docker compose down ===' -ForegroundColor Cyan
    Push-Location $root
    try {
        docker compose down
        if ($LASTEXITCODE -ne 0) {
            Write-Host "WARNING: docker compose down exit $LASTEXITCODE (maybe already stopped)." -ForegroundColor Yellow
        } else {
            Write-Host 'Docker stack stopped.' -ForegroundColor Green
        }
    } finally {
        Pop-Location
    }
}

function Stop-ApnEmulators {
    Write-Host '=== Stop Android emulator(s) ===' -ForegroundColor Cyan
    if (-not (Test-Path $adb)) {
        Write-Host "adb not found: $adb - skip graceful emu kill" -ForegroundColor Yellow
    } else {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $adb start-server 2>&1 | Out-Null
        $raw = & $adb devices 2>&1 | ForEach-Object { "$_" }
        $ErrorActionPreference = $prev
        $killed = 0
        foreach ($line in $raw) {
            if ($line -match '^(emulator-\d+)\s+') {
                $serial = $Matches[1]
                Write-Host "  adb -s $serial emu kill"
                $ErrorActionPreference = 'Continue'
                & $adb -s $serial emu kill 2>&1 | Out-Null
                $ErrorActionPreference = $prev
                $killed++
            }
        }
        if ($killed -eq 0) {
            Write-Host '  no emulator-* in adb devices' -ForegroundColor DarkGray
        }
    }

    # leftover qemu / emulator.exe (не трогаем Docker Desktop)
    $names = @('emulator', 'qemu-system-x86_64', 'qemu-system-aarch64')
    foreach ($n in $names) {
        $procs = @(Get-Process -Name $n -ErrorAction SilentlyContinue)
        foreach ($p in $procs) {
            try {
                Write-Host ("  Stop-Process {0} pid={1}" -f $p.ProcessName, $p.Id)
                Stop-Process -Id $p.Id -Force -ErrorAction Stop
            } catch {
                Write-Host ("  skip pid {0}: {1}" -f $p.Id, $_.Exception.Message) -ForegroundColor DarkGray
            }
        }
    }
    Write-Host 'Emulator stop done.' -ForegroundColor Green
}

function Stop-ApnDevProcesses {
    Write-Host '=== Stop APN Metro / Expo node windows ===' -ForegroundColor Cyan
    # Metro стартует как cmd /k в apps\mobile - ищем по CommandLine
    $needles = @(
        [regex]::Escape((Join-Path $mobile '')),
        'start:dev-client',
        'expo start',
        'react-native.*metro'
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $cl = $_.CommandLine
            if (-not $cl) { return $false }
            # не трогаем сам stop-скрипт / текущий powershell
            if ($cl -match 'dev-android\.(ps1|bat)') { return $false }
            foreach ($n in $needles) {
                if ($cl -match $n) { return $true }
            }
            return $false
        })
    $ErrorActionPreference = $prev

    if ($procs.Count -eq 0) {
        Write-Host '  no matching Metro/Expo processes' -ForegroundColor DarkGray
        Write-Host 'Dev process stop done.' -ForegroundColor Green
        return
    }

    foreach ($p in $procs) {
        try {
            $short = if ($p.CommandLine.Length -gt 90) { $p.CommandLine.Substring(0, 90) + '...' } else { $p.CommandLine }
            Write-Host ("  kill pid={0} {1}" -f $p.ProcessId, $p.Name)
            Write-Host ("    {0}" -f $short) -ForegroundColor DarkGray
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        } catch {
            Write-Host ("  skip pid {0}: {1}" -f $p.ProcessId, $_.Exception.Message) -ForegroundColor DarkGray
        }
    }
    Write-Host 'Dev process stop done.' -ForegroundColor Green
}

function Invoke-StopApnStack {
    Write-Host ''
    Write-Host '=== APN full local stack stop ===' -ForegroundColor Cyan
    Stop-ApnDockerCompose
    Stop-ApnEmulators
    Stop-ApnDevProcesses
    Write-Host 'Full local stack stop complete.' -ForegroundColor Green
}

# Только остановка (меню 7) - без эмулятора/Metro start
if ($StopStack) {
    Invoke-StopApnStack
    exit 0
}
if ($StopEmulator) {
    Write-Host ''
    Stop-ApnEmulators
    exit 0
}
if ($DockerDown) {
    if ($Docker) {
        Write-Host 'Both -Docker and -DockerDown: stopping stack (-DockerDown wins).' -ForegroundColor Yellow
    }
    Write-Host ''
    Stop-ApnDockerCompose
    exit 0
}

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AdbArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $all = @()
    if ($script:AdbSerial) { $all += @('-s', $script:AdbSerial) }
    $all += $AdbArgs
    $out = & $adb @all 2>&1 | ForEach-Object { "$_" }
    $ErrorActionPreference = $prev
    return $out
}

function Get-EmulatorSerial {
    # только emulator-XXXX в состоянии device (телефон unauthorized не считаем)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $adb start-server 2>&1 | Out-Null
    $raw = & $adb devices 2>&1 | ForEach-Object { "$_" }
    $ErrorActionPreference = $prev
    foreach ($line in $raw) {
        if ($line -match '^(emulator-\d+)\s+device\s*$') {
            return $Matches[1]
        }
    }
    return $null
}

function Get-PhysicalDeviceSerial {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $adb start-server 2>&1 | Out-Null
    $raw = & $adb devices -l 2>&1 | ForEach-Object { "$_" }
    $ErrorActionPreference = $prev
    foreach ($line in $raw) {
        if ($line -match '^(\S+)\s+device\s') {
            $serial = $Matches[1]
            if ($serial -notmatch '^emulator-') {
                return $serial
            }
        }
    }
    return $null
}

function Initialize-AndroidBuildEnv {
    $javaHome = 'C:\Program Files\Android\Android Studio\jbr'
    if (-not (Test-Path $javaHome)) {
        Write-Error "JAVA_HOME jbr not found: $javaHome"
    }
    if (-not (Test-Path $sdk)) {
        Write-Error "Android SDK not found: $sdk"
    }
    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $sdk
    $env:ANDROID_SDK_ROOT = $sdk
    if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = 'C:\g' }
    $env:Path = "$(Join-Path $sdk 'platform-tools');$(Join-Path $sdk 'cmdline-tools\latest\bin');$env:Path"

    $androidDir = Join-Path $mobile 'android'
    if (-not (Test-Path (Join-Path $androidDir 'gradlew.bat'))) {
        Write-Host 'android/ missing — expo prebuild...'
        Push-Location $mobile
        try {
            npx expo prebuild --platform android --no-install
            if ($LASTEXITCODE -ne 0) { Write-Error "expo prebuild failed: $LASTEXITCODE" }
        } finally {
            Pop-Location
        }
    }

    $sdkDirProp = ($sdk -replace '\\', '/')
    Set-Content -Path (Join-Path $androidDir 'local.properties') -Value "sdk.dir=$sdkDirProp" -Encoding ASCII
    return $androidDir
}

function Set-GradleArchitectures {
    param(
        [string]$AndroidDir,
        [string]$Arch
    )
    $gradleProps = Join-Path $AndroidDir 'gradle.properties'
    $gp = Get-Content $gradleProps
    $found = $false
    $gp = $gp | ForEach-Object {
        if ($_ -match '^reactNativeArchitectures=') {
            $found = $true
            "reactNativeArchitectures=$Arch"
        } else {
            $_
        }
    }
    if (-not $found) { $gp += "reactNativeArchitectures=$Arch" }
    Set-Content -Path $gradleProps -Value $gp
}

function Invoke-DebugApkBuild {
    param(
        [string]$Arch = 'arm64-v8a',
        [string]$ApiUrl = '',
        [switch]$Install
    )

    $androidDir = Initialize-AndroidBuildEnv
    Set-GradleArchitectures -AndroidDir $androidDir -Arch $Arch

    if ($ApiUrl) {
        $env:EXPO_PUBLIC_API_URL = $ApiUrl
        Write-Host "EXPO_PUBLIC_API_URL=$ApiUrl (embed in APK bundle)"
    } else {
        Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
    }

    Write-Host "Building debug APK ($Arch)..."
    Push-Location $androidDir
    try {
        & .\gradlew.bat app:assembleDebug "-PreactNativeArchitectures=$Arch"
        if ($LASTEXITCODE -ne 0) { Write-Error "gradlew failed: $LASTEXITCODE" }
        $apk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
        if (-not (Test-Path $apk)) { Write-Error "APK not found: $apk" }
        if ($Install) {
            if (-not $script:AdbSerial) {
                Write-Error 'No target device serial for install'
            }
            $installOut = (Invoke-Adb install -r $apk) -join "`n"
            if ($installOut -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match') {
                Write-Host 'Signature conflict (release vs debug) — uninstalling old APK...' -ForegroundColor Yellow
                Invoke-Adb uninstall $appId | Out-Null
                $installOut = (Invoke-Adb install -r $apk) -join "`n"
            }
            if ($installOut -notmatch 'Success') {
                Write-Host $installOut
                Write-Error 'adb install failed'
            }
            Write-Host "Installed $appId on $($script:AdbSerial)" -ForegroundColor Green
        } else {
            Write-Host "APK: $apk"
        }
        return $apk
    } finally {
        Pop-Location
    }
}

function Invoke-ReleaseApkPipeline {
    param([switch]$InstallOnDevice)

    $buildScript = Join-Path $PSScriptRoot 'build-release-apk.ps1'
    if (-not (Test-Path $buildScript)) {
        Write-Error "Release build script not found: $buildScript"
    }

    $buildApi = Get-ApiRuntimeConfig
    Write-Host ''
    Write-Host '=== APN Release APK build ===' -ForegroundColor Cyan
    Write-Host "  API: $($buildApi.Label)"
    & $buildScript -ApiUrl $buildApi.ExpoApiUrl
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    if (-not $InstallOnDevice) {
        exit 0
    }

    $script:AdbSerial = Get-PhysicalDeviceSerial
    if (-not $script:AdbSerial) {
        Write-Error 'USB device not found. Enable USB debugging and connect phone.'
    }

    $apk = Join-Path $root 'dist\apn-mvp-release-latest.apk'
    if (-not (Test-Path $apk)) {
        Write-Error "Release APK not found: $apk"
    }

    Write-Host "Installing on device $($script:AdbSerial)..."
    Invoke-Adb install -r $apk | Out-Host
    Write-Host "Release APK installed on $($script:AdbSerial)" -ForegroundColor Green
    exit 0
}

function Ensure-ApkInstalled {
    $pkg = (Invoke-Adb shell pm path $appId) -join ''
    if ($pkg -notmatch 'package:') {
        Write-Error @"
APK $appId not installed on $($script:AdbSerial).
  Build + install release APK first (menu 12+13 or CLI release-install):
    scripts\dev-android.bat 13
  API endpoint is baked in at build time — set target via menu 11.
"@
    }
    Write-Step "APK installed: $appId"
}

function Invoke-EnsureSmokeUser {
    param([string]$ApiUrl)

    $ensureScript = Join-Path $PSScriptRoot 'ensure-smoke-user.ps1'
    if (-not (Test-Path $ensureScript)) {
        Write-Error "ensure-smoke-user.ps1 not found"
    }
    Write-Step "Ensure smoke user @ $ApiUrl"
    & $ensureScript -ApiUrl $ApiUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Error "ensure-smoke-user failed: $LASTEXITCODE"
    }
}

function Invoke-DeviceMaestroWorkflow {
    try {
        if (-not (Test-Path $adb)) {
            Write-Error "adb not found: $adb"
        }

        $script:AdbSerial = Get-PhysicalDeviceSerial
        if (-not $script:AdbSerial) {
            Write-Error @'
USB device not found (adb devices).
  1. Connect phone via USB
  2. Enable USB debugging
  3. Accept RSA fingerprint on phone
'@
        }

        $apiRuntime = Get-ApiRuntimeConfig

        Write-Step ''
        Write-Step '=== APN USB Maestro (standalone APK) ==='
        Write-Step "Device: $($script:AdbSerial)"
        Write-Step 'Mode: ensure user + Maestro (no Metro, no build)'
        Write-Step "API target: $($apiRuntime.Label)"
        Write-Step 'APK must match API (build via menu 12/13 after setting menu 11)'
        Write-Step ''

        if ($apiRuntime.UseAdbReverseApi) {
            Ensure-BackendForSmoke
        } else {
            Ensure-RemoteApiForSmoke -ApiUrl $apiRuntime.ExpoApiUrl
        }

        Invoke-EnsureSmokeUser -ApiUrl $apiRuntime.ExpoApiUrl
        Ensure-ApkInstalled

        if ($apiRuntime.UseAdbReverseApi) {
            Invoke-Adb reverse tcp:8000 tcp:8000 | Out-Null
            Write-Step "adb reverse on $($script:AdbSerial): 8000 (local API in APK)"
        }

        Write-Step 'Maestro smoke-standalone.yaml on USB device...'
        return (Invoke-MaestroSmoke -ExitAfter:$false -Standalone)
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-LogLine "ERROR: $($_.Exception.Message)"
        return 1
    }
}

function Ensure-RemoteApiForSmoke {
    param([string]$ApiUrl)
    try {
        $health = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing -TimeoutSec 8
        Write-Host "Remote API OK ($($health.StatusCode)): $ApiUrl"
        return
    } catch {
        Write-Error "Remote API not responding: $ApiUrl — check SERVER_API_URL in scripts/api-target.env and network access"
    }
}

function Wait-ForMetro {
    param([int]$Port = 8081, [int]$TimeoutSec = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    Write-Host "Waiting for Metro on :$Port ..."
    do {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $iar = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
            $ok = $iar.AsyncWaitHandle.WaitOne(2000, $false)
            if ($ok -and $tcp.Connected) {
                $tcp.Close()
                Write-Host "Metro ready on :$Port"
                return
            }
            $tcp.Close()
        } catch {
            # still starting
        }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    Write-Error "Metro did not start on :$Port within ${TimeoutSec}s"
}

function Invoke-MaestroSmoke {
    param(
        [switch]$ExitAfter = $true,
        [switch]$Standalone
    )

    $maestroScript = Join-Path $root 'scripts\maestro-test.ps1'
    $flowName = if ($Standalone) { 'smoke-standalone.yaml' } else { 'smoke.yaml' }
    $flow = Join-Path $root ".maestro\$flowName"
    if (-not (Test-Path $maestroScript)) {
        Write-Error "Maestro script not found: $maestroScript"
    }
    if (-not (Test-Path $flow)) {
        Write-Error "Flow not found: $flow"
    }

    if (-not $Standalone) {
        Write-Host 'Launching dev-client (Metro deep link localhost:8081)...'
        $deepLink = 'exp+ai-poker-notes://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
        Invoke-Adb @('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', $deepLink) | Out-Null
        Start-Sleep -Seconds 8
    }

    Write-Host ''
    Write-Host "=== Maestro $flowName ===" -ForegroundColor Cyan
    $env:APN_ADB_SERIAL = $script:AdbSerial
    if ($Standalone) {
        & $maestroScript $flow -Standalone
    } else {
        & $maestroScript $flow
    }
    $code = $LASTEXITCODE
    Remove-Item Env:APN_ADB_SERIAL -ErrorAction SilentlyContinue

    if ($code -eq 0) {
        Write-Host ''
        Write-Host 'Maestro smoke: PASS' -ForegroundColor Green
    } else {
        Write-Host ''
        Write-Host "Maestro smoke: FAIL (exit $code)" -ForegroundColor Red
        Write-Host "Debug: $env:USERPROFILE\.maestro\tests\"
    }

    if ($ExitAfter) {
        exit $code
    }
    return $code
}

function Wait-ForEmulatorSerial {
    param([datetime]$Deadline)
    do {
        $serial = Get-EmulatorSerial
        if ($serial) { return $serial }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $Deadline)
    return $null
}

function Test-DockerEngineReady {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & docker info 2>$null | Out-Null
    $ok = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $prev
    return $ok
}

function Ensure-DockerDesktop {
    if (Test-DockerEngineReady) {
        Write-Host 'Docker engine OK.'
        return
    }

    $desktopExe = @(
        (Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe')
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

    if (-not $desktopExe) {
        Write-Error 'Docker engine down and Docker Desktop.exe not found. Start Docker Desktop manually or install it.'
    }

    Write-Host 'Docker engine not running — starting Docker Desktop...' -ForegroundColor Yellow
    Start-Process -FilePath $desktopExe | Out-Null

    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 3
        if (Test-DockerEngineReady) {
            Write-Host 'Docker engine ready.' -ForegroundColor Green
            return
        }
    } while ((Get-Date) -lt $deadline)

    Write-Error 'Docker Desktop started but engine did not become ready within 3 minutes.'
}

function Ensure-BackendForSmoke {
    try {
        $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -UseBasicParsing -TimeoutSec 2
        Write-Host "API :8000 OK ($($health.StatusCode))"
        return
    } catch {
        Write-Host 'API :8000 down — starting docker compose for Maestro smoke...' -ForegroundColor Yellow
    }
    Push-Location $root
    try {
        Ensure-DockerDesktop
        docker compose up -d
        if ($LASTEXITCODE -ne 0) { Write-Error "docker compose up failed: $LASTEXITCODE" }
        $deadline = (Get-Date).AddMinutes(2)
        do {
            try {
                $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -UseBasicParsing -TimeoutSec 2
                Write-Host "API :8000 OK ($($health.StatusCode))"
                return
            } catch {
                Start-Sleep -Seconds 3
            }
        } while ((Get-Date) -lt $deadline)
        Write-Error 'Backend :8000 still not responding after docker compose up'
    } finally {
        Pop-Location
    }
}

# --- Ранний выход: release / USB device (функции выше уже объявлены) ---
if ($ReleaseBuild) {
    Invoke-ReleaseApkPipeline
}
if ($ReleaseInstall) {
    Invoke-ReleaseApkPipeline -InstallOnDevice
}
if ($EnsureSmokeUser) {
    $api = Get-ApiRuntimeConfig
    if ($api.UseAdbReverseApi) { Ensure-BackendForSmoke }
    else { Ensure-RemoteApiForSmoke -ApiUrl $api.ExpoApiUrl }
    Invoke-EnsureSmokeUser -ApiUrl $api.ExpoApiUrl
    exit 0
}
if ($DbBackup) {
    Invoke-DbBackupWorkflow
    exit 0
}
if ($DbWipe) {
    Invoke-DbWipeWorkflow -ForceWipe:$Force
    exit 0
}
if ($DbRestore) {
    Invoke-DbRestoreWorkflow -ForceRestore:$Force -DumpPath $BackupFile
    exit 0
}
if ($DeviceMaestro) {
    if ($LogFile) {
        Set-Content -Path $LogFile -Value "=== APN device-maestro $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" -Encoding UTF8
        Write-Step "Log file: $LogFile"
    }
    $code = Invoke-DeviceMaestroWorkflow
    exit $code
}

if (-not (Test-Path $adb)) {
    Write-Error "adb not found: $adb"
}
if (-not (Test-Path $emulator)) {
    Write-Error "emulator not found: $emulator"
}

Write-Host ''
if ($MaestroSmoke) {
    Write-Host '=== APN Build + Maestro smoke ===' -ForegroundColor Cyan
} else {
    Write-Host '=== APN Mobile Dev (Android) ===' -ForegroundColor Cyan
}
Write-Host "AVD: $Avd"
Write-Host "API: $($apiRuntime.Label)" -ForegroundColor Cyan
Write-Host ''

$stepTotal = if ($MaestroSmoke) { 5 } else { 4 }

# --- 1) Emulator ---
Write-Host "[1/$stepTotal] Emulator..."
$script:AdbSerial = Get-EmulatorSerial
if (-not $script:AdbSerial) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $avds = @(& $emulator -list-avds 2>&1 | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
    $ErrorActionPreference = $prev
    if (-not ($avds -contains $Avd)) {
        Write-Host 'Available AVDs:'
        $avds | ForEach-Object { Write-Host "  - $_" }
        Write-Error "AVD '$Avd' not found. Pass -Avd NAME"
    }
    Write-Host "Starting $Avd ..."
    Start-Process -FilePath $emulator -ArgumentList @('-avd', $Avd, '-netdelay', 'none', '-netspeed', 'full')

    $deadline = (Get-Date).AddMinutes(3)
    $script:AdbSerial = Wait-ForEmulatorSerial -Deadline $deadline
    if (-not $script:AdbSerial) {
        Write-Error 'No emulator-* device appeared (waited 3 min). Check AVD / USB phone conflict.'
    }

    $booted = ''
    do {
        $booted = ((Invoke-Adb shell getprop sys.boot_completed) -join '').Trim()
        if ($booted -eq '1') { break }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    if ($booted -ne '1') {
        Write-Error "Emulator $($script:AdbSerial) did not finish booting in time"
    }
    Write-Host "Emulator ready: $($script:AdbSerial)"
} else {
    Write-Host "Already running: $($script:AdbSerial)"
}

# --- 2) Docker (optional) ---
Write-Host "[2/$stepTotal] Backend..."
if ($MaestroSmoke) {
    Ensure-BackendForSmoke
} elseif ($Docker) {
    if ($apiRuntime.Target -eq 'server') {
        Write-Host 'API target is SERVER — skipping local docker compose.' -ForegroundColor Yellow
    } else {
        Push-Location $root
        try {
            Ensure-DockerDesktop
            docker compose up -d
            Write-Host 'docker compose up -d done.'
        } finally {
            Pop-Location
        }
    }
} else {
    if ($apiRuntime.Target -eq 'server') {
        try {
            $health = Invoke-WebRequest -Uri "$($apiRuntime.ExpoApiUrl)/health" -UseBasicParsing -TimeoutSec 5
            Write-Host "Remote API OK ($($health.StatusCode)): $($apiRuntime.ExpoApiUrl)"
        } catch {
            Write-Host "Remote API not responding: $($apiRuntime.ExpoApiUrl)" -ForegroundColor Yellow
        }
    } else {
        try {
            $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -UseBasicParsing -TimeoutSec 2
            Write-Host "API :8000 OK ($($health.StatusCode))"
        } catch {
            Write-Host 'API :8000 not responding. Run: npm run docker:up   (or pass -Docker)' -ForegroundColor Yellow
        }
    }
}

# --- 3) adb reverse + optional APK ---
Write-Host "[3/$stepTotal] adb reverse + APK..."
if ($apiRuntime.UseAdbReverseApi) {
    Invoke-Adb reverse tcp:8000 tcp:8000 | Out-Null
    Write-Host "reverse on $($script:AdbSerial): 8000, 8081"
} else {
    Write-Host "reverse on $($script:AdbSerial): 8081 only (API -> server)"
}
Invoke-Adb reverse tcp:8081 tcp:8081 | Out-Null

if ($Build) {
    $androidDir = Initialize-AndroidBuildEnv
    Set-GradleArchitectures -AndroidDir $androidDir -Arch 'x86_64'

    Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
    Write-Host 'Building debug APK (x86_64)...'
    Push-Location $androidDir
    try {
        & .\gradlew.bat app:assembleDebug '-PreactNativeArchitectures=x86_64'
        if ($LASTEXITCODE -ne 0) { Write-Error "gradlew failed: $LASTEXITCODE" }
        $apk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
        Invoke-Adb install -r $apk | Out-Host
        Write-Host "Installed $appId"
    } finally {
        Pop-Location
    }
} else {
    $pkg = (Invoke-Adb shell pm path $appId) -join ''
    if ($pkg -notmatch 'package:') {
        Write-Host "APK $appId not installed. Pass -Build or install manually." -ForegroundColor Yellow
    } else {
        Write-Host "APK present: $appId"
    }
}

# --- 4) Metro ---
Write-Host "[4/$stepTotal] Metro..."
if ($NoMetro) {
    Write-Host 'Skipped (-NoMetro).'
    Write-Host ''
    Write-Host 'Done.'
    exit 0
}

if (-not (Test-Path $mobile)) {
    Write-Error "mobile app not found: $mobile"
}

$metroNpm = if ($Clear) { 'npm run start:dev-client:clear' } else { 'npm run start:dev-client' }
if ($apiRuntime.ExpoApiUrl) {
    $metroCmd = New-MetroLaunchCmd -ApiUrl $apiRuntime.ExpoApiUrl -NpmScript $metroNpm
    Write-Host "Metro API: $($apiRuntime.ExpoApiUrl)"
} else {
    $metroCmd = New-MetroLaunchCmd -NpmScript $metroNpm
    Write-Host 'Metro API: default local (127.0.0.1:8000 + adb reverse)'
}
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $metroCmd) -WorkingDirectory $mobile
Write-Host "Metro window opened: $metroNpm"

if ($MaestroSmoke) {
    Wait-ForMetro -Port 8081 -TimeoutSec 180
    Write-Host "[5/$stepTotal] Maestro smoke..."
    Invoke-MaestroSmoke
}

Write-Host ''
Write-Host 'Deep link (optional, after Metro ready):'
$deepLinkHint = 'exp+ai-poker-notes://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
Write-Host "  adb -s $($script:AdbSerial) shell am start -a android.intent.action.VIEW -d ""$deepLinkHint"""
Write-Host ''
Write-Host 'Done. Emulator + Metro running.' -ForegroundColor Green
