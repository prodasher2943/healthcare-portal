# Setting Up Internet Connectivity

This guide will help you set up the Healthcare Portal to work over the internet, allowing doctors and patients to connect from different browsers and devices.

## Current Limitation

The current system uses `localStorage`, which only works within the same browser. To enable real internet connectivity, we need a backend server.

## Setup Instructions

### Step 1: Install Dependencies

Open terminal in the project directory and run:

```bash
npm install
```

This will install:
- `express` - Web server
- `socket.io` - Real-time communication
- `cors` - Cross-origin resource sharing

### Step 2: Install Socket.io Client for Frontend

Add this to your `dashboard.html` before the closing `</body>` tag:

```html
<script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
<script src="api-client.js"></script>
```

### Step 3: Start the Server

Run the server:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Step 4: Access the Application

1. Open your browser and go to `http://localhost:3000`
2. The server will serve your HTML files
3. Real-time communication will work automatically

## How It Works

### Backend Server (`server.js`)
- Handles user registration
- Manages consultation requests
- Tracks online users
- Provides real-time updates via WebSocket

### API Client (`api-client.js`)
- Replaces localStorage calls with API calls
- Maintains Socket.io connection for real-time updates
- Falls back to localStorage if server is unavailable

### Real-Time Features
- **New Consultation Requests**: Doctors receive instant notifications
- **Status Updates**: Patients see when doctors accept/reject requests
- **Online Status**: Shows which doctors are currently online
- **Call Management**: Synchronizes video call state between parties

## Deployment Options

### Option 1: Local Network
1. Find your computer's IP address:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig`
2. Update `API_BASE_URL` in `api-client.js` to use your IP
3. Others on the same network can access via `http://YOUR_IP:3000`

### Option 2: Cloud Hosting (Recommended)

#### Using Heroku:
```bash
# Install Heroku CLI
heroku create healthcare-portal
git push heroku main
```

#### Using Railway:
1. Go to railway.app
2. Connect your GitHub repo
3. Deploy automatically

#### Using Render:
1. Go to render.com
2. Create new Web Service
3. Connect your repo
4. Set start command: `node server.js`

### Option 3: VPS/Cloud Server
1. Deploy to AWS, DigitalOcean, or similar
2. Use PM2 to keep server running: `pm2 start server.js`
3. Set up domain name and SSL certificate

## Testing

1. **Start the server**: `npm start`
2. **Open two different browsers** (or use incognito mode)
3. **Browser 1**: Login as Patient
4. **Browser 2**: Login as Doctor
5. **Send consultation request** from Patient
6. **Doctor should see it instantly** without refresh!

## Features Enabled

✅ **Cross-browser communication** - Works in different browsers
✅ **Real-time updates** - Instant notifications
✅ **Online status** - See who's online
✅ **Internet connectivity** - Works over network/internet
✅ **Fallback support** - Falls back to localStorage if server unavailable

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Change PORT in server.js if needed
- Make sure Node.js is installed: `node --version`

### Real-time not working
- Check browser console for errors
- Verify Socket.io is loaded: `typeof io !== 'undefined'`
- Check server logs for connection errors

### CORS errors
- Server already has CORS enabled
- If issues persist, check browser console

## Next Steps

For production:
1. Add authentication (JWT tokens)
2. Use a real database (MongoDB, PostgreSQL)
3. Add SSL/HTTPS
4. Implement rate limiting
5. Add logging and monitoring
