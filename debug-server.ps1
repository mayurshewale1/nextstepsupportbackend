# NextStep Backend Debug Script for Windows

Write-Host "=== NextStep Backend Debug Script ===" -ForegroundColor Green
Write-Host "Checking server status and common issues..." -ForegroundColor Yellow

# Check if Node.js is running
$nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcess) {
    Write-Host "✓ Node.js server is running" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js server is NOT running" -ForegroundColor Red
}

# Check uploads directory
$uploadsDir = ".\uploads"
if (Test-Path $uploadsDir) {
    Write-Host "✓ Uploads directory exists" -ForegroundColor Green
    
    # Check if directory is writable
    try {
        $testFile = Join-Path $uploadsDir "test.txt"
        "test" | Out-File -FilePath $testFile -ErrorAction Stop
        Remove-Item $testFile -ErrorAction SilentlyContinue
        Write-Host "✓ Uploads directory is writable" -ForegroundColor Green
    } catch {
        Write-Host "✗ Uploads directory is NOT writable - this is likely the issue!" -ForegroundColor Red
        Write-Host "Run: icacls $uploadsDir /grant Everyone:F" -ForegroundColor Yellow
    }
    
    # Show disk space
    $size = (Get-ChildItem -Path $uploadsDir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "Uploads directory size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host "✗ Uploads directory does not exist - creating it..." -ForegroundColor Red
    New-Item -ItemType Directory -Path $uploadsDir -Force
    Write-Host "✓ Created uploads directory" -ForegroundColor Green
}

# Check environment variables
Write-Host "Environment variables:" -ForegroundColor Yellow
$dbUrl = $env:DATABASE_URL
if ($dbUrl) {
    Write-Host "DATABASE_URL: $($dbUrl.Substring(0, [Math]::Min(20, $dbUrl.Length)))..." -ForegroundColor Cyan
} else {
    Write-Host "DATABASE_URL: NOT SET" -ForegroundColor Red
}
Write-Host "NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan
Write-Host "PORT: $env:PORT" -ForegroundColor Cyan

# Test database connection
Write-Host "Testing database connection..." -ForegroundColor Yellow
try {
    $testScript = @"
const Database = require('./src/config/database');
Database.query('SELECT 1 as test')
  .then(() => console.log('✓ Database connection successful'))
  .catch(err => console.error('✗ Database connection failed:', err.message));
"@
    $testScript | node
} catch {
    Write-Host "✗ Failed to test database connection" -ForegroundColor Red
}

# Check if port is accessible
if ($env:PORT) {
    Write-Host "Testing port $($env:PORT) accessibility..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($env:PORT)/api/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✓ Server is responding on port $($env:PORT)" -ForegroundColor Green
    } catch {
        Write-Host "✗ Server is not responding on port $($env:PORT)" -ForegroundColor Red
    }
}

Write-Host "=== Debug Complete ===" -ForegroundColor Green
