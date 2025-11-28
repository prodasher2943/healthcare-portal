# Healthcare Portal - Web Application

A beautiful healthcare web application with AI-powered diagnosis, medicine scheduling, and doctor consultation features.

## Features

### For Patients:
- 🤖 **AI Doctor Chatbot**: Get instant health diagnosis, treatment suggestions, and medication information using Google's Gemini AI
- 💊 **Medicine Schedule**: Track your ongoing medications with dates, times, and dosage information
- 👨‍⚕️ **Consult Real Doctors**: After AI diagnosis, request consultations with real doctors

### For Doctors:
- 📋 **Consultation Requests**: View and manage patient consultation requests
- 📜 **History**: Track all consultation history
- 📝 **Chat Summaries**: Review AI chat summaries before accepting consultations

## Setup Instructions

### 1. Get Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

### 2. Configure API Key
1. Open `config.js` file
2. Replace `YOUR_GEMINI_API_KEY` with your actual API key:
   ```javascript
   const CONFIG = {
       GEMINI_API_KEY: 'your-actual-api-key-here',
       // ...
   };
   ```

### 3. Run the Application
1. Simply open `index.html` in your web browser
2. Or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   ```
3. Navigate to `http://localhost:8000` in your browser

## Usage

### Sign Up
1. Open the application
2. Click "Sign Up" tab
3. Select your role (Patient or Doctor)
4. Fill in the required information
5. For doctors, upload proof of education document
6. Click "Sign Up"

### Patient Dashboard
- **Left Panel**: View and manage your medicine schedule
- **Center Panel**: Chat with AI Doctor for diagnosis
- **Right Panel**: Request consultation with real doctors (appears after AI diagnosis)

### Doctor Dashboard
- **Left Panel**: View pending consultation requests with chat summaries
- **Right Panel**: View consultation history

## Technologies Used
- HTML5
- CSS3 (with animations)
- JavaScript (Vanilla)
- Google Gemini AI API
- LocalStorage for data persistence

## Notes
- All data is stored locally in your browser (LocalStorage)
- Video call feature is a placeholder and will be implemented later
- Make sure to set your Gemini API key before using the chatbot feature

## Browser Compatibility
- Chrome (recommended)
- Firefox
- Edge
- Safari

---

**Note**: This is a demo application. For production use, implement proper backend services, database storage, and security measures.

