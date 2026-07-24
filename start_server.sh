#!/bin/bash

# Find an available port starting from 8080
PORT=8080
while lsof -i -P -n | grep -q ":$PORT (LISTEN)"; do
    echo "Port $PORT is already in use, trying next port..."
    PORT=$((PORT + 1))
done

echo "Starting local server at http://localhost:$PORT..."
echo "Press Ctrl+C to stop the server."

# Start Python HTTP server in background
python3 -m http.server $PORT &
SERVER_PID=$!

# Wait 1 second for server to initialize
sleep 1

# Open the site in the default browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # MacOS
    open "http://localhost:$PORT"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "http://localhost:$PORT"
else
    # Windows/Other fallbacks
    start "http://localhost:$PORT"
fi

# Bring server process to foreground to capture Ctrl+C
wait $SERVER_PID
