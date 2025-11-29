# API Key Security Guide

## ✅ Security Implementation

The Gemini API key is now **completely secure** and stored server-side only. It is never exposed to the client.

## 🔒 How It Works

1. **Server-Side Storage**: The API key is stored as an environment variable on the server
2. **Proxy Endpoints**: All Gemini API calls go through secure server endpoints:
   - `/api/gemini/chat` - For chat messages
   - `/api/gemini/title` - For generating chat titles
   - `/api/gemini/summary` - For generating chat summaries
3. **Client Calls**: The client code calls these server endpoints, never directly to Gemini API

## 📝 Configuration

### Local Development

1. Create a `.env` file in the project root (copy from `.env.example`)
2. Add your API key:
   ```bash
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. Load environment variables (if using dotenv package):
   ```bash
   npm install dotenv
   ```
   Then add to `server.js`:
   ```javascript
   require('dotenv').config();
   ```

   Or set directly:
   ```bash
   export GEMINI_API_KEY=your_actual_api_key_here
   node server.js
   ```

### Railway Deployment

1. Go to your Railway project
2. Navigate to **Variables** tab
3. Add new variable:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your actual Gemini API key
4. Save and redeploy

### Render Deployment

1. Go to your Render dashboard
2. Select your service
3. Go to **Environment** section
4. Add environment variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your actual Gemini API key
5. Save and redeploy

### Other Platforms

Set the `GEMINI_API_KEY` environment variable in your hosting platform's environment variable settings.

## ⚠️ Important Notes

- **Never commit** `.env` file to git
- **Never expose** the API key in client-side code
- **Never hardcode** the API key in any file
- The API key should **only** be set as an environment variable

## 🔍 Verification

After deployment, check server logs. You should see:
- ✅ `Gemini API key configured` - API key is set correctly
- ⚠️ `WARNING: GEMINI_API_KEY environment variable not set` - API key is missing

## 🚨 If API Key is Missing

If you see errors about missing API key:
1. Verify the environment variable is set correctly
2. Check for typos in the variable name (must be exactly `GEMINI_API_KEY`)
3. Restart/redeploy the server after setting the variable
4. Check server logs for confirmation

## 📚 Get Your API Key

Get your Gemini API key from: https://makersuite.google.com/app/apikey
