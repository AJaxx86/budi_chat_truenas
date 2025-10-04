#!/bin/bash

# AI Chat Hub - Setup Verification Script
# This script checks if all necessary files and configurations are in place

echo "🔍 AI Chat Hub - Setup Verification"
echo "===================================="
echo ""

ERRORS=0
WARNINGS=0

# Function to check file existence
check_file() {
    if [ -f "$1" ]; then
        echo "✅ Found: $1"
    else
        echo "❌ Missing: $1"
        ERRORS=$((ERRORS + 1))
    fi
}

# Function to check directory existence
check_dir() {
    if [ -d "$1" ]; then
        echo "✅ Found: $1/"
    else
        echo "❌ Missing: $1/"
        ERRORS=$((ERRORS + 1))
    fi
}

# Function to check if command exists
check_command() {
    if command -v "$1" &> /dev/null; then
        VERSION=$($1 --version 2>&1 | head -n1)
        echo "✅ $1 is installed: $VERSION"
    else
        echo "⚠️  $1 is not installed"
        WARNINGS=$((WARNINGS + 1))
    fi
}

echo "📦 Checking Project Structure..."
echo "--------------------------------"

# Root files
check_file "package.json"
check_file "Dockerfile"
check_file "docker-compose.yml"
check_file ".dockerignore"
check_file ".gitignore"
check_file ".env.example"
check_file "README.md"
check_file "QUICK_START.md"
check_file "TRUENAS_DEPLOYMENT.md"

echo ""
echo "🗂️  Checking Server Files..."
echo "----------------------------"

# Server files
check_file "server/index.js"
check_file "server/database.js"
check_file "server/middleware/auth.js"
check_file "server/routes/auth.js"
check_file "server/routes/admin.js"
check_file "server/routes/chats.js"
check_file "server/routes/messages.js"
check_file "server/routes/memories.js"
check_file "server/services/ai.js"

echo ""
echo "🎨 Checking Client Files..."
echo "---------------------------"

# Client files
check_file "client/package.json"
check_file "client/vite.config.js"
check_file "client/tailwind.config.js"
check_file "client/index.html"
check_file "client/src/main.jsx"
check_file "client/src/App.jsx"
check_file "client/src/index.css"
check_file "client/src/contexts/AuthContext.js"
check_file "client/src/pages/Login.jsx"
check_file "client/src/pages/Register.jsx"
check_file "client/src/pages/Chat.jsx"
check_file "client/src/pages/Admin.jsx"
check_file "client/src/pages/Settings.jsx"
check_file "client/src/pages/Memories.jsx"

echo ""
echo "🔧 Checking Dependencies..."
echo "---------------------------"

check_command "node"
check_command "npm"
check_command "docker"
check_command "docker-compose"

echo ""
echo "⚙️  Checking Configuration..."
echo "-----------------------------"

# Check .env file
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    
    # Check critical environment variables
    if grep -q "JWT_SECRET=your-super-secret-jwt-key-change-this" .env; then
        echo "⚠️  Warning: JWT_SECRET uses default value - please change it!"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "✅ JWT_SECRET has been customized"
    fi
    
    if grep -q "ADMIN_EMAIL=" .env; then
        echo "✅ ADMIN_EMAIL is configured"
    else
        echo "⚠️  ADMIN_EMAIL not found in .env"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if grep -q "ADMIN_PASSWORD=" .env; then
        echo "✅ ADMIN_PASSWORD is configured"
    else
        echo "⚠️  ADMIN_PASSWORD not found in .env"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  .env file not found - create one from .env.example"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "📊 Summary"
echo "=========="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 Perfect! Everything looks good!"
    echo ""
    echo "Next steps:"
    echo "1. Review your .env configuration"
    echo "2. Run: docker-compose up -d"
    echo "3. Access: http://localhost:3001"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "✅ No critical errors, but you have $WARNINGS warning(s) to address."
    echo ""
    echo "You can proceed with deployment, but consider fixing the warnings."
    echo ""
    exit 0
else
    echo "❌ Found $ERRORS error(s) and $WARNINGS warning(s)."
    echo ""
    echo "Please fix the errors before deploying."
    echo ""
    exit 1
fi
