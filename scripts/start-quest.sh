#!/bin/bash

# Start development server optimized for Oculus Quest
echo "🥽 Starting Sky Bug Hunter VR for Oculus Quest..."
echo "📋 Open this URL in Oculus Browser on your Quest"
echo ""

# Load Quest environment
export VITE_VR_MODE=oculus
export VITE_ENABLE_OCULUS=true
export VITE_RENDER_SCALE=0.8
export VITE_RENDER_DISTANCE=3000

# Get local IP for Quest access
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo "🌐 Access from Quest: http://${LOCAL_IP}:5173"
echo "📱 Make sure Quest and PC are on the same network"
echo ""

# Start dev server with network access
npm run dev -- --host
