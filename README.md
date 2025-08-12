# BNM Ticket Management System

A full-stack ticket management system built with Python FastAPI backend and React TypeScript frontend.

## 🚀 Features

- **User Authentication & Authorization**
- **Ticket Management** - Create, update, and track tickets
- **File Attachments** - Support for various file types
- **Advanced Filtering & Search**
- **Responsive Web Interface**
- **RESTful API**
- **SQLite Database**

## 🏗️ Project Structure

```
bnm/
├── backend/                 # Python FastAPI backend
│   ├── config/             # Configuration files
│   ├── models.py           # Database models
│   ├── main.py             # FastAPI application
│   ├── auth.py             # Authentication logic
│   └── requirements.txt    # Python dependencies
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   ├── package.json        # Node.js dependencies
│   └── tailwind.config.js  # Tailwind CSS configuration
├── venv/                   # Python virtual environment
└── start.sh               # Startup script
```

## 🛠️ Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

## 📦 Installation

### Backend Setup

1. **Navigate to the project directory:**
   ```bash
   cd bnm
   ```

2. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate  # On macOS/Linux
   # or
   venv\Scripts\activate     # On Windows
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Initialize the database:**
   ```bash
   cd backend
   python init_db.py
   ```

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

## 🚀 Running the Application

### Development Mode

1. **Start the backend server:**
   ```bash
   cd backend
   python main.py
   ```
   The API will be available at `http://localhost:8000`

2. **Start the frontend development server:**
   ```bash
   cd frontend
   npm start
   ```
   The frontend will be available at `http://localhost:3000`

### Production Mode

Use the provided startup script:
```bash
./start.sh
```

## 🌐 API Documentation

Once the backend is running, you can access:
- **Interactive API docs**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🗄️ Database

The system uses SQLite for simplicity. The database file is created automatically when you run `init_db.py`.

## 🔧 Configuration

Configuration files are located in `backend/config/`:
- `centers.json` - Available centers
- `crits.json` - Criticality levels
- `statuses.json` - Ticket statuses
- `tools.json` - Available tools

## 🚀 Deployment

### Server Deployment

1. **Clone the repository on your server:**
   ```bash
   git clone <your-github-repo-url>
   cd bnm
   ```

2. **Set up the environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r backend/requirements.txt
   ```

3. **Build the frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

4. **Configure your web server (nginx, Apache) to serve the frontend build and proxy API requests to the backend**

5. **Run the backend as a service using systemd or similar**

### Docker Deployment (Optional)

You can also containerize the application using Docker for easier deployment.

## 📝 Environment Variables

Create a `.env` file in the backend directory for any environment-specific configurations.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is proprietary software.

## 🆘 Support

For support and questions, please contact the development team. 