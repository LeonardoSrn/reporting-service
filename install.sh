#!/bin/bash
# Installation script for the reporting service

set -e  # Exit on error

echo "========================================="
echo "  etaONE Reporting Service Installation"
echo "========================================="
echo ""

# Check Node.js version
echo "✓ Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js 20+ required. Current version: $(node -v)"
    exit 1
fi
echo "  Node.js version: $(node -v)"

# Check pnpm
echo "✓ Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm not found. Installing via corepack..."
    corepack enable pnpm
fi
echo "  pnpm version: $(pnpm -v)"

echo ""
echo "Installing dependencies..."
pnpm install

echo ""
echo "Installing Playwright browsers..."
pnpm exec playwright install chromium

echo ""
echo "========================================="
echo "  ✅ Installation Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the service:"
echo "     pnpm dev"
echo ""
echo "  2. Test the health endpoint:"
echo "     curl http://localhost:3001/health"
echo ""
echo "  3. Generate a test report from the Angular app"
echo ""
echo "For more information, see:"
echo "  - README.md for full documentation"
echo "  - QUICKSTART.md for quick start guide"
echo "  - API.md for API reference"
echo ""
