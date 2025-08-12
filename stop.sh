#!/bin/bash

echo "🛑 Stopping Ticket Manager Platform..."

# Kill processes on port 8000 (backend)
echo "🛑 Stopping backend server..."
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Kill processes on port 3000 (frontend)
echo "🛑 Stopping frontend server..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "✅ All servers stopped!" 