#!/bin/bash

# Script to take screenshots of mockups using Chrome headless

CHROME="/usr/local/bin/google-chrome"
MOCKUP_DIR="/agent/repos/dobi-site/mockups"
SCREENSHOT_DIR="$MOCKUP_DIR/screenshots"

cd "$MOCKUP_DIR"

# Start a simple HTTP server in the background
python3 -m http.server 8765 > /dev/null 2>&1 &
SERVER_PID=$!
echo "Started HTTP server with PID $SERVER_PID"

# Wait for server to be ready
sleep 2

# Function to take screenshot
take_screenshot() {
  local url=$1
  local width=$2
  local output=$3
  
  echo "Taking screenshot: $output (width: $width)"
  
  $CHROME --headless --disable-gpu \
    --window-size="$width,2000" \
    --screenshot="$output" \
    --hide-scrollbars \
    --default-background-color=0 \
    "$url" > /dev/null 2>&1
}

# Take screenshots for each mockup
for mockup in a-field b-blaze c-topo d-rescue; do
  echo "Processing $mockup..."
  
  # Desktop screenshot (1440px)
  take_screenshot \
    "http://localhost:8765/${mockup}.html" \
    1440 \
    "$SCREENSHOT_DIR/${mockup}-desktop.png"
  
  # Mobile screenshot (390px)
  take_screenshot \
    "http://localhost:8765/${mockup}.html" \
    390 \
    "$SCREENSHOT_DIR/${mockup}-mobile.png"
done

echo "All screenshots taken!"

# Kill the HTTP server
kill $SERVER_PID 2>/dev/null
echo "Server stopped"

# Copy screenshots to artifacts directory
mkdir -p /opt/cursor/artifacts
cp "$SCREENSHOT_DIR"/*.png /opt/cursor/artifacts/
echo "Screenshots copied to artifacts"

ls -lh "$SCREENSHOT_DIR"
