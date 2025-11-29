// API Client for Healthcare Portal
// Replaces localStorage with backend API calls

// IMPORTANT: Update this URL when deploying to production
// For local development: use window.location.origin
// For production: use your deployed server URL (e.g., 'https://your-app.railway.app')
const API_BASE_URL = 'https://web-production-33464.up.railway.app'; // Change to your deployed URL for internet access

// Initialize Socket.io connection
let socket = null;
let isConnected = false;

function initSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.io not loaded. Install: npm install socket.io-client');
        return;
    }
    
    socket = io(API_BASE_URL);
    
    socket.on('connect', () => {
        isConnected = true;
        console.log('✅ Connected to server');
        
        // Notify server that user is online
        const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        if (userData) {
            socket.emit('userOnline', {
                email: userData.email,
                userType: userData.user_type
            });
        }
    });
    
    socket.on('disconnect', () => {
        isConnected = false;
        console.log('❌ Disconnected from server');
    });
    
    // Listen for new consultation requests (for doctors)
    socket.on('newConsultationRequest', (consultation) => {
        console.log('📬 New consultation request received:', consultation);
        // Refresh consultation requests if on doctor dashboard
        const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        if (userData && userData.user_type === 'Doctor') {
            loadConsultationRequests();
        }
    });
    
    // Listen for consultation status updates (for patients)
    socket.on('consultationStatusUpdate', (consultation) => {
        console.log('📬 Consultation status updated:', consultation);
        // Handle status update
        if (consultation.status === 'accepted') {
            startVideoCall(consultation);
        } else if (consultation.status === 'rejected') {
            document.getElementById('consultation-content').innerHTML = `
                <div class="consultation-rejected">
                    <p>❌ Your consultation request was declined.</p>
                    <button class="btn-primary" onclick="showConsultationModal()">Request Another Consultation</button>
                </div>
            `;
        }
    });
    
    // Listen for call ended
    socket.on('callEnded', ({ callId }) => {
        if (currentCallId === callId) {
            endVideoCall();
        }
    });
    
    // Listen for doctor online/offline status
    socket.on('doctorOnline', (email) => {
        if (onlineDoctors) {
            onlineDoctors.add(email);
            // Refresh doctor list if consultation modal is open
            const consultationModal = document.getElementById('consultation-modal');
            if (consultationModal && consultationModal.style.display === 'block') {
                loadAvailableDoctors();
            }
        }
    });
    
    socket.on('doctorOffline', (email) => {
        if (onlineDoctors) {
            onlineDoctors.delete(email);
            // Refresh doctor list if consultation modal is open
            const consultationModal = document.getElementById('consultation-modal');
            if (consultationModal && consultationModal.style.display === 'block') {
                loadAvailableDoctors();
            }
        }
    });
}

// API Functions

async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request failed:', error);
        // Fallback to localStorage if API fails
        throw error;
    }
}

// User Management (server-side)
// Register/update user profile on the server (no password here - password is handled locally)
async function registerUserOnServer(email, userData, userType) {
    try {
        const result = await apiRequest('/users/register', {
            method: 'POST',
            body: JSON.stringify({ email, userData, userType })
        });
        
        // Also save to localStorage as backup
        const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
        usersDB[email] = result.user;
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
        
        return result.user;
    } catch (error) {
        // Fallback to localStorage
        const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
        usersDB[email] = {
            email,
            user_data: userData,
            user_type: userType,
            registered_date: new Date().toISOString()
        };
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
        return usersDB[email];
    }
}

// Get all users from server (for global doctor list, etc.)
async function getAllUsers() {
    try {
        const users = await apiRequest('/users', {
            method: 'GET'
        });
        return users; // Object keyed by email
    } catch (error) {
        console.error('Failed to fetch users from server:', error);
        // Fallback to localStorage
        return JSON.parse(localStorage.getItem('usersDB') || '{}');
    }
}

// Consultation Management
async function getConsultations(userEmail, userType) {
    try {
        const consultations = await apiRequest(`/consultations?userEmail=${encodeURIComponent(userEmail)}&userType=${userType}`);
        return consultations;
    } catch (error) {
        // Fallback to localStorage
        return JSON.parse(localStorage.getItem('consultations') || '[]');
    }
}

async function createConsultation(consultation) {
    try {
        const result = await apiRequest('/consultations', {
            method: 'POST',
            body: JSON.stringify(consultation)
        });
        
        // Also save to localStorage as backup
        const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
        consultations.push(result.consultation);
        localStorage.setItem('consultations', JSON.stringify(consultations));
        
        return result.consultation;
    } catch (error) {
        // Fallback to localStorage
        const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
        consultations.push(consultation);
        localStorage.setItem('consultations', JSON.stringify(consultations));
        return consultation;
    }
}

async function updateConsultationStatus(consultationId, status) {
    try {
        const result = await apiRequest(`/consultations/${consultationId}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        // Also update localStorage
        const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
        const index = consultations.findIndex(c => c.id === consultationId);
        if (index !== -1) {
            consultations[index] = result.consultation;
            localStorage.setItem('consultations', JSON.stringify(consultations));
        }
        
        return result.consultation;
    } catch (error) {
        // Fallback to localStorage
        const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
        const consultation = consultations.find(c => c.id === consultationId);
        if (consultation) {
            consultation.status = status;
            if (status === 'accepted') {
                consultation.acceptedDate = new Date().toISOString();
            } else if (status === 'rejected') {
                consultation.rejectedDate = new Date().toISOString();
            }
            localStorage.setItem('consultations', JSON.stringify(consultations));
        }
        return consultation;
    }
}

// Online Status
async function getOnlineDoctors() {
    try {
        const doctors = await apiRequest('/doctors/online');
        return new Set(doctors);
    } catch (error) {
        // Fallback - return empty set
        return new Set();
    }
}

// Call Management
async function startCall(consultationId) {
    try {
        const result = await apiRequest('/calls/start', {
            method: 'POST',
            body: JSON.stringify({ consultationId })
        });
        return result.callId;
    } catch (error) {
        // Fallback
        return `call_${Date.now()}`;
    }
}

async function endCall(callId) {
    try {
        await apiRequest('/calls/end', {
            method: 'POST',
            body: JSON.stringify({ callId })
        });
        // Also update localStorage as fallback
        const activeCalls = JSON.parse(localStorage.getItem('activeCalls') || '{}');
        if (activeCalls[callId]) {
            activeCalls[callId].ended = true;
            activeCalls[callId].endTime = new Date().toISOString();
            localStorage.setItem('activeCalls', JSON.stringify(activeCalls));
        }
    } catch (error) {
        console.error('Failed to end call on server:', error);
        // Fallback to localStorage
        const activeCalls = JSON.parse(localStorage.getItem('activeCalls') || '{}');
        if (activeCalls[callId]) {
            activeCalls[callId].ended = true;
            activeCalls[callId].endTime = new Date().toISOString();
            localStorage.setItem('activeCalls', JSON.stringify(activeCalls));
        }
    }
}

// Get call status from API
async function getCallStatus(callId) {
    try {
        const status = await apiRequest(`/calls/${callId}`, { method: 'GET' });
        return status;
    } catch (error) {
        // Fallback to localStorage
        const activeCalls = JSON.parse(localStorage.getItem('activeCalls') || '{}');
        return activeCalls[callId] || { ended: false };
    }
}

// Initialize on page load
if (typeof window !== 'undefined') {
    // Initialize socket connection when dashboard loads
    if (window.location.pathname.includes('dashboard.html') || window.location.pathname === '/') {
        document.addEventListener('DOMContentLoaded', () => {
            initSocket();
        });
    }
}
