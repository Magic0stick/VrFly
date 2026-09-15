# Start development server with SteamVR support (Windows)
Write-Host "🎮 Starting Sky Bug Hunter VR with SteamVR..." -ForegroundColor Cyan
Write-Host "📋 Make sure SteamVR is running!" -ForegroundColor Yellow
Write-Host ""

# Check if SteamVR is running
$steamvrRunning = Get-Process -Name "vrserver" -ErrorAction SilentlyContinue
if ($steamvrRunning) {
    Write-Host "✅ SteamVR is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  SteamVR is not running. Please start SteamVR first!" -ForegroundColor Red
    Write-Host "   Or press Ctrl+C to cancel and start it manually." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}

# Load SteamVR environment
$env:VITE_VR_MODE = "steamvr"
$env:VITE_ENABLE_STEAMVR = "true"

# Start dev server
npm run dev
