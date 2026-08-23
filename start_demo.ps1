param(
    [switch]$SkipSetup = $false
)

Write-Host "⛊ Starting Aegis-Zero Enterprise Environment..." -ForegroundColor Cyan

# 1. Check Docker
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running." -ForegroundColor Red
    Write-Host "Please start Docker Desktop and run this script again." -ForegroundColor Yellow
    exit 1
}

# 2. Exasol Database Container
Write-Host "`n[1/4] Booting Exasol Database Container..." -ForegroundColor Blue
$container = docker ps -aq -f name=exasoldb
if (!$container) {
    Write-Host "Downloading and starting Exasol container (this takes a moment)..."
    docker run --name exasoldb -p 8563:8563 --detach --privileged --stop-timeout 120 exasol/docker-db:latest
} else {
    Write-Host "Starting existing Exasol container..."
    docker start exasoldb | Out-Null
}

if (-not $SkipSetup) {
    Write-Host "Waiting 10 seconds for Exasol DB to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# 3. Python Backend Setup
Write-Host "`n[2/4] Setting up Python AI Gateway environment..." -ForegroundColor Blue
if (-not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv venv
}

Write-Host "Activating venv and installing dependencies..."
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt | Out-Null

Write-Host "`n[3/4] Seeding the Exasol Database with test data..." -ForegroundColor Blue
python setup_demo_schema.py

# 4. Frontend UI
Write-Host "`n[4/4] Starting Zero-Trust Attack Arena UI..." -ForegroundColor Blue
Set-Location .\aegis-ui
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing NPM dependencies..."
    npm install | Out-Null
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  ENVIRONMENT LIVE! Opening your browser... " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

Start-Process "http://localhost:3000"
npm run dev
