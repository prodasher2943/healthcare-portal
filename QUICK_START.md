# Quick Start Guide - Internet Connectivity

## 🚀 Two Options: Local or Worldwide

### Option 1: Local Testing (Same Network)
For testing on your local network only.

### Option 2: Deploy to Internet (Recommended) 🌍
**For connecting people on DIFFERENT devices and DIFFERENT networks worldwide!**

👉 **See `ONE_CLICK_DEPLOY.md` for 5-minute deployment to Railway**

---

## 📍 Local Testing Setup

### Step 1: Install Node.js
Download and install Node.js from https://nodejs.org/ (version 14 or higher)

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### Step 4: Test Locally
1. **Open Browser 1**: Go to `http://localhost:3000`
   - Login as a **Patient**
   - Request a consultation

2. **Open Browser 2**: Go to `http://localhost:3000`
   - Login as a **Doctor**
   - You should see the consultation request **instantly**!

**Note**: This only works on the same computer or same local network.

---

## 🌐 Deploy to Internet (Connect Anyone, Anywhere!)

### Quick Deploy (5 minutes)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Healthcare Portal"
   git remote add origin YOUR_GITHUB_REPO
   git push -u origin main
   ```

2. **Deploy on Railway**:
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub"
   - Select your repo
   - **Done!** Get your URL: `https://your-app.railway.app`

3. **Update API URL**:
   - Run: `node update-api-url.js`
   - Or manually edit `api-client.js` line 7:
     ```javascript
     const API_BASE_URL = 'https://your-app.railway.app';
     ```

4. **Push update**:
   ```bash
   git add api-client.js
   git commit -m "Update API URL"
   git push
   ```

**That's it!** Now anyone can access from:
- ✅ Different devices (phone, laptop, tablet)
- ✅ Different networks (home WiFi, mobile data, office)
- ✅ Different locations (any city, any country)
- ✅ Anywhere with internet!

### Detailed Guides
- **Quick Deploy**: See `ONE_CLICK_DEPLOY.md`
- **All Options**: See `DEPLOY_INTERNET.md`
- **Setup Details**: See `SETUP_INTERNET.md`

## 📝 What Changed?

- ✅ **Backend Server**: Handles all data storage and real-time communication
- ✅ **Socket.io**: Enables instant notifications
- ✅ **API Client**: Replaces localStorage with API calls
- ✅ **Fallback Support**: Still works with localStorage if server is down

## 🎯 Features Now Working

- ✅ Cross-browser communication
- ✅ Real-time notifications
- ✅ Online status tracking
- ✅ Internet connectivity
- ✅ Works on different devices

## ❓ Troubleshooting

**Server won't start?**
- Make sure Node.js is installed: `node --version`
- Check if port 3000 is free
- Try: `npm install` again

**Not connecting?**
- Check browser console (F12) for errors
- Make sure server is running
- Verify Socket.io is loaded in browser console

**Need help?** Check `SETUP_INTERNET.md` for detailed instructions.
