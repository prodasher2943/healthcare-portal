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
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: '*', // Allow all origins (for development and deployment)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
// Serve static files (CSS, JS, images, etc.)
// This must come before the catch-all route
app.use(express.static(__dirname, {
    index: false, // Don't serve index.html automatically (we handle it explicitly)
    extensions: ['html', 'js', 'css', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg']
}));

// Gemini API Configuration (server-side only - never expose to client)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
    const { email, userData, userType, passwordHash } = req.body;
    if (!email || !userData || !userType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get existing user to preserve password if updating
    const existing = usersDB[email];
    
    // IMPORTANT: Always store password hash if provided
    // Priority: new passwordHash > existing password_hash > null
    const finalPasswordHash = passwordHash || existing?.password_hash || null;
    
    if (passwordHash) {
        console.log(`🔐 Storing NEW password hash for ${email} (length: ${passwordHash.length})`);
    } else if (existing?.password_hash) {
        console.log(`🔐 Preserving existing password hash for ${email} (length: ${existing.password_hash.length})`);
    } else {
        console.warn(`⚠️ WARNING: No password hash provided or existing for ${email} - cross-device login will NOT work!`);
    }
    
    usersDB[email] = {
        email,
        user_data: userData,
        user_type: userType,
        password_hash: finalPasswordHash, // Store hashed password for cross-device login
        registered_date: existing?.registered_date || new Date().toISOString()
    };
    
    // Verify password_hash was stored
    if (usersDB[email].password_hash) {
        console.log(`✅ Password hash stored successfully for ${email} (length: ${usersDB[email].password_hash.length})`);
    } else {
        console.error(`❌ CRITICAL ERROR: Password hash NOT stored for ${email}! Cross-device login will fail!`);
    }
    
    res.json({ success: true, user: usersDB[email] });
});

// Login endpoint (for cross-device login)
app.post('/api/users/login', (req, res) => {
    const { email, passwordHash } = req.body;
    
    if (!email || !passwordHash) {
        return res.status(400).json({ error: 'Email and password hash are required' });
    }
    
    console.log(`🔑 Login attempt for: ${email}`);
    console.log(`🔑 Provided hash length: ${passwordHash?.length || 0}`);
    
    const user = usersDB[email];
    
    if (!user) {
        console.log(`❌ User not found: ${email}`);
        return res.status(404).json({ error: 'Email not found. Please register first.' });
    }
    
    console.log(`📋 User found in usersDB. Stored hash exists: ${!!user.password_hash}`);
    if (user.password_hash) {
        console.log(`📋 Stored hash length: ${user.password_hash.length}`);
        console.log(`🔍 Hash comparison: ${user.password_hash === passwordHash ? 'MATCH ✅' : 'MISMATCH ❌'}`);
        
        // Log first few and last few characters for debugging (not the whole hash)
        if (user.password_hash !== passwordHash) {
            console.log(`🔍 Provided hash starts with: ${passwordHash.substring(0, 10)}...`);
            console.log(`🔍 Stored hash starts with: ${user.password_hash.substring(0, 10)}...`);
        }
    }
    
    // Verify password hash matches
    if (!user.password_hash) {
        console.error(`❌ No password_hash stored for user ${email}`);
        return res.status(401).json({ error: 'No password set for this account. Please register again.' });
    }
    
    if (user.password_hash !== passwordHash) {
        console.error(`❌ Password hash mismatch for ${email}`);
        return res.status(401).json({ error: 'Incorrect password.' });
    }
    
    console.log(`✅ Login successful for ${email}`);
    
    // Return user data (without password hash for security)
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
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
        
        // Start call immediately when accepted
        let callId = null;
        for (const [existingCallId, call] of Object.entries(activeCalls)) {
            if (call.consultationId === consultation.id && !call.ended) {
                callId = existingCallId;
                break;
            }
        }
        
        if (!callId) {
            callId = `call_${consultation.id}_${Date.now()}`;
            activeCalls[callId] = {
                consultationId: consultation.id,
                startTime: new Date().toISOString(),
                ended: false
            };
        }
        
        // Notify BOTH patient and doctor via Socket.io about call start
        const patientSocketId = onlineUsers.get(consultation.patientEmail);
        const doctorSocketId = onlineUsers.get(consultation.doctorEmail);
        
        console.log(`📞 Consultation accepted - Notifying participants. Patient: ${patientSocketId}, Doctor: ${doctorSocketId}`);
        
        // Notify patient with call info
        if (patientSocketId) {
            io.to(patientSocketId).emit('consultationStatusUpdate', consultation);
            io.to(patientSocketId).emit('callStarted', { 
                callId: callId, 
                consultationId: consultation.id,
                consultation: consultation
            });
            console.log(`✅ Notified patient at socket ${patientSocketId}`);
        } else {
            console.warn(`⚠️ Patient ${consultation.patientEmail} not online`);
        }
        
        // Notify doctor with call info (they may need it too)
        if (doctorSocketId) {
            io.to(doctorSocketId).emit('callStarted', { 
                callId: callId, 
                consultationId: consultation.id,
                consultation: consultation
            });
        }
        
    } else if (status === 'rejected') {
        consultation.rejectedDate = new Date().toISOString();
        
        // Notify patient in real-time
        const patientSocketId = onlineUsers.get(consultation.patientEmail);
        if (patientSocketId) {
            io.to(patientSocketId).emit('consultationStatusUpdate', consultation);
        }
    }
    
    res.json({ success: true, consultation });
});

// Video call management
app.post('/api/calls/start', (req, res) => {
    const { consultationId } = req.body;
    
    // Use consultationId as callId for easier matching
    // If consultation already has an active call, reuse it
    let callId = null;
    for (const [existingCallId, call] of Object.entries(activeCalls)) {
        if (call.consultationId === consultationId && !call.ended) {
            callId = existingCallId;
            break;
        }
    }
    
    // Create new call if none exists
    if (!callId) {
        callId = `call_${consultationId}_${Date.now()}`;
    }
    
    activeCalls[callId] = {
        consultationId: parseInt(consultationId) || consultationId,
        startTime: new Date().toISOString(),
        ended: false
    };
    
    res.json({ success: true, callId, consultationId: parseInt(consultationId) || consultationId });
});

app.post('/api/calls/end', (req, res) => {
    const { callId } = req.body;
    
    console.log('📞 Call end requested for callId:', callId);
    
    // Find call by callId or consultationId
    let callToEnd = activeCalls[callId];
    let callIdToNotify = callId;
    
    // If not found by callId, search by consultationId
    if (!callToEnd) {
        for (const [existingCallId, existingCall] of Object.entries(activeCalls)) {
            if (existingCall.consultationId === parseInt(callId) || 
                existingCall.consultationId === callId ||
                existingCallId.includes(callId) ||
                callId.includes(existingCall.consultationId)) {
                callToEnd = existingCall;
                callIdToNotify = existingCallId;
                break;
            }
        }
    }
    
    if (callToEnd) {
        callToEnd.ended = true;
        callToEnd.endTime = new Date().toISOString();
        
        // Notify both parties via Socket.io - send both callId and consultationId for matching
        console.log('📢 Broadcasting callEnded event to all clients');
        io.emit('callEnded', { 
            callId: callIdToNotify,
            consultationId: callToEnd.consultationId
        });
        
        // Also remove from active calls after a delay to allow polling to catch it
        setTimeout(() => {
            delete activeCalls[callIdToNotify];
        }, 5000);
    } else {
        console.log('⚠️ Call not found in activeCalls for:', callId);
        // Still notify in case client is using this callId
        io.emit('callEnded', { callId: callId, consultationId: parseInt(callId) || callId });
    }
    
    res.json({ success: true });
});

app.get('/api/calls/:callId', (req, res) => {
    const { callId } = req.params;
    
    // Check by callId first
    let call = activeCalls[callId];
    
    // If not found, check by consultationId
    if (!call) {
        for (const [existingCallId, existingCall] of Object.entries(activeCalls)) {
            if (existingCall.consultationId === parseInt(callId) || existingCall.consultationId === callId) {
                call = existingCall;
                break;
            }
        }
    }
    
    res.json(call || { ended: false });
});

// Get online doctors
app.get('/api/doctors/online', (req, res) => {
    const onlineDoctors = [];
    
    // Iterate through all online users
    onlineUsers.forEach((socketId, email) => {
        // Get user from usersDB
        const user = usersDB[email];
        
        if (!user) {
            console.log(`⚠️ User ${email} is online but not in usersDB`);
            return;
        }
        
        // Check multiple ways the user type might be stored
        const userType = user?.user_type || user?.userType;
        const isDoctor = user && (
            (typeof userType === 'string' && userType.toLowerCase() === 'doctor') ||
            user.user_type === 'Doctor' ||
            user.userType === 'Doctor'
        );
        
        if (isDoctor) {
            onlineDoctors.push(email);
            console.log(`📡 Online doctor found: ${email} (socket: ${socketId}, type: ${userType})`);
        } else {
            console.log(`ℹ️ User ${email} is online but not a doctor (type: ${userType})`);
        }
    });
    
    console.log(`📡 API: Returning ${onlineDoctors.length} online doctors:`, onlineDoctors);
    res.json(onlineDoctors);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // User goes online
    socket.on('userOnline', ({ email, userType, userData }) => {
        if (!email) return;

        onlineUsers.set(email, socket.id);
        socket.email = email;
        socket.userType = userType;
        
        console.log(`User online: ${email} (${userType})`);

        // Ensure usersDB has at least a minimal record so this user can be recognized globally
        const existing = usersDB[email];
        const normalizedType = typeof userType === 'string' ? userType : (existing?.user_type || 'User');
        const finalType = normalizedType === 'doctor' ? 'Doctor'
                        : normalizedType === 'patient' ? 'Patient'
                        : normalizedType;

        // Merge user_data from existing, provided userData, or keep empty object
        const mergedUserData = {
            ...(existing?.user_data || {}),
            ...(userData || {})
        };

        // CRITICAL: Preserve password_hash - NEVER overwrite it with null/undefined
        // If existing hash exists, ALWAYS keep it. Only use null if there was never a hash.
        const preservedPasswordHash = (existing && existing.password_hash) ? existing.password_hash : null;
        
        if (existing && existing.password_hash && !preservedPasswordHash) {
            console.error(`❌ CRITICAL: Password hash would be lost for ${email}! Preserving...`);
        }
        
        // Ensure we never accidentally lose the password hash
        const finalPasswordHash = preservedPasswordHash || null;
        
        usersDB[email] = {
            email,
            user_data: mergedUserData,
            user_type: finalType,
            password_hash: finalPasswordHash, // CRITICAL: Always preserve existing hash or keep null
            registered_date: existing?.registered_date || new Date().toISOString()
        };
        
        // Log password hash status
        if (!usersDB[email].password_hash) {
            console.log(`⚠️ No password_hash stored for ${email} yet - user may need to complete registration`);
            console.log(`   If this user should have a password, they need to register via /api/users/register with passwordHash`);
        } else {
            console.log(`✅ Password hash preserved for ${email} (length: ${usersDB[email].password_hash.length})`);
        }
        
        // Notify others if doctor came online - check both normalized and original types
        const isDoctor = finalType.toLowerCase() === 'doctor' || 
                        (typeof userType === 'string' && userType.toLowerCase() === 'doctor') ||
                        (existing && existing.user_type && existing.user_type.toLowerCase() === 'doctor');
        
        if (isDoctor) {
            console.log(`📢 Broadcasting doctor online: ${email}`);
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
    
    // Real-time prescription updates
    socket.on('prescriptionUpdate', ({ callId, prescription, consultationId }) => {
        console.log('📝 Prescription update received:', { callId, consultationId, prescriptionLength: prescription?.length || 0 });
        
        // Store prescription in active call
        if (callId && activeCalls[callId]) {
            activeCalls[callId].prescription = prescription;
            activeCalls[callId].prescriptionUpdatedAt = new Date().toISOString();
        }
        
        // Find call by consultationId if callId doesn't match
        if (consultationId) {
            for (const [existingCallId, call] of Object.entries(activeCalls)) {
                if (call.consultationId === parseInt(consultationId) || call.consultationId === consultationId) {
                    call.prescription = prescription;
                    call.prescriptionUpdatedAt = new Date().toISOString();
                    if (!callId) callId = existingCallId;
                    break;
                }
            }
        }
        
        // Also store in consultation for persistence
        const consultation = consultations.find(c => 
            c.id === parseInt(consultationId) || 
            c.id === consultationId ||
            String(c.id) === String(consultationId)
        );
        if (consultation) {
            consultation.prescription = prescription;
            consultation.prescriptionUpdatedAt = new Date().toISOString();
        }
        
        // Broadcast to all connected clients in this call
        console.log('📢 Broadcasting prescription update:', { callId, consultationId });
        io.emit('prescriptionUpdated', { 
            callId: callId || consultationId, 
            consultationId: consultationId || parseInt(consultationId), 
            prescription: prescription || '' 
        });
    });
    
    // WebRTC Signaling Handlers
    
    // Handle WebRTC offer - relay to the other party
    socket.on('webrtcOffer', ({ callId, consultationId, offer }) => {
        console.log('📥 WebRTC offer received:', { callId, consultationId, fromSocket: socket.id });
        
        const targetConsultationId = consultationId || callId;
        
        // Find the other participant in this call
        const call = activeCalls[callId] || Object.values(activeCalls).find(c => 
            c.consultationId === parseInt(targetConsultationId) || 
            c.consultationId === targetConsultationId
        );
        
        if (call) {
            // Find consultation to get participant emails
            const consultation = consultations.find(c => 
                c.id === parseInt(targetConsultationId) || 
                c.id === targetConsultationId
            );
            
            if (consultation) {
                // Find the other party's socket
                const senderEmail = socket.email;
                const otherEmail = senderEmail === consultation.doctorEmail 
                    ? consultation.patientEmail 
                    : consultation.doctorEmail;
                const otherSocketId = onlineUsers.get(otherEmail);
                
                if (otherSocketId) {
                    // Send directly to the other party
                    io.to(otherSocketId).emit('webrtcOffer', {
                        callId: callId,
                        consultationId: targetConsultationId,
                        offer: offer
                    });
                    console.log(`📤 Relay offer to ${otherEmail} (${otherSocketId})`);
                } else {
                    // Fallback to broadcast if other party not found
                    console.log(`⚠️ Other party ${otherEmail} not online, broadcasting to all`);
                    socket.broadcast.emit('webrtcOffer', {
                        callId: callId,
                        consultationId: targetConsultationId,
                        offer: offer
                    });
                }
            } else {
                // Fallback: broadcast to all
                socket.broadcast.emit('webrtcOffer', {
                    callId: callId,
                    consultationId: targetConsultationId,
                    offer: offer
                });
            }
        } else {
            // Fallback: broadcast to all
            socket.broadcast.emit('webrtcOffer', {
                callId: callId,
                consultationId: targetConsultationId,
                offer: offer
            });
        }
    });
    
    // Handle WebRTC answer - relay to the other party
    socket.on('webrtcAnswer', ({ callId, consultationId, answer }) => {
        console.log('📥 WebRTC answer received:', { callId, consultationId, fromSocket: socket.id });
        
        const targetConsultationId = consultationId || callId;
        
        // Find the other participant in this call
        const call = activeCalls[callId] || Object.values(activeCalls).find(c => 
            c.consultationId === parseInt(targetConsultationId) || 
            c.consultationId === targetConsultationId
        );
        
        if (call) {
            const consultation = consultations.find(c => 
                c.id === parseInt(targetConsultationId) || 
                c.id === targetConsultationId
            );
            
            if (consultation) {
                const senderEmail = socket.email;
                const otherEmail = senderEmail === consultation.doctorEmail 
                    ? consultation.patientEmail 
                    : consultation.doctorEmail;
                const otherSocketId = onlineUsers.get(otherEmail);
                
                if (otherSocketId) {
                    io.to(otherSocketId).emit('webrtcAnswer', {
                        callId: callId,
                        consultationId: targetConsultationId,
                        answer: answer
                    });
                    console.log(`📤 Relay answer to ${otherEmail} (${otherSocketId})`);
                } else {
                    socket.broadcast.emit('webrtcAnswer', {
                        callId: callId,
                        consultationId: targetConsultationId,
                        answer: answer
                    });
                }
            } else {
                socket.broadcast.emit('webrtcAnswer', {
                    callId: callId,
                    consultationId: targetConsultationId,
                    answer: answer
                });
            }
        } else {
            socket.broadcast.emit('webrtcAnswer', {
                callId: callId,
                consultationId: targetConsultationId,
                answer: answer
            });
        }
    });
    
    // Handle ICE candidate - relay to the other party
    socket.on('iceCandidate', ({ callId, consultationId, candidate }) => {
        console.log('🧊 ICE candidate received:', { callId, consultationId, fromSocket: socket.id });
        
        const targetConsultationId = consultationId || callId;
        
        // Find the other participant in this call
        const call = activeCalls[callId] || Object.values(activeCalls).find(c => 
            c.consultationId === parseInt(targetConsultationId) || 
            c.consultationId === targetConsultationId
        );
        
        if (call) {
            const consultation = consultations.find(c => 
                c.id === parseInt(targetConsultationId) || 
                c.id === targetConsultationId
            );
            
            if (consultation) {
                const senderEmail = socket.email;
                const otherEmail = senderEmail === consultation.doctorEmail 
                    ? consultation.patientEmail 
                    : consultation.doctorEmail;
                const otherSocketId = onlineUsers.get(otherEmail);
                
                if (otherSocketId) {
                    io.to(otherSocketId).emit('iceCandidate', {
                        callId: callId,
                        consultationId: targetConsultationId,
                        candidate: candidate
                    });
                } else {
                    socket.broadcast.emit('iceCandidate', {
                        callId: callId,
                        consultationId: targetConsultationId,
                        candidate: candidate
                    });
                }
            } else {
                socket.broadcast.emit('iceCandidate', {
                    callId: callId,
                    consultationId: targetConsultationId,
                    candidate: candidate
                });
            }
        } else {
            socket.broadcast.emit('iceCandidate', {
                callId: callId,
                consultationId: targetConsultationId,
                candidate: candidate
            });
        }
    });
});

// Serve index.html for root and dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Catch-all: serve index.html for any non-API routes (for SPA routing)
app.get('*', (req, res) => {
    // Don't serve HTML for API routes
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Serve index.html for all other routes (SPA fallback)
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Gemini API Endpoints (server-side proxy to keep API key secure)

// Chat endpoint
app.post('/api/gemini/chat', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.' });
    }
    
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        const requestPayload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };
        
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API error:', errorData);
            return res.status(response.status).json({ error: 'Failed to get response from Gemini API' });
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Internal server error while calling Gemini API' });
    }
});

// Generate title endpoint
app.post('/api/gemini/title', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        const requestPayload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };
        
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API error:', errorData);
            return res.status(response.status).json({ error: 'Failed to generate title' });
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Internal server error while calling Gemini API' });
    }
});

// Generate summary endpoint
app.post('/api/gemini/summary', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        const requestPayload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };
        
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API error:', errorData);
            return res.status(response.status).json({ error: 'Failed to generate summary' });
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Internal server error while calling Gemini API' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Healthcare Portal Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for real-time connections`);
    console.log(`🌐 Accessible at: http://localhost:${PORT}`);
    
    // Check if Gemini API key is configured
    if (!GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY environment variable not set. Gemini AI features will not work.');
        console.warn('   Set it using: export GEMINI_API_KEY=your_key_here');
        console.warn('   Or add it to Railway/Render environment variables.');
    } else {
        console.log('✅ Gemini API key configured');
    }
    
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        console.log(`🌍 Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`🌍 Public URL: ${process.env.RENDER_EXTERNAL_URL}`);
    }
});
