# Start FastAPI Backend
Write-Host "Starting FastAPI backend on port 8000..." -ForegroundColor Cyan
Set-Location "$(Split-Path $MyInvocation.MyCommand.Path)"

# Activate conda/env if needed, then start uvicorn
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
