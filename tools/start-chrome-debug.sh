#!/bin/bash

# Script to start Chrome with remote debugging enabled
# This allows the food agent to connect to your existing Chrome session

echo "Starting Chrome with remote debugging..."
echo "Make sure to close all existing Chrome windows first!"

# Kill any existing Chrome processes
pkill -f "Google Chrome" 2>/dev/null || true

# Start Chrome with remote debugging on port 9222
open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"

echo "Chrome started with debugging enabled on port 9222"
echo "Now you can run: npm start 'I want pizza'"
echo "The agent will connect to this Chrome instance"
