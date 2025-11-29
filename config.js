// Gemini API Configuration
// ⚠️ SECURITY: API key is now stored server-side only (in environment variables)
// 
// To configure the API key:
// 1. Set the GEMINI_API_KEY environment variable on your server
// 2. For local development: export GEMINI_API_KEY=your_key_here
// 3. For Railway/Render: Add it in the environment variables section
//
// Get your API key from: https://makersuite.google.com/app/apikey
//
// The API key is no longer stored in this file for security reasons.
// All Gemini API calls are now proxied through server endpoints:
// - /api/gemini/chat
// - /api/gemini/title
// - /api/gemini/summary

const CONFIG = {
    // Model can still be configured via environment variable GEMINI_MODEL on server
    // Default is 'gemini-2.5-pro'
    GEMINI_MODEL: 'gemini-2.5-pro'
};

// Note: This file is kept for backward compatibility but the API key
// should never be stored here. It must be set as an environment variable.