// Healthcare Portal Backend Server
// Enables real-time communication between doctors and patients over the internet

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files

// In-memory storage (replace with database in production)
let usersDB = {};
let consultations = [];
let activeCalls = {};
let onlineUsers = new Map(); // Map of email -> socketId

// REST API Routes

// Get all users
app.get('/api/users', (req, res) => {
    res.json(usersDB);
});

// Register/Update user
app.post('/api/users/register', (req, res) => {
    const { email, userData, userType } = req.body;
    if (!email || !userData || !userType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    usersDB[email] = {
        email,
        user_data: userData,
        user_type: userType,
        registered_date: new Date().toISOString()
    };
    
    res.json({ success: true, user: usersDB[email] });
});

// Get consultations
app.get('/api/consultations', (req, res) => {
    const { userEmail, userType } = req.query;
    
    let filteredConsultations = consultations;
    
    if (userType === 'Doctor') {
        filteredConsultations = consultations.filter(c => c.doctorEmail === userEmail);
    } else if (userType === 'Patient') {
        filteredConsultations = consultations.filter(c => c.patientEmail === userEmail);
    }
    
    res.json(filteredConsultations);
});

// Create consultation request
app.post('/api/consultations', (req, res) => {
    const consultation = {
        ...req.body,
        id: Date.now(),
        status: 'pending',
        requestedDate: new Date().toISOString()
    };
    
    consultations.push(consultation);
    
    // Notify doctor in real-time
    const doctorSocketId = onlineUsers.get(consultation.doctorEmail);
    if (doctorSocketId) {
        io.to(doctorSocketId).emit('newConsultationRequest', consultation);
    }
    
    res.json({ success: true, consultation });
});

// Update consultation status
app.put('/api/consultations/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const consultation = consultations.find(c => c.id === parseInt(id));
    if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
    }
    
    consultation.status = status;
    if (status === 'accepted') {
        consultation.acceptedDate = new Date().toISOString();
    } else if (status === 'rejected') {
        consultation.rejectedDate = new Date().toISOString();
    }
    
    // Notify patient in real-time
    const patientSocketId = onlineUsers.get(consultation.patientEmail);
    if (patientSocketId) {
        io.to(patientSocketId).emit('consultationStatusUpdate', consultation);
    }
    
    res.json({ success: true, consultation });
});

// Video call management
app.post('/api/calls/start', (req, res) => {
    const { consultationId } = req.body;
    const callId = `call_${Date.now()}`;
    
    activeCalls[callId] = {
        consultationId,
        startTime: new Date().toISOString(),
        ended: false
    };
    
    res.json({ success: true, callId });
});

app.post('/api/calls/end', (req, res) => {
    const { callId } = req.body;
    
    if (activeCalls[callId]) {
        activeCalls[callId].ended = true;
        activeCalls[callId].endTime = new Date().toISOString();
        
        // Notify both parties
        io.emit('callEnded', { callId });
    }
    
    res.json({ success: true });
});

app.get('/api/calls/:callId', (req, res) => {
    const { callId } = req.params;
    res.json(activeCalls[callId] || { ended: false });
});

// Get online doctors
app.get('/api/doctors/online', (req, res) => {
    const onlineDoctors = [];
    onlineUsers.forEach((socketId, email) => {
        if (usersDB[email] && usersDB[email].user_type === 'Doctor') {
            onlineDoctors.push(email);
        }
    });
    res.json(onlineDoctors);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // User goes online
    socket.on('userOnline', ({ email, userType }) => {
        onlineUsers.set(email, socket.id);
        socket.email = email;
        socket.userType = userType;
        
        console.log(`User online: ${email} (${userType})`);
        
        // Notify others if doctor came online
        if (userType === 'Doctor') {
            io.emit('doctorOnline', email);
        }
    });
    
    // User goes offline
    socket.on('disconnect', () => {
        if (socket.email) {
            onlineUsers.delete(socket.email);
            console.log(`User offline: ${socket.email}`);
            
            // Notify if doctor went offline
            if (socket.userType === 'Doctor') {
                io.emit('doctorOffline', socket.email);
            }
        }
    });
    
    // Real-time consultation updates
    socket.on('refreshConsultations', ({ userEmail, userType }) => {
        let filteredConsultations = consultations;
        
        if (userType === 'Doctor') {
            filteredConsultations = consultations.filter(c => c.doctorEmail === userEmail);
        } else if (userType === 'Patient') {
            filteredConsultations = consultations.filter(c => c.patientEmail === userEmail);
        }
        
        socket.emit('consultationsUpdated', filteredConsultations);
    });
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Healthcare Portal Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for real-time connections`);
    console.log(`🌐 Accessible at: http://localhost:${PORT}`);
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        console.log(`🌍 Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`🌍 Public URL: ${process.env.RENDER_EXTERNAL_URL}`);
    }
});
