# Release APK (локальная сборка)
# arm64-v8a, embedded JS bundle. API URL: -ApiUrl или localhost.
#
# Использование:
#   npm run build:release:apk
#   npm run build:release:apk -- -SkipPrebuild
#   npm run build:release:apk -- -ApiUrl http://10.0.2.2:8000

param(
    [switch]$SkipPrebuild,
    [string]$ApiUrl = '',
    [string]$Arch = 'arm64-v8a'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'apps\mobile'
$credentials = Join-Path $mobile 'credentials'
$dist = Join-Path $root 'dist'

function Resolve-BuildApiUrl {
    param([string]$Override)
    if ($Override) { return $Override.TrimEnd('/') }
    return 'http://127.0.0.1:8000'
}

function Ensure-ReleaseKeystore {
    $propsExample = Join-Path $credentials 'keystore.properties.example'
    $propsFile = Join-Path $credentials 'keystore.properties'
    $keystorePath = Join-Path $credentials 'apn-release.keystore'

    if (-not (Test-Path $credentials)) {
        New-Item -ItemType Directory -Path $credentials | Out-Null
    }

    if (-not (Test-Path $propsFile)) {
        if (-not (Test-Path $propsExample)) {
            Write-Error "Missing $propsExample"
        }
        Copy-Item $propsExample $propsFile
        Write-Host "Created keystore.properties from example"
    }

    if (Test-Path $keystorePath) {
        return $keystorePath
    }

    $props = @{}
    Get-Content $propsFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $props[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }

    $alias = $props['keyAlias']
    $storePass = $props['storePassword']
    $keyPass = $props['keyPassword']

    Write-Host "Generating release keystore: $keystorePath"
    $dname = 'CN=AI Poker Notes, OU=APN, O=APN-MVP, L=Sochi, ST=Krasnodar, C=RU'
    & keytool -genkeypair -v `
        -storetype PKCS12 `
        -keystore $keystorePath `
        -alias $alias `
        -keyalg RSA -keysize 2048 -validity 10000 `
        -storepass $storePass -keypass $keyPass `
        -dname $dname

    if ($LASTEXITCODE -ne 0) {
        Write-Error 'keytool failed — проверь JAVA_HOME'
    }

    return $keystorePath
}

function Patch-AndroidSigning {
    param([string]$KeystorePath)

    $propsFile = Join-Path $credentials 'keystore.properties'
    $props = @{}
    Get-Content $propsFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $props[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }

    $buildGradle = Join-Path $mobile 'android\app\build.gradle'
    if (-not (Test-Path $buildGradle)) {
        Write-Error "android/app/build.gradle not found. Run without -SkipPrebuild."
    }

    $content = Get-Content $buildGradle -Raw

    if ($content -notmatch 'signingConfigs\s*\{[^}]*release\s*\{') {
        $releaseBlock = @"

        release {
            def ksProps = new Properties()
            def ksFile = rootProject.file("../credentials/keystore.properties")
            if (ksFile.exists()) {
                ksProps.load(new FileInputStream(ksFile))
            }
            storeFile rootProject.file("../credentials/" + (ksProps['storeFile'] ?: 'apn-release.keystore'))
            storePassword ksProps['storePassword']
            keyAlias ksProps['keyAlias']
            keyPassword ksProps['keyPassword']
        }
"@
        $content = $content -replace '(signingConfigs\s*\{[^}]*debug\s*\{[^}]*\})', "`$1$releaseBlock"
    }

    $content = $content -replace 'release\s*\{([^}]*?)signingConfig signingConfigs\.debug', 'release {$1signingConfig signingConfigs.release'

    Set-Content -Path $buildGradle -Value $content -NoNewline
    Write-Host "Patched release signing in build.gradle"
}

function Get-AndroidSdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        return $env:ANDROID_HOME
    }
    $default = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    if (Test-Path $default) { return $default }
    Write-Error 'ANDROID_HOME not found'
}

function Get-JavaHome {
    # Gradle/RN не дружат с JDK 25 — всегда предпочитаем JBR Android Studio
    $studioJbr = 'C:\Program Files\Android\Android Studio\jbr'
    if (Test-Path $studioJbr) { return $studioJbr }
    if ($env:JAVA_HOME -and (Test-Path $env:JAVA_HOME)) {
        return $env:JAVA_HOME
    }
    Write-Error 'JAVA_HOME not found (install Android Studio JBR)'
}

# --- main ---
$apiUrl = Resolve-BuildApiUrl -Override $ApiUrl
Write-Host "SC-5 release build"
Write-Host "  API URL: $apiUrl"
Write-Host "  Arch:    $Arch"

$env:EXPO_PUBLIC_API_URL = $apiUrl
$env:ANDROID_HOME = Get-AndroidSdk
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = Get-JavaHome
# Sandbox Cursor иногда выставляет длинный GRADLE_USER_HOME → MAX_PATH / ninja FAIL.
# Канон: C:\g (или явный APN_GRADLE_HOME).
$env:GRADLE_USER_HOME = if ($env:APN_GRADLE_HOME) { $env:APN_GRADLE_HOME } else { 'C:\g' }
$env:Path = "$(Join-Path $env:ANDROID_HOME 'platform-tools');$(Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin');$env:Path"

$keystore = Ensure-ReleaseKeystore

Push-Location $mobile
try {
    if (-not $SkipPrebuild) {
        Write-Host '>>> expo prebuild --platform android'
        npx expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { Write-Error "expo prebuild failed: $LASTEXITCODE" }
    }

    # sanity: cleartext обязателен для HTTP backend
    $manifestPath = Join-Path $mobile 'android\app\src\main\AndroidManifest.xml'
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath -Raw
        if ($manifest -notmatch 'usesCleartextTraffic') {
            Write-Error 'AndroidManifest без usesCleartextTraffic — HTTP API не заработает на устройстве'
        }
        Write-Host 'AndroidManifest: usesCleartextTraffic OK'
    }

    Patch-AndroidSigning -KeystorePath $keystore

    $androidDir = Join-Path $mobile 'android'
    $sdkDirProp = ($env:ANDROID_HOME -replace '\\', '/')
    Set-Content -Path (Join-Path $androidDir 'local.properties') -Value "sdk.dir=$sdkDirProp" -Encoding ASCII

    $gradleProps = Join-Path $androidDir 'gradle.properties'
    $gp = Get-Content $gradleProps
    $gp = $gp | ForEach-Object {
        if ($_ -match '^reactNativeArchitectures=') {
            "reactNativeArchitectures=$Arch"
        } else {
            $_
        }
    }
    if (-not ($gp -match '^reactNativeArchitectures=')) {
        $gp += "reactNativeArchitectures=$Arch"
    }
    Set-Content -Path $gradleProps -Value $gp

    Write-Host '>>> gradlew assembleRelease'
    Push-Location $androidDir
    try {
        & .\gradlew.bat app:assembleRelease "-PreactNativeArchitectures=$Arch"
        if ($LASTEXITCODE -ne 0) { Write-Error "gradlew failed: $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

$apkSource = Join-Path $mobile 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $apkSource)) {
    Write-Error "APK not found: $apkSource"
}

if (-not (Test-Path $dist)) {
    New-Item -ItemType Directory -Path $dist | Out-Null
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$versionName = '1.0.2'
$versionCode = 13
$rcLabel = "APN-MVP-$versionName-rc10"
$apkDest = Join-Path $dist "apn-mvp-v$versionName-$stamp.apk"
Copy-Item $apkSource $apkDest -Force
Copy-Item $apkSource (Join-Path $dist 'apn-mvp-release-latest.apk') -Force

# SC-9: канонический каталог кандидата
$releaseDir = Join-Path $root "artifacts\releases\$rcLabel"
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
$rcApk = Join-Path $releaseDir "$rcLabel.apk"
Copy-Item $apkSource $rcApk -Force

$sha = (Get-FileHash -Algorithm SHA256 -Path $rcApk).Hash.ToLower()
Set-Content -Path (Join-Path $releaseDir 'SHA256.txt') -Value "$sha  $rcLabel.apk" -Encoding ASCII

$gitCommit = (git -C $root rev-parse HEAD 2>$null)
$gitShort = (git -C $root rev-parse --short HEAD 2>$null)
$dirty = (git -C $root status --porcelain 2>$null)
$treeLine = if ($dirty) { "DIRTY:`n$dirty" } else { 'clean' }
$builtAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
@(
    "RC: $rcLabel"
    "Built: $builtAt"
    "Git commit: $gitCommit ($gitShort)"
    "Working tree: $treeLine"
    "versionName: $versionName"
    "versionCode: $versionCode"
    "API target: $apiUrl"
    "Arch: $Arch"
    "APK: $rcApk"
    "SHA-256: $sha"
    "dist latest: $(Join-Path $dist 'apn-mvp-release-latest.apk')"
) | Set-Content -Path (Join-Path $releaseDir 'build-info.txt') -Encoding UTF8

# заготовки для regression (не перезаписываем, если уже есть)
foreach ($stub in @('test-results.md', 'known-issues.md')) {
    $stubPath = Join-Path $releaseDir $stub
    if (-not (Test-Path $stubPath)) {
        if ($stub -eq 'test-results.md') {
            @"
# Test results — $rcLabel

- Built: $builtAt
- Commit: ``$gitShort``
- Device: _(pending)_
- Decision: _(pending GO/NO-GO)_

## Automated (S23)

| Flow | Command | Result | Notes |
|------|---------|--------|-------|
| | | | |

## Manual

| Check | Result | Notes |
|-------|--------|-------|
| | | |
"@ | Set-Content -Path $stubPath -Encoding UTF8
        } else {
            @"
# Known issues — $rcLabel

| ID | Severity | Description | Workaround |
|----|----------|-------------|------------|
| | | | |
"@ | Set-Content -Path $stubPath -Encoding UTF8
        }
    }
}

$sizeMb = [math]::Round((Get-Item $apkDest).Length / 1MB, 1)
Write-Host ''
Write-Host "Release APK ready ($sizeMb MB):" -ForegroundColor Green
Write-Host "  $rcApk"
Write-Host "  $apkDest"
Write-Host "  $(Join-Path $dist 'apn-mvp-release-latest.apk')"
Write-Host "  SHA-256: $sha"
Write-Host ''
Write-Host 'S23 Ultra sideload:'
Write-Host '  1. Скопируй APK на телефон'
Write-Host '  2. Настройки → Безопасность → установка из неизвестных источников'
Write-Host '  3. Открой файл → Установить'
Write-Host "  4. Login против $apiUrl"
