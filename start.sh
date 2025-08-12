#!/bin/bash

echo "🚀 Starting Ticket Manager Platform..."

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo "🛑 Killing existing processes on port $port..."
        echo $pids | xargs kill -9 2>/dev/null
        sleep 2
    fi
}

# Kill existing processes on ports 8000 and 3000
kill_port 8000
kill_port 3000

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install backend dependencies
echo "📥 Installing backend dependencies..."
cd backend
pip install -r requirements.txt

# Initialize database if not exists
if [ ! -f "ticket_manager.db" ]; then
    echo "🗄️ Initializing database..."
    python init_db.py
fi

# Start backend server
echo "🔧 Starting backend server..."
python main.py &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Test backend
if curl -s http://localhost:8000/status/ > /dev/null; then
    echo "✅ Backend is running on http://localhost:8000"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend server
echo "🎨 Starting frontend server..."
cd ../frontend
npm start &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 10

# Test frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:3000"
else
    echo "❌ Frontend failed to start"
    exit 1
fi

echo ""
echo "🎉 Ticket Manager Platform is running!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
echo "👤 Default users:"
echo "   - admin/admin123 (Full access)"
echo "   - manager/manager123 (Create/View)"
echo "   - viewer/viewer123 (View only)"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait 