#!/bin/bash

echo "=== NextStep Backend Debug Script ==="
echo "Checking server status and common issues..."

# Check if Node.js is running
if pgrep -f "node.*index.js" > /dev/null; then
    echo "✓ Node.js server is running"
else
    echo "✗ Node.js server is NOT running"
fi

# Check uploads directory
UPLOADS_DIR="./uploads"
if [ -d "$UPLOADS_DIR" ]; then
    echo "✓ Uploads directory exists"
    
    # Check permissions
    if [ -w "$UPLOADS_DIR" ]; then
        echo "✓ Uploads directory is writable"
    else
        echo "✗ Uploads directory is NOT writable - this is likely the issue!"
        echo "Run: chmod 755 $UPLOADS_DIR"
    fi
    
    # Show disk space
    echo "Disk space in uploads directory:"
    du -sh "$UPLOADS_DIR"
else
    echo "✗ Uploads directory does not exist - creating it..."
    mkdir -p "$UPLOADS_DIR"
    chmod 755 "$UPLOADS_DIR"
    echo "✓ Created uploads directory with proper permissions"
fi

# Check environment variables
echo "Environment variables:"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"

# Test database connection
echo "Testing database connection..."
node -e "
const Database = require('./src/config/database');
Database.query('SELECT 1 as test')
  .then(() => console.log('✓ Database connection successful'))
  .catch(err => console.error('✗ Database connection failed:', err.message));
"

# Check if port is accessible
if [ -n "$PORT" ]; then
    echo "Testing port $PORT accessibility..."
    if curl -s "http://localhost:$PORT/api/health" > /dev/null; then
        echo "✓ Server is responding on port $PORT"
    else
        echo "✗ Server is not responding on port $PORT"
    fi
fi

echo "=== Debug Complete ==="
