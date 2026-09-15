#!/bin/bash

# Build and prepare for deployment
echo "📦 Building Sky Bug Hunter VR for deployment..."
echo ""

# Clean previous build
rm -rf dist/

# Build with production settings
npm run build

echo ""
echo "✅ Build complete!"
echo "📁 Output: dist/"
echo ""
echo "🚀 Deploy options:"
echo "   1. Upload dist/ to any HTTPS web host"
echo "   2. Use: netlify deploy --prod"
echo "   3. Use: vercel deploy --prod"
echo "   4. Use: gh-pages for GitHub Pages"
echo ""
echo "⚠️  IMPORTANT: WebXR requires HTTPS!"
echo "   Local testing: use 'npm run preview' or 'npx serve dist'"
