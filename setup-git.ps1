# Git Setup Script for Healthcare Portal
# Run this script to set up Git and push to GitHub

Write-Host "🚀 Setting up Git for Healthcare Portal" -ForegroundColor Green
Write-Host ""

# Step 1: Initialize Git
Write-Host "Step 1: Initializing Git repository..." -ForegroundColor Yellow
git init

# Step 2: Add all files
Write-Host "Step 2: Adding all files..." -ForegroundColor Yellow
git add .

# Step 3: Create initial commit
Write-Host "Step 3: Creating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Healthcare Portal with internet connectivity"

# Step 4: Rename branch to main
Write-Host "Step 4: Setting branch to 'main'..." -ForegroundColor Yellow
git branch -M main

# Step 5: Remove old remote if exists
Write-Host "Step 5: Cleaning up old remotes..." -ForegroundColor Yellow
git remote remove origin 2>$null

# Step 6: Add GitHub remote
Write-Host "Step 6: Adding GitHub remote..." -ForegroundColor Yellow
$repoUrl = "https://github.com/prodasher2943/healthcare-portal.git"
git remote add origin $repoUrl

# Step 7: Show status
Write-Host ""
Write-Host "✅ Git setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Current status:" -ForegroundColor Cyan
git remote -v
Write-Host ""
git log --oneline -1
Write-Host ""

# Step 8: Push instructions
Write-Host "📤 Next step: Push to GitHub" -ForegroundColor Yellow
Write-Host "Run this command:" -ForegroundColor White
Write-Host "  git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you get authentication errors:" -ForegroundColor Yellow
Write-Host "1. Go to: https://github.com/settings/tokens" -ForegroundColor White
Write-Host "2. Generate new token (classic)" -ForegroundColor White
Write-Host "3. Select 'repo' scope" -ForegroundColor White
Write-Host "4. Use token as password when pushing" -ForegroundColor White
Write-Host ""
