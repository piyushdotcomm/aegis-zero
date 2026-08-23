#!/bin/bash
set -e

echo -e "\033[1;36m⛊ Starting Aegis-Zero Enterprise Environment...\033[0m"

# 1. Check Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "\033[1;31mERROR: Docker is not running.\033[0m"
    echo -e "\033[1;33mPlease start Docker and try again.\033[0m"
    exit 1
fi

# 2. Exasol Database
echo -e "\n\033[1;34m[1/4] Booting Exasol Database Container...\033[0m"
if [ ! "$(docker ps -aq -f name=exasoldb)" ]; then
    echo "Downloading and starting Exasol container (this takes a moment)..."
    docker run --name exasoldb -p 8563:8563 --detach --privileged --stop-timeout 120 exasol/docker-db:latest
else
    echo "Starting existing Exasol container..."
    docker start exasoldb > /dev/null
fi

if [ "$1" != "--skip-setup" ]; then
    echo -e "\033[1;33mWaiting 10 seconds for Exasol DB to initialize...\033[0m"
    sleep 10
fi

# 3. Python Backend
echo -e "\n\033[1;34m[2/4] Setting up Python AI Gateway environment...\033[0m"
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating venv and installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt > /dev/null

echo -e "\n\033[1;34m[3/4] Seeding the Exasol Database with test data...\033[0m"
python setup_demo_schema.py

# 4. Frontend UI
echo -e "\n\033[1;34m[4/4] Starting Zero-Trust Attack Arena UI...\033[0m"
cd aegis-ui
if [ ! -d "node_modules" ]; then
    echo "Installing NPM dependencies..."
    npm install > /dev/null
fi

echo -e "\n\033[1;32m========================================================\033[0m"
echo -e "\033[1;32m  ENVIRONMENT LIVE! Opening your browser... \033[0m"
echo -e "\033[1;32m========================================================\033[0m"

# Open browser based on OS
if which xdg-open > /dev/null; then 
    xdg-open http://localhost:3000 >/dev/null 2>&1
elif which open > /dev/null; then 
    open http://localhost:3000 >/dev/null 2>&1
fi

npm run dev
