#!/bin/bash

# Fix WhatsApp API Key Environment Variable
echo "Fixing WhatsApp API Key configuration..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
fi

# Add BIGTOS_API_KEY if not present
if ! grep -q "BIGTOS_API_KEY=" .env; then
    echo "Adding BIGTOS_API_KEY to .env..."
    echo "" >> .env
    echo "# WhatsApp (Bigtos API)" >> .env
    echo "BIGTOS_API_KEY=ZGZ5FKJEMVSUJATAKYDEMNMWF" >> .env
else
    echo "BIGTOS_API_KEY already exists in .env"
fi

echo "Environment configuration updated!"
echo "Please restart your server for changes to take effect."
