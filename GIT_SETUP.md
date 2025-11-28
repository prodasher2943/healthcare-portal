# Git Setup Guide - Fix "main does not match any" Error

## The Problem
The error `src refspec main does not match any` means you haven't created any commits yet, or the branch doesn't exist.

## Solution - Run These Commands

### Step 1: Initialize Git (if not already done)
```powershell
git init
```

### Step 2: Add All Files
```powershell
git add .
```

### Step 3: Create First Commit
```powershell
git commit -m "Initial commit: Healthcare Portal with internet connectivity"
```

### Step 4: Rename Branch to Main (if needed)
```powershell
git branch -M main
```

### Step 5: Add Remote Repository
**Replace `YOUR_GITHUB_REPO_URL` with your actual GitHub repository URL**

First, create a repository on GitHub:
1. Go to https://github.com/new
2. Name it: `healthcare-portal`
3. Don't initialize with README
4. Click "Create repository"
5. Copy the repository URL (e.g., `https://github.com/yourusername/healthcare-portal.git`)

Then run:
```powershell
git remote add origin https://github.com/yourusername/healthcare-portal.git
```

### Step 6: Push to GitHub
```powershell
git push -u origin main
```

## Complete Command Sequence

Copy and paste these commands one by one (replace the GitHub URL):

```powershell
# Initialize repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: Healthcare Portal with internet connectivity"

# Ensure we're on main branch
git branch -M main

# Add your GitHub repository (REPLACE WITH YOUR URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

## If You Already Have a Remote

If you already added a remote but it's wrong, remove it first:

```powershell
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Verify It Worked

After pushing, you should see:
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
...
To https://github.com/...
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

## Next Steps

Once pushed to GitHub:
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-deploy!

Then update `api-client.js` with your Railway URL and push again.

## Troubleshooting

**"fatal: remote origin already exists"**
- Run: `git remote remove origin`
- Then add it again with the correct URL

**"Authentication failed"**
- Use GitHub Personal Access Token instead of password
- Or use SSH: `git remote add origin git@github.com:USERNAME/REPO.git`

**"Permission denied"**
- Make sure you have write access to the repository
- Check that the repository URL is correct
