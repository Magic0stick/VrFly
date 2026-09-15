@echo off
echo 🎮 Starting Sky Bug Hunter VR with SteamVR...
echo 📋 Make sure SteamVR is running!
echo.

REM Check if SteamVR is running
tasklist /FI "IMAGENAME eq vrserver.exe" 2>NUL | find /I /N "vrserver.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ SteamVR is running
) else (
    echo ⚠️  SteamVR is not running. Please start SteamVR first!
    echo    Or press Ctrl+C to cancel and start it manually.
    timeout /t 3 /nobreak >nul
)

REM Load SteamVR environment
set VITE_VR_MODE=steamvr
set VITE_ENABLE_STEAMVR=true

REM Start dev server
npm run dev
