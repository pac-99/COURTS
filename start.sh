#!/bin/bash

# CourtCheck Startup Script

echo "🏀 Starting CourtCheck..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if MongoDB is running (optional)
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found locally. Make sure you have MongoDB running or use MongoDB Atlas."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "   Please edit .env file with your API keys before running the server."
fi

# Create uploads directory
mkdir -p uploads

echo "✅ Setup complete!"
echo ""
echo "🚀 To start the server:"
echo "   npm start"
echo ""
echo "🔧 To run in development mode:"
echo "   npm run dev"
echo ""
echo "📊 To seed sample data:"
echo "   node seed-data.js"
echo ""
echo "🌐 Open http://localhost:5000 in your browser"
echo ""
echo "📝 Don't forget to:"
echo "   1. Edit .env file with your API keys"
echo "   2. Start MongoDB (or use MongoDB Atlas)"
echo "   3. Get a Google Maps API key"
echo "   4. Set up Google OAuth credentials"

