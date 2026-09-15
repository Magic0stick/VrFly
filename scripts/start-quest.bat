@echo off
echo 🥽 Starting Sky Bug Hunter VR for Oculus Quest...
echo 📋 Open this URL in Oculus Browser on your Quest
echo.

REM Load Quest environment
set VITE_VR_MODE=oculus
set VITE_ENABLE_OCULUS=true
set VITE_RENDER_SCALE=0.8
set VITE_RENDER_DISTANCE=3000

REM Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
)
set LOCAL_IP=%LOCAL_IP: =%

echo 🌐 Access from Quest: http://%LOCAL_IP%:5173
echo 📱 Make sure Quest and PC are on the same network
echo.

REM Start dev server with network access
npm run dev -- --host
