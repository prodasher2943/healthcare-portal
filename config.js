// Gemini API Configuration
// Get your API key from: https://makersuite.google.com/app/apikey
// Replace 'YOUR_GEMINI_API_KEY' with your actual API key

const CONFIG = {
    GEMINI_API_KEY: 'AIzaSyBz2pAwjJSDuOl1iAUKFmpdxUps-TqdbCk', // Replace with your Gemini API key
    // Working model - gemini-2.5-pro confirmed working with your API key!
    GEMINI_MODEL: 'gemini-2.5-pro', // ✅ Tested and working!
    GEMINI_API_URL: function() {
        // Using v1beta API endpoint
        return `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent?key=${this.GEMINI_API_KEY}`;
    }
};

// Check if API key is set
if (CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn('⚠️ Please set your Gemini API key in config.js');
}

