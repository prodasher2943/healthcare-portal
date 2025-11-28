#!/usr/bin/env node
// Helper script to update API_BASE_URL in api-client.js

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const apiClientPath = path.join(__dirname, 'api-client.js');

console.log('🌐 Update API Base URL for Internet Deployment\n');
console.log('Current setup: Uses window.location.origin (same origin)\n');
console.log('For internet deployment, you need to set your cloud server URL\n');
console.log('Examples:');
console.log('  - Railway: https://your-app.railway.app');
console.log('  - Render: https://your-app.onrender.com');
console.log('  - Heroku: https://your-app.herokuapp.com\n');

rl.question('Enter your deployed server URL (or press Enter to keep current): ', (url) => {
    if (!url.trim()) {
        console.log('✅ Keeping current configuration');
        rl.close();
        return;
    }

    // Validate URL
    try {
        new URL(url);
    } catch (e) {
        console.error('❌ Invalid URL format. Please include https://');
        rl.close();
        return;
    }

    // Read current file
    let content = fs.readFileSync(apiClientPath, 'utf8');
    
    // Update API_BASE_URL
    const newLine = `const API_BASE_URL = '${url}'; // Deployed server URL`;
    content = content.replace(
        /const API_BASE_URL = .*;.*/,
        newLine
    );

    // Write back
    fs.writeFileSync(apiClientPath, content, 'utf8');
    
    console.log(`\n✅ Updated api-client.js with URL: ${url}`);
    console.log('\n📝 Next steps:');
    console.log('  1. Commit the change: git add api-client.js');
    console.log('  2. Commit: git commit -m "Update API URL for deployment"');
    console.log('  3. Push: git push');
    console.log('  4. Your platform will auto-deploy!\n');
    
    rl.close();
});
