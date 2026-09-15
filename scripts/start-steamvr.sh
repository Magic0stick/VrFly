#!/bin/bash

# Start development server with SteamVR support
echo "🎮 Starting Sky Bug Hunter VR with SteamVR..."
echo "📋 Make sure SteamVR is running!"
echo ""

# Check if SteamVR is running (Windows)
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    if tasklist | grep -i "vrserver.exe" > /dev/null; then
        echo "✅ SteamVR is running"
    else
        echo "⚠️  SteamVR is not running. Please start SteamVR first!"
        echo "   Or press Ctrl+C to cancel and start it manually."
        sleep 3
    fi
fi

# Load SteamVR environment
export VITE_VR_MODE=steamvr
export VITE_ENABLE_STEAMVR=true

# Start dev server
npm run dev
