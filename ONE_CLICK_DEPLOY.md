# One-Click Deploy to Internet 🌐

Deploy your Healthcare Portal to the cloud in **under 5 minutes** so people can connect from anywhere!

## 🚀 Railway (Recommended - Easiest)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Healthcare Portal"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. **Done!** Railway auto-deploys

### Step 3: Get Your URL
- Railway gives you a URL like: `https://healthcare-portal-production.up.railway.app`
- Copy this URL

### Step 4: Update Frontend
Edit `api-client.js` line 6:
```javascript
const API_BASE_URL = 'https://healthcare-portal-production.up.railway.app';
```

### Step 5: Redeploy Frontend
If frontend is on Railway too, just push again:
```bash
git add api-client.js
git commit -m "Update API URL"
git push
```

**That's it!** Your app is now accessible worldwide! 🌍

---

## 🎯 Test It

1. **Device 1** (any network): Open your Railway URL
   - Login as Patient
   - Request consultation

2. **Device 2** (different network): Open same Railway URL
   - Login as Doctor
   - See request instantly!

---

## 📱 Share with Others

Just share your Railway URL:
- `https://your-app.railway.app`

Anyone can access it from:
- ✅ Different devices
- ✅ Different networks
- ✅ Different countries
- ✅ Mobile data
- ✅ WiFi
- ✅ Anywhere with internet!

---

## 🔄 Update After Deployment

After deploying, update `api-client.js`:

```javascript
// Change from:
const API_BASE_URL = window.location.origin;

// To:
const API_BASE_URL = 'https://your-actual-railway-url.railway.app';
```

Then commit and push:
```bash
git add api-client.js
git commit -m "Update API URL for production"
git push
```

Railway will auto-redeploy!

---

## 💡 Pro Tips

1. **Custom Domain**: Railway lets you add a custom domain
2. **Environment Variables**: Use Railway's dashboard for secrets
3. **Auto-Deploy**: Every git push auto-deploys
4. **Logs**: View logs in Railway dashboard
5. **Free Tier**: Railway free tier is generous for testing

---

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Support: Check Railway dashboard
- Status: https://status.railway.app

---

## ✅ Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Deployment successful
- [ ] Got Railway URL
- [ ] Updated `api-client.js` with Railway URL
- [ ] Tested from two different devices/networks
- [ ] Working! 🎉
