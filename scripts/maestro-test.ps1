# Run APN Maestro on Android (emulator dev-client or USB release APK)
# Pref dev-client: Metro :8081, backend :8000
# Pref standalone: release APK with embedded bundle (no Metro)

param(
    [switch]$Standalone,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$FlowPath
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$maestroBat = 'C:\Tools\maestro\maestro\bin\maestro.bat'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$flow = Join-Path $root '.maestro\smoke.yaml'
$appId = 'com.aipoker.notes'

if ($FlowPath -and $FlowPath.Count -ge 1) {
    $flow = $FlowPath[0]
    if (-not [System.IO.Path]::IsPathRooted($flow)) {
        $flow = Join-Path $root $flow
    }
}

if (-not $Standalone -and ($flow -match 'standalone' -or $flow -match 'smoke-standalone')) {
    $Standalone = $true
}

function Get-EmulatorSerial {
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
            if ($serial -notmatch '^emulator-') { return $serial }
        }
    }
    return $null
}

function Wait-ForMetro {
    param([int]$TimeoutSec = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    Write-Host "Waiting for Metro on :8081 ..."
    do {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 2
            $body = [string]$response.Content
            if ($response.StatusCode -eq 200 -and ($body -match 'running' -or $body.Length -gt 0)) {
                Write-Host "Metro :8081 OK ($body)"
                return
            }
        } catch {
            try {
                $tcp = New-Object System.Net.Sockets.TcpClient
                $iar = $tcp.BeginConnect('127.0.0.1', 8081, $null, $null)
                if ($iar.AsyncWaitHandle.WaitOne(1500, $false) -and $tcp.Connected) {
                    $tcp.Close()
                    Write-Host 'Metro :8081 OK (port open)'
                    return
                }
                $tcp.Close()
            } catch {
                # still starting
            }
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    Write-Error 'Metro not responding on :8081. Start: cd apps/mobile && npm run start:dev-client'
}

function Connect-DevClientMetro {
    param([string]$Udid)
    $deepLinks = @(
        'exp+ai-poker-notes-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081',
        'exp+ai-poker-notes://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081',
        'ai-poker-notes://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
    )
    foreach ($deepLink in $deepLinks) {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $out = (& $adb -s $Udid shell am start -a android.intent.action.VIEW -d $deepLink 2>&1) -join ' '
        $ErrorActionPreference = $prev
        if ($out -notmatch 'Error: Activity not started') {
            Write-Host 'Dev-client deep link: localhost:8081'
            Start-Sleep -Seconds 5
            return
        }
    }
    Write-Host 'Deep link skipped - Maestro launch-dev-client subflow will tap Metro URL' -ForegroundColor Yellow
}

if (-not (Test-Path $maestroBat)) {
    Write-Error "Maestro not found at $maestroBat. Install: unzip maestro.zip to C:\Tools\maestro"
}

if (-not (Test-Path $adb)) {
    Write-Error "adb not found: $adb"
}

$udid = $env:APN_ADB_SERIAL
if (-not $udid) {
    # Standalone (release / USB S23) — сначала физика; dev-client — сначала эмулятор
    if ($Standalone) {
        $udid = Get-PhysicalDeviceSerial
        if (-not $udid) { $udid = Get-EmulatorSerial }
    } else {
        $udid = Get-EmulatorSerial
        if (-not $udid) { $udid = Get-PhysicalDeviceSerial }
    }
}
if (-not $udid) {
    Write-Error 'No Android emulator/USB device. Connect device or start emulator.'
}

$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$pkg = (& $adb -s $udid shell pm path $appId 2>&1 | ForEach-Object { "$_" }) -join ''
$ErrorActionPreference = $prev
if ($pkg -notmatch 'package:') {
    Write-Error "APK $appId not installed. Build via dev-android menu 13 (release) or emulator -Build."
}

if ($Standalone) {
    Write-Host ('Standalone release APK on ' + $udid + ' - Metro not required')
    # S23/USB: телефон может уснуть (AOD) пока ждём — иначе Maestro видит lockscreen
    $prevWake = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $adb -s $udid shell input keyevent KEYCODE_WAKEUP 2>&1 | Out-Null
    & $adb -s $udid shell wm dismiss-keyguard 2>&1 | Out-Null
    & $adb -s $udid shell svc power stayon true 2>&1 | Out-Null
    $ErrorActionPreference = $prevWake
    Start-Sleep -Seconds 2
} else {
    & $adb -s $udid reverse tcp:8000 tcp:8000 | Out-Null
    & $adb -s $udid reverse tcp:8081 tcp:8081 | Out-Null
    Write-Host "adb reverse on ${udid}: 8000, 8081 (Metro via localhost)"
    Wait-ForMetro
    Connect-DevClientMetro -Udid $udid
    Write-Host 'Waiting 15s for Metro bundle on device...'
    Start-Sleep -Seconds 15
}

$env:MAESTRO_CLI_NO_ANALYTICS = '1'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'

Write-Host "App: $appId"
Write-Host "Device: $udid"
Write-Host "Running: $flow"
& $maestroBat --udid $udid test $flow
exit $LASTEXITCODE
