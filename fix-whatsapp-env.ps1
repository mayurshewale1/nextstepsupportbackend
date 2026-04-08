# Fix WhatsApp API Key Environment Variable for PowerShell
Write-Host "Fixing WhatsApp API Key configuration..."

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file from example..."
    Copy-Item .env.example .env
}

# Add BIGTOS_API_KEY if not present
if (-not (Select-String -Path .env -Pattern "BIGTOS_API_KEY=" -Quiet)) {
    Write-Host "Adding BIGTOS_API_KEY to .env..."
    Add-Content .env ""
    Add-Content .env "# WhatsApp (Bigtos API)"
    Add-Content .env "BIGTOS_API_KEY=ZGZ5FKJEMVSUJATAKYDEMNMWF"
} else {
    Write-Host "BIGTOS_API_KEY already exists in .env"
}

Write-Host "Environment configuration updated!"
Write-Host "Please restart your server for changes to take effect."
