# Enable Billing to Fix Quota Issues

## Why Enable Billing?
- Your API key is valid but hitting free tier limits
- Enabling billing gives you **MUCH HIGHER free tier quotas**
- You still get free usage up to generous limits
- No charges unless you exceed the free tier (which is unlikely for testing)

## Steps to Enable Billing

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Make sure you're logged in with the same account that created the API key

### Step 2: Select Your Project
1. Click the project dropdown at the top
2. Select the project where your API key is from
3. If you don't know, check in Google AI Studio (where you got the API key)

### Step 3: Enable Billing
1. Go to **"Billing"** in the left menu
2. Click **"Link a billing account"**
3. If you don't have a billing account:
   - Click **"Create billing account"**
   - Fill in your details (can use a credit/debit card)
   - Google won't charge you for free tier usage

### Step 4: Enable the API
1. Go to **"APIs & Services"** → **"Library"**
2. Search for **"Generative Language API"**
3. Click on it and press **"Enable"**

### Step 5: Wait a Few Minutes
- Changes take 2-5 minutes to propagate
- Then try your chatbot again

## Free Tier Limits (With Billing Enabled)
- **60 requests per minute** (instead of 0-15)
- **1,500 requests per day** (instead of 0-50)
- Much better model availability

## Still Free!
- You only pay if you exceed free tier limits
- For testing/development, you'll likely stay within free limits
- Much better than hitting quota errors constantly

## Alternative: Check Available Models
If you don't want to enable billing right now:
1. Open `test-api.html`
2. Click **"List Available Models"**
3. See what models you can use with your current setup
4. Update `config.js` to use an available model

