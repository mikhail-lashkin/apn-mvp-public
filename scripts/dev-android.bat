@echo off
setlocal EnableExtensions EnableDelayedExpansion
title APN Mobile Dev - Android

REM APN: emulator + adb reverse + Metro (dev-client)
REM No args = interactive menu.
REM CLI: build clear docker docker-down nometro avd NAME

set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%dev-android.ps1"
cd /d "%SCRIPT_DIR%.."

set "DO_BUILD="
set "DO_DOCKER="
set "DO_DOCKER_DOWN="
set "DO_STOP_EMU="
set "DO_STOP_STACK="
set "DO_NOMETRO="
set "DO_CLEAR="
set "DO_SMOKE="
set "DO_RELEASE_BUILD="
set "DO_RELEASE_INSTALL="
set "DO_DEVICE_MAESTRO="
set "DO_ENSURE_SMOKE_USER="
set "DO_DB_BACKUP="
set "DO_DB_WIPE="
set "DO_DB_RESTORE="
set "DB_RESTORE_FILE="
set "DO_FIELD_DEBUG="
set "DO_FIELD_DEBUG_BUG="
set "AVD_NAME="
set "FROM_MENU="

if /I "%~1"=="menu" goto menu
if "%~1"=="" (
  cd /d "%SCRIPT_DIR%.."
  cmd /k "%~f0" menu
  exit /b 0
)

goto parse

:api_menu
cls
echo.
echo  ============================================
echo   API target (baked into release APK 12/13)
echo  ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status 2>nul
echo.
echo   1  LOCAL  - 127.0.0.1:8000 + adb reverse
echo   2  SERVER - SERVER_API_URL from scripts\api-target.env
echo   3  Status
echo   4  Ensure smoke user only (test@test.com)
echo   5  Backup DB  (target from current API above)
echo   6  Wipe DB    (DROP schema + alembic; confirms WIPE)
echo   7  Restore DB (from artifacts\db-backups; confirms RESTORE)
echo   M  Back to menu
echo.
set "API_CHOICE="
set /p "API_CHOICE=  Choose [1-7,M]: "
if "%API_CHOICE%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget local
  pause
  goto menu
)
if "%API_CHOICE%"=="2" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget server
  pause
  goto menu
)
if "%API_CHOICE%"=="3" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status
  pause
  goto menu
)
if "%API_CHOICE%"=="4" (
  set "DO_ENSURE_SMOKE_USER=1"
  goto run_ensure_smoke_user
)
if "%API_CHOICE%"=="5" (
  set "DO_DB_BACKUP=1"
  set "FROM_MENU=1"
  goto run_db_ops
)
if "%API_CHOICE%"=="6" (
  set "DO_DB_WIPE=1"
  set "FROM_MENU=1"
  goto run_db_ops
)
if "%API_CHOICE%"=="7" (
  set "DO_DB_RESTORE=1"
  set "FROM_MENU=1"
  goto run_db_ops
)
if /I "%API_CHOICE%"=="M" goto menu
goto api_menu

:menu
cls
echo.
echo  ============================================
echo   APN Mobile Dev - Android
echo  ============================================
echo.
echo   1  Start: emulator + Metro
echo   2  Start + Docker up
echo   3  Build APK + Metro
echo   4  Build APK + Metro --clear
echo   5  Metro --clear only
echo   6  Emulator + reverse (no Metro)
echo   7  Stop local stack... (docker / emulator / all)
echo   8  Custom flags...
echo   9  Help / CLI examples
echo   10  Build + Maestro smoke (emulator, dev-client)
echo   11  API target + DB backup/wipe/restore (local/server)
echo   12  Release APK -^> dist ^(API from 11^)
echo   13  Release APK -^> USB install ^(API from 11^)
echo   14  USB Maestro: ensure user + smoke ^(APK from 13^)
echo   15  Collect field debug ZIP ^(quick^)
echo   16  Collect field debug ZIP + bugreport
echo   0  Exit
echo.
set "CHOICE="
set /p "CHOICE=  Choose [0-16]: "

if "%CHOICE%"=="11" goto api_menu
if "%CHOICE%"=="7" goto stop_menu
if "%CHOICE%"=="15" (
  set "DO_FIELD_DEBUG=1"
  set "DO_FIELD_DEBUG_BUG="
  set "FROM_MENU=1"
  goto run_field_debug
)
if "%CHOICE%"=="16" (
  set "DO_FIELD_DEBUG=1"
  set "DO_FIELD_DEBUG_BUG=1"
  set "FROM_MENU=1"
  goto run_field_debug
)
if "%CHOICE%"=="14" (
  set "DO_DEVICE_MAESTRO=1"
  set "FROM_MENU=1"
  goto run_device_maestro
)
if "%CHOICE%"=="13" (
  set "DO_RELEASE_INSTALL=1"
  set "FROM_MENU=1"
  goto run_release
)
if "%CHOICE%"=="12" (
  set "DO_RELEASE_BUILD=1"
  set "FROM_MENU=1"
  goto run_release
)
if "%CHOICE%"=="10" set "DO_SMOKE=1" & set "FROM_MENU=1" & goto run
if "%CHOICE%"=="1" set "FROM_MENU=1" & goto run
if "%CHOICE%"=="2" set "DO_DOCKER=1" & set "FROM_MENU=1" & goto run
if "%CHOICE%"=="3" set "DO_BUILD=1" & set "FROM_MENU=1" & goto run
if "%CHOICE%"=="4" set "DO_BUILD=1" & set "DO_CLEAR=1" & set "FROM_MENU=1" & goto run
if "%CHOICE%"=="5" set "DO_CLEAR=1" & set "FROM_MENU=1" & goto run
if "%CHOICE%"=="6" set "DO_NOMETRO=1" & set "FROM_MENU=1" & goto run
if "%CHOICE%"=="8" goto custom
if "%CHOICE%"=="9" goto usage_menu
if "%CHOICE%"=="0" exit /b 0
if /I "%CHOICE%"=="q" exit /b 0

echo.
echo  Unknown choice: %CHOICE%
timeout /t 2 >nul
goto menu

:stop_menu
cls
echo.
echo  ============================================
echo   Stop local stack
echo  ============================================
echo.
echo   1  Full stop - Docker + emulator + Metro/Expo processes
echo   2  Docker compose down only
echo   3  Emulator only (adb emu kill + qemu)
echo   M  Back to menu
echo.
set "STOP_CHOICE="
set /p "STOP_CHOICE=  Choose [1-3,M]: "
if "%STOP_CHOICE%"=="1" (
  set "DO_STOP_STACK=1"
  set "FROM_MENU=1"
  goto run_stop
)
if "%STOP_CHOICE%"=="2" (
  set "DO_DOCKER_DOWN=1"
  set "FROM_MENU=1"
  goto run_stop
)
if "%STOP_CHOICE%"=="3" (
  set "DO_STOP_EMU=1"
  set "FROM_MENU=1"
  goto run_stop
)
if /I "%STOP_CHOICE%"=="M" goto menu
goto stop_menu

:custom
cls
echo.
echo  ============================================
echo   Custom flags (toggle, then Start)
echo  ============================================
echo.

:custom_loop
if defined DO_BUILD (set "S_BUILD=ON ") else (set "S_BUILD=off")
if defined DO_CLEAR (set "S_CLEAR=ON ") else (set "S_CLEAR=off")
if defined DO_DOCKER (set "S_DOCKER=ON ") else (set "S_DOCKER=off")
if defined DO_NOMETRO (set "S_NOMETRO=ON ") else (set "S_NOMETRO=off")
if defined AVD_NAME (set "S_AVD=%AVD_NAME%") else (set "S_AVD=Pixel_9")

echo   [B] Build APK ......... %S_BUILD%
echo   [C] Metro --clear ..... %S_CLEAR%
echo   [D] Docker up ......... %S_DOCKER%
echo   [N] No Metro .......... %S_NOMETRO%
echo   [A] AVD name .......... %S_AVD%
echo.
echo   [S] Start
echo   [X] Docker down only
echo   [M] Back to menu
echo   [Q] Exit
echo.
set "T="
set /p "T=  Key: "

if /I "%T%"=="B" (
  if defined DO_BUILD (set "DO_BUILD=") else (set "DO_BUILD=1")
  cls & goto custom_loop
)
if /I "%T%"=="C" (
  if defined DO_CLEAR (set "DO_CLEAR=") else (set "DO_CLEAR=1")
  cls & goto custom_loop
)
if /I "%T%"=="D" (
  if defined DO_DOCKER (set "DO_DOCKER=") else (set "DO_DOCKER=1")
  cls & goto custom_loop
)
if /I "%T%"=="N" (
  if defined DO_NOMETRO (set "DO_NOMETRO=") else (set "DO_NOMETRO=1")
  cls & goto custom_loop
)
if /I "%T%"=="A" (
  set /p "AVD_NAME=  AVD name: "
  cls & goto custom_loop
)
if /I "%T%"=="S" set "FROM_MENU=1" & goto run
if /I "%T%"=="X" set "DO_DOCKER_DOWN=1" & set "FROM_MENU=1" & goto run
if /I "%T%"=="M" (
  set "DO_BUILD="
  set "DO_CLEAR="
  set "DO_DOCKER="
  set "DO_NOMETRO="
  set "DO_DOCKER_DOWN="
  set "AVD_NAME="
  goto menu
)
if /I "%T%"=="Q" exit /b 0

echo  Unknown: %T%
timeout /t 1 >nul
cls
goto custom_loop

:parse
if "%~1"=="" goto run

if /I "%~1"=="help" goto usage
if /I "%~1"=="/?" goto usage
if /I "%~1"=="-h" goto usage
if /I "%~1"=="--help" goto usage
if /I "%~1"=="menu" goto menu

if /I "%~1"=="api" goto api_cli

if /I "%~1"=="build" set "DO_BUILD=1" & shift & goto parse
if /I "%~1"=="-build" set "DO_BUILD=1" & shift & goto parse

if /I "%~1"=="docker-down" set "DO_DOCKER_DOWN=1" & shift & goto parse
if /I "%~1"=="docker_down" set "DO_DOCKER_DOWN=1" & shift & goto parse
if /I "%~1"=="down" set "DO_DOCKER_DOWN=1" & shift & goto parse
if /I "%~1"=="stop-docker" set "DO_DOCKER_DOWN=1" & shift & goto parse
if /I "%~1"=="-dockerdown" set "DO_DOCKER_DOWN=1" & shift & goto parse

if /I "%~1"=="stop-emulator" set "DO_STOP_EMU=1" & shift & goto parse
if /I "%~1"=="stop-emu" set "DO_STOP_EMU=1" & shift & goto parse
if /I "%~1"=="emu-down" set "DO_STOP_EMU=1" & shift & goto parse
if /I "%~1"=="stop-stack" set "DO_STOP_STACK=1" & shift & goto parse
if /I "%~1"=="stop-all" set "DO_STOP_STACK=1" & shift & goto parse

if /I "%~1"=="docker" set "DO_DOCKER=1" & shift & goto parse
if /I "%~1"=="-docker" set "DO_DOCKER=1" & shift & goto parse

if /I "%~1"=="nometro" set "DO_NOMETRO=1" & shift & goto parse
if /I "%~1"=="no-metro" set "DO_NOMETRO=1" & shift & goto parse
if /I "%~1"=="-nometro" set "DO_NOMETRO=1" & shift & goto parse

if /I "%~1"=="clear" set "DO_CLEAR=1" & shift & goto parse
if /I "%~1"=="-clear" set "DO_CLEAR=1" & shift & goto parse
if /I "%~1"=="--clear" set "DO_CLEAR=1" & shift & goto parse

if /I "%~1"=="smoke" set "DO_SMOKE=1" & shift & goto parse
if /I "%~1"=="maestro-smoke" set "DO_SMOKE=1" & shift & goto parse
if /I "%~1"=="build-smoke" set "DO_SMOKE=1" & shift & goto parse
if /I "%~1"=="-MaestroSmoke" set "DO_SMOKE=1" & shift & goto parse

if /I "%~1"=="release-build" set "DO_RELEASE_BUILD=1" & shift & goto parse
if /I "%~1"=="release-install" set "DO_RELEASE_INSTALL=1" & shift & goto parse
if /I "%~1"=="device-maestro" set "DO_DEVICE_MAESTRO=1" & shift & goto parse
if /I "%~1"=="ensure-smoke-user" set "DO_ENSURE_SMOKE_USER=1" & shift & goto parse
if /I "%~1"=="smoke-user" set "DO_ENSURE_SMOKE_USER=1" & shift & goto parse

if /I "%~1"=="db-backup" set "DO_DB_BACKUP=1" & shift & goto parse
if /I "%~1"=="backup-db" set "DO_DB_BACKUP=1" & shift & goto parse
if /I "%~1"=="db-wipe" set "DO_DB_WIPE=1" & shift & goto parse
if /I "%~1"=="wipe-db" set "DO_DB_WIPE=1" & shift & goto parse
if /I "%~1"=="db-restore" goto take_db_restore
if /I "%~1"=="restore-db" goto take_db_restore

if /I "%~1"=="field-debug" set "DO_FIELD_DEBUG=1" & shift & goto parse
if /I "%~1"=="debug-pack" set "DO_FIELD_DEBUG=1" & shift & goto parse
if /I "%~1"=="field-debug-bugreport" set "DO_FIELD_DEBUG=1" & set "DO_FIELD_DEBUG_BUG=1" & shift & goto parse
if /I "%~1"=="debug-pack-bugreport" set "DO_FIELD_DEBUG=1" & set "DO_FIELD_DEBUG_BUG=1" & shift & goto parse

if /I "%~1"=="avd" goto take_avd
if /I "%~1"=="-avd" goto take_avd

echo Unknown argument: %~1
echo.
goto usage

:api_cli
shift
if /I "%~1"=="local" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget local
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="server" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget server
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="status" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="backup" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbBackup
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="wipe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbWipe
  exit /b %ERRORLEVEL%
)
if /I "%~1"=="restore" (
  if not "%~2"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbRestore -BackupFile "%~2"
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbRestore
  )
  exit /b %ERRORLEVEL%
)
echo Usage: scripts\dev-android.bat api local^|server^|status^|backup^|wipe^|restore [file.sql]
exit /b 1

:take_db_restore
shift
set "DO_DB_RESTORE=1"
if not "%~1"=="" (
  set "DB_RESTORE_FILE=%~1"
  shift
)
goto parse

:take_avd
shift
if "%~1"=="" (
  echo Error: after "avd" specify name, e.g. avd Pixel_9
  if defined FROM_MENU pause
  exit /b 1
)
set "AVD_NAME=%~1"
shift
goto parse

:run_field_debug
set "DEBUG_PS1=%SCRIPT_DIR%collect-field-debug.ps1"
if not exist "%DEBUG_PS1%" (
  echo Error: %DEBUG_PS1% not found
  if defined FROM_MENU pause
  exit /b 1
)

echo.
echo === APN Field Debug Pack ===
if defined DO_FIELD_DEBUG_BUG (
  echo   mode: quick + bugreport
  powershell -NoProfile -ExecutionPolicy Bypass -File "%DEBUG_PS1%" -IncludeBugreport
) else (
  echo   mode: quick
  powershell -NoProfile -ExecutionPolicy Bypass -File "%DEBUG_PS1%"
)
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo FAILED exit code %RC%
  if defined FROM_MENU pause
  if defined FROM_MENU goto menu
  exit /b %RC%
)
echo Done. ZIP under artifacts\diagnostics\
if defined FROM_MENU pause
if defined FROM_MENU goto menu
exit /b 0

:run_ensure_smoke_user
set "ENSURE_PS1=%SCRIPT_DIR%ensure-smoke-user.ps1"
if not exist "%ENSURE_PS1%" (
  echo Error: %ENSURE_PS1% not found
  pause
  goto menu
)

echo.
echo === APN ensure smoke user ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -EnsureSmokeUser
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo FAILED exit code %RC%
  pause
  goto menu
)
echo Done.
pause
goto menu

:run_db_ops
if not exist "%PS1%" (
  echo Error: PowerShell script not found:
  echo   %PS1%
  pause
  goto menu
)

echo.
if defined DO_DB_WIPE (
  echo === APN DB wipe ^(API target from menu 11^) ===
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status 2>nul
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbWipe
) else if defined DO_DB_RESTORE (
  echo === APN DB restore ^(API target from menu 11^) ===
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status 2>nul
  if defined DB_RESTORE_FILE (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbRestore -BackupFile "%DB_RESTORE_FILE%"
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbRestore
  )
) else (
  echo === APN DB backup ^(API target from menu 11^) ===
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status 2>nul
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DbBackup
)
set "RC=%ERRORLEVEL%"
set "DO_DB_BACKUP="
set "DO_DB_WIPE="
set "DO_DB_RESTORE="
set "DB_RESTORE_FILE="
echo.
if not "%RC%"=="0" (
  echo FAILED exit code %RC%
  if defined FROM_MENU pause
  if defined FROM_MENU goto menu
  exit /b %RC%
)
echo Done. Dumps: artifacts\db-backups\
if defined FROM_MENU pause
if defined FROM_MENU goto menu
exit /b 0

:run_release
if not exist "%PS1%" (
  echo Error: PowerShell script not found:
  echo   %PS1%
  pause
  goto menu
)

echo.
echo === APN dev-android (release) ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status 2>nul
if defined DO_RELEASE_INSTALL (
  echo   mode: release build + USB install
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -ReleaseInstall
) else (
  echo   mode: release build -^> dist
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -ReleaseBuild
)
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo FAILED exit code %RC%
  pause
  goto menu
)
echo Done.
pause
goto menu

:run_device_maestro
if not exist "%PS1%" (
  echo Error: PowerShell script not found:
  echo   %PS1%
  pause
  goto menu
)

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
echo.
echo === APN USB Maestro ===
if not exist "%ADB%" (
  echo ERROR: adb not found:
  echo   %ADB%
  pause
  goto menu
)

echo Checking USB device...
"%ADB%" devices
powershell -NoProfile -Command "$lines = & '%ADB%' devices 2>$null; $ok = $lines | Where-Object { $_ -match '\tdevice$' -and $_ -notmatch 'emulator-' }; if (-not $ok) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo.
  echo ERROR: USB phone not found.
  pause
  goto menu
)

echo   mode: ensure user + Maestro (standalone release APK)
echo   APK: install via menu 13 first; API via menu 11
echo   log: %TEMP%\apn-dev-android.log
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SetApiTarget -ApiTarget status 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DeviceMaestro -LogFile "%TEMP%\apn-dev-android.log"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo FAILED exit code %RC%
  if exist "%TEMP%\apn-dev-android.log" echo See log: %TEMP%\apn-dev-android.log
  pause
  goto menu
)
echo Done.
if exist "%TEMP%\apn-dev-android.log" echo Log: %TEMP%\apn-dev-android.log
pause
goto menu

:run
if defined DO_FIELD_DEBUG goto run_field_debug
if defined DO_DB_BACKUP goto run_db_ops
if defined DO_DB_WIPE goto run_db_ops
if defined DO_DB_RESTORE goto run_db_ops
if defined DO_ENSURE_SMOKE_USER goto run_ensure_smoke_user
if defined DO_DEVICE_MAESTRO goto run_device_maestro
if defined DO_RELEASE_BUILD goto run_release
if defined DO_RELEASE_INSTALL goto run_release
if defined DO_STOP_STACK goto run_stop
if defined DO_STOP_EMU goto run_stop
if defined DO_DOCKER_DOWN goto run_stop

if not exist "%PS1%" (
  echo Error: PowerShell script not found:
  echo   %PS1%
  if defined FROM_MENU pause
  exit /b 1
)

goto start_dev

:run_stop
if not exist "%PS1%" (
  echo Error: PowerShell script not found:
  echo   %PS1%
  if defined FROM_MENU pause
  exit /b 1
)

echo === APN stop ===
if defined DO_STOP_STACK (
  echo   action: full local stack ^(docker + emulator + Metro^)
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -StopStack
) else if defined DO_STOP_EMU (
  echo   action: emulator only
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -StopEmulator
) else (
  echo   action: docker compose down
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -DockerDown
)
set "RC=%ERRORLEVEL%"
set "DO_STOP_STACK="
set "DO_STOP_EMU="
set "DO_DOCKER_DOWN="
echo.
if not "%RC%"=="0" (
  echo FAILED exit code %RC%
  if defined FROM_MENU pause
  if defined FROM_MENU goto menu
  exit /b %RC%
)
echo Done.
if defined FROM_MENU (
  pause
  goto menu
)
exit /b 0

:start_dev
set "A_BUILD="
set "A_DOCKER="
set "A_NOMETRO="
set "A_CLEAR="
set "A_SMOKE="
if defined DO_BUILD set "A_BUILD=-Build"
if defined DO_DOCKER set "A_DOCKER=-Docker"
if defined DO_NOMETRO set "A_NOMETRO=-NoMetro"
if defined DO_CLEAR set "A_CLEAR=-Clear"
if defined DO_SMOKE set "A_SMOKE=-MaestroSmoke"

echo === APN dev-android ===
if defined DO_SMOKE (
  echo   mode: build + maestro smoke (emulator)
) else (
  if defined DO_BUILD (echo   build: yes) else (echo   build: no)
  if defined DO_DOCKER (echo   docker: up) else (echo   docker: skip)
  if defined DO_CLEAR (echo   metro: clear) else if defined DO_NOMETRO (echo   metro: skip) else (echo   metro: yes)
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $r = & '%PS1%' -SetApiTarget -ApiTarget status 2>&1; if ($LASTEXITCODE -eq 0) { $r | Select-Object -Last 1 } }" 2>nul
if defined AVD_NAME (echo   avd: %AVD_NAME%) else (echo   avd: Pixel_9 ^(default^))
echo.

if defined AVD_NAME (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %A_BUILD% %A_DOCKER% %A_NOMETRO% %A_CLEAR% %A_SMOKE% -Avd "%AVD_NAME%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %A_BUILD% %A_DOCKER% %A_NOMETRO% %A_CLEAR% %A_SMOKE%
)
if errorlevel 1 goto fail
if defined FROM_MENU (
  echo.
  pause
)
exit /b 0

:fail
echo.
echo Failed with exit code %ERRORLEVEL%
pause
exit /b 1

:usage_menu
call :print_usage
echo.
pause
goto menu

:usage
call :print_usage
exit /b 0

:print_usage
echo.
echo APN Mobile Dev - Android emulator + Metro
echo.
echo Without args: interactive menu.
echo.
echo CLI:
echo   scripts\dev-android.bat [options...]
echo   scripts\dev-android.bat menu
echo.
echo Options:
echo   build         Assemble debug APK (x86_64) + adb install (emulator)
echo   clear         Metro with Expo --clear (cache)
echo   docker        docker compose up -d
echo   docker-down   docker compose down (aliases: down, stop-docker)
echo   stop-emulator Stop emulator only (adb emu kill + qemu)
echo   stop-stack    Full stop: docker + emulator + Metro/Expo
echo   nometro       Emulator + reverse only (no Metro window)
echo   smoke         Build APK + Metro + Maestro smoke.yaml (emulator)
echo   release-build Release APK -^> dist/ (API from api-target.env)
echo   release-install Release APK + adb install on USB device
echo   device-maestro USB: ensure user + Maestro (release APK, no Metro)
echo   ensure-smoke-user Create test@test.com on current API
echo   field-debug   Collect APN diagnostics ZIP (logcat/dumpsys)
echo   field-debug-bugreport  Same + adb bugreport (slow)
echo   api local     Use local backend (127.0.0.1:8000 in APK)
echo   api server    Use SERVER_API_URL from api-target.env in APK
echo   api status    Show current API target
echo   api backup    pg_dump for current API target -^> artifacts\db-backups\
echo   api wipe      DROP schema + restart backend (type WIPE; auto-backup first)
echo   api restore   Restore from dump (pick file or pass path; type RESTORE)
echo   db-backup     Same as api backup
echo   db-wipe       Same as api wipe
echo   db-restore    Same as api restore [optional file.sql]
echo   avd NAME      AVD name (default: Pixel_9)
echo   menu          Open interactive menu
echo   help          Show this help
echo.
echo USB workflow:
echo   11 api server
echo   13 release-install
echo   14 device-maestro
echo.
echo DB ^(menu 11 -^> 5/6, uses current API target^):
echo   api local   then  api backup ^| api wipe ^| api restore
echo   api server  then  api backup ^| api wipe ^| api restore
echo.
echo Field debug (SC-8):
echo   15 field-debug
echo   16 field-debug-bugreport
echo   docs: docs\debug\field-debug-pack.md
echo.
echo Examples:
echo   scripts\dev-android.bat release-install
echo   scripts\dev-android.bat device-maestro
echo   scripts\dev-android.bat field-debug
echo   scripts\dev-android.bat api local
echo   scripts\dev-android.bat api backup
echo   scripts\dev-android.bat smoke
echo.
goto :eof
