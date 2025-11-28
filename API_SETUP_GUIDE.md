# Gemini API Setup Guide

## Your API Key Status
✅ **Your API key is VALID and working!**

The error you saw with `gemini-2.0-flash-exp` was a **quota error**, not an authentication error. This means:
- Your API key is correct
- The API is accessible
- But you may have reached free tier limits or need to enable billing

## Steps to Fix

### Option 1: Enable the API in Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in the correct project
3. Go to "APIs & Services" → "Library"
4. Search for "Generative Language API"
5. Click "Enable"

### Option 2: Check Free Tier Quota
1. Go to [Google AI Studio Usage](https://aistudio.google.com/app/apikey)
2. Check your current usage and quota limits
3. The free tier may have different models available

### Option 3: Use a Different Model
Some models may be available on the free tier. Try:
- `gemini-1.5-flash-8b` (smaller, faster model)
- `gemini-exp-*` (experimental models)
- Check what's available via the List Models endpoint

## Quick Fix
1. Open `test-api.html`
2. Click **"List Available Models"** first to see what models your API key has access to
3. Then try the test with those specific models

## Alternative: Use a Different API Key
If you have access to multiple projects, you can:
1. Create a new API key in Google AI Studio
2. Make sure the API is enabled for that project
3. Update `config.js` with the new key


