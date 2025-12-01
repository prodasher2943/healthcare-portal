// API Client for Healthcare Portal
// Replaces localStorage with backend API calls

// IMPORTANT: Update this URL when deploying to production
// For local development: use window.location.origin
// For production: use your deployed server URL (e.g., 'https://your-app.railway.app')

// Auto-detect if running locally or on deployed server
function getApiBaseUrl() {
    // Check if we're running on localhost or file://
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.protocol === 'file:';
    
    if (isLocal) {
        // Use localhost for local development
        return 'http://localhost:3000';
    } else {
        // When deployed (Railway, etc.), use the same origin as the frontend
        // This ensures the API is accessible from the same domain
        return window.location.origin;
    }
}

const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL:', API_BASE_URL);
console.log('Current origin:', window.location.origin);

// Initialize Socket.io connection
let socket = null;
let isConnected = false;

function initSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.io not loaded. Install: npm install socket.io-client');
        return;
    }
    
    try {
        socket = io(API_BASE_URL, {
            transports: ['websocket', 'polling'],
            timeout: 5000, // 5 second timeout
            reconnection: false // Don't auto-reconnect if initial connection fails
        });
        
        // Handle connection errors gracefully
        socket.on('connect_error', (error) => {
            console.log('Socket connection failed (local mode):', error.message);
            isConnected = false;
        });
    } catch (error) {
        console.log('Socket initialization failed (local mode):', error.message);
        socket = null;
        isConnected = false;
    }
    
    socket.on('connect', () => {
        isConnected = true;
        console.log('✅ Connected to server');
        
        // Notify server that user is online
        const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        if (userData) {
            // Get full user info from localStorage to send user_data to server
            const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
            const fullUserInfo = usersDB[userData.email] || userData;
            
            const userTypeToSend = userData.user_type || fullUserInfo.user_type;
            const userDataToSend = fullUserInfo.user_data || userData.user_data || {};
            
            console.log(`📡 Emitting userOnline: ${userData.email}, type: ${userTypeToSend}`);
            
            socket.emit('userOnline', {
                email: userData.email,
                userType: userTypeToSend,
                userData: userDataToSend
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
            console.log('✅ Consultation accepted - starting video call...');
            // Use shorter timeout to start call faster and catch offers
            setTimeout(() => {
                if (typeof startVideoCall === 'function') {
                    startVideoCall(consultation);
                } else {
                    console.error('startVideoCall function not found!');
                    // Fallback: reload consultations
                    if (typeof loadConsultationRequests === 'function') {
                        loadConsultationRequests();
                    }
                }
            }, 100); // Reduced from 500ms to 100ms for faster call start
        } else if (consultation.status === 'rejected') {
            const consultationContent = document.getElementById('consultation-content');
            if (consultationContent) {
                consultationContent.innerHTML = `
                    <div class="consultation-rejected">
                        <p>❌ Your consultation request was declined.</p>
                        <button class="btn-primary" onclick="showConsultationModal()">Request Another Consultation</button>
                    </div>
                `;
            }
        }
    });
    
    // Listen for call started event (more reliable than consultationStatusUpdate)
    socket.on('callStarted', ({ callId, consultationId, consultation }) => {
        console.log('📞 Call started event received:', { callId, consultationId });
        
        const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        if (!userData) return;
        
        // Check if this consultation is for the current user
        const isRelevant = (userData.user_type === 'Patient' && consultation && consultation.patientEmail === userData.email) ||
                          (userData.user_type === 'Doctor' && consultation && consultation.doctorEmail === userData.email);
        
        if (isRelevant && consultation) {
            console.log('✅ Starting video call for current user...');
            // Close consultation modal if open
            const consultationModal = document.getElementById('consultation-modal');
            if (consultationModal) {
                consultationModal.style.display = 'none';
            }
            
            // Start video call
            setTimeout(() => {
                if (typeof startVideoCall === 'function') {
                    startVideoCall(consultation);
                }
            }, 300);
        }
    });
    
    // Listen for call ended
    socket.on('callEnded', ({ callId, consultationId }) => {
        console.log('📞 Received callEnded event:', { callId, consultationId });
        // Check if this call matches our current call
        // Match by callId, consultationId, or if IDs contain each other
        if (typeof currentCallId !== 'undefined' && currentCallId) {
            let shouldEnd = false;
            
            // Exact match by callId
            if (currentCallId === callId) {
                shouldEnd = true;
            }
            
            // Match by consultationId
            if (consultationId && typeof currentConsultation !== 'undefined' && currentConsultation) {
                if (currentConsultation.id === consultationId || 
                    currentCallId === consultationId ||
                    String(currentConsultation.id) === String(consultationId)) {
                    shouldEnd = true;
                }
            }
            
            // String contains match (for IDs like "call_123_456")
            if (!shouldEnd && typeof callId === 'string' && typeof currentCallId === 'string') {
                if (callId.includes(String(currentCallId)) || 
                    String(currentCallId).includes(callId)) {
                    shouldEnd = true;
                }
            }
            
            if (shouldEnd) {
                console.log('✅ Ending video call due to remote party ending the call');
                // Use setTimeout to ensure this runs after any current operations
                setTimeout(() => {
                    if (typeof endVideoCall === 'function') {
                        endVideoCall();
                    }
                }, 100);
            }
        }
    });
    
    // Listen for prescription updates
    socket.on('prescriptionUpdated', ({ callId, consultationId, prescription }) => {
        console.log('📝 Prescription updated:', { callId, consultationId, prescriptionLength: prescription?.length || 0 });
        
        // Only update if this is for our current call
        // Match by callId, consultationId, or if they contain each other
        const currentCall = typeof currentCallId !== 'undefined' ? currentCallId : null;
        const currentConsult = typeof currentConsultation !== 'undefined' && currentConsultation ? currentConsultation.id : null;
        
        const isOurCall = (currentCall && (
                           currentCall === callId || 
                           currentCall === consultationId ||
                           (typeof currentCall === 'string' && String(currentCall).includes(String(consultationId))) ||
                           (typeof callId === 'string' && String(callId).includes(String(currentCall))))) ||
                          (currentConsult && (
                           currentConsult === consultationId ||
                           String(currentConsult) === String(consultationId)));
                           
        if (isOurCall) {
            const prescriptionTextarea = document.getElementById('prescription-textarea');
            if (prescriptionTextarea) {
                // Don't update if doctor is currently typing (to avoid cursor jumping)
                const isTyping = prescriptionTextarea === document.activeElement;
                
                if (!isTyping) {
                    // Save cursor position if not typing
                    const oldValue = prescriptionTextarea.value;
                    const cursorPos = prescriptionTextarea.selectionStart;
                    
                    prescriptionTextarea.value = prescription || '';
                    
                    // Show/hide notice for patient
                    const prescriptionNotice = document.getElementById('prescription-readonly-notice');
                    if (prescriptionNotice) {
                        prescriptionNotice.style.display = (prescription && prescription.trim()) ? 'none' : 'block';
                    }
                    
                    console.log('✅ Prescription updated in textarea');
                } else {
                    console.log('⚠️ Skipping update - doctor is typing');
                }
            } else {
                console.log('⚠️ Prescription textarea not found');
            }
        } else {
            console.log('⚠️ Prescription update not for current call:', { currentCall, currentConsult, callId, consultationId });
        }
    });
    
    // Listen for doctor online/offline status
    socket.on('doctorOnline', (email) => {
        console.log(`✅ Doctor came online via Socket.io: ${email}`);
        if (typeof onlineDoctors !== 'undefined' && onlineDoctors) {
            onlineDoctors.add(email);
            console.log(`📊 Updated online doctors set, now has ${onlineDoctors.size} doctors`);
            
            // Refresh doctor list if consultation modal is open
            const consultationModal = document.getElementById('consultation-modal');
            if (consultationModal && consultationModal.style.display === 'block') {
                console.log('🔄 Refreshing doctor list due to doctor online event');
                loadAvailableDoctors();
            }
        } else {
            console.warn('⚠️ onlineDoctors Set not available yet');
        }
    });
    
    socket.on('doctorOffline', (email) => {
        console.log(`❌ Doctor went offline via Socket.io: ${email}`);
        if (typeof onlineDoctors !== 'undefined' && onlineDoctors) {
            onlineDoctors.delete(email);
            console.log(`📊 Updated online doctors set, now has ${onlineDoctors.size} doctors`);
            
            // Refresh doctor list if consultation modal is open
            const consultationModal = document.getElementById('consultation-modal');
            if (consultationModal && consultationModal.style.display === 'block') {
                console.log('🔄 Refreshing doctor list due to doctor offline event');
                loadAvailableDoctors();
            }
        } else {
            console.warn('⚠️ onlineDoctors Set not available yet');
        }
    });
    
    // WebRTC Signaling Handlers
    socket.on('webrtcOffer', async ({ callId, consultationId, offer }) => {
        console.log('📥 Received WebRTC offer:', { callId, consultationId });
        
        // Check if this is for our current call
        const isOurCall = (typeof currentCallId !== 'undefined' && currentCallId && 
                          (currentCallId === callId || currentCallId === consultationId ||
                           String(currentCallId).includes(String(callId)) || String(currentCallId).includes(String(consultationId)))) ||
                         (typeof currentConsultation !== 'undefined' && currentConsultation &&
                          (currentConsultation.id === consultationId || currentConsultation.id === callId ||
                           String(currentConsultation.id) === String(consultationId) || String(currentConsultation.id) === String(callId)));
        
        // Process the offer immediately if call is already started
        if (isOurCall) {
            console.log('✅ This offer is for our call - processing...');
            
            // CRITICAL: Ensure video streams are initialized BEFORE handling offer
            // But proceed even if no local media is available
            if (typeof localStream === 'undefined' || !localStream) {
                console.log('⚠️ Local stream not initialized yet - initializing now...');
                if (typeof initializeVideoStreams === 'function') {
                    try {
                        await initializeVideoStreams();
                        console.log('✅ Local stream initialization attempt completed');
                        // Wait a moment for tracks to be added (if any)
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        // Check if we have a stream (even if empty)
                        if (typeof localStream === 'undefined' || !localStream) {
                            localStream = new MediaStream(); // Create empty stream
                            console.log('ℹ️ Created empty local stream - will receive remote streams only');
                        }
                    } catch (err) {
                        console.error('❌ Failed to initialize video streams:', err);
                        console.log('ℹ️ Proceeding without local media - can still receive remote streams');
                        // Create empty stream and proceed
                        localStream = new MediaStream();
                    }
                } else {
                    console.error('⚠️ initializeVideoStreams function not available - proceeding without local media');
                    localStream = new MediaStream(); // Create empty stream
                }
            }
            
            // If peer connection doesn't exist yet, create it
            if (typeof peerConnection === 'undefined' || !peerConnection) {
                console.log('⚠️ Peer connection not ready, creating now...');
                if (typeof createPeerConnection === 'function') {
                    createPeerConnection();
                } else {
                    console.error('⚠️ createPeerConnection function not available');
                    return;
                }
            }
            
            // CRITICAL: Ensure all local stream tracks are added to peer connection BEFORE creating answer
            if (typeof localStream !== 'undefined' && localStream && typeof peerConnection !== 'undefined' && peerConnection) {
                const existingSenders = peerConnection.getSenders();
                const existingTrackIds = existingSenders.map(s => s.track?.id).filter(Boolean);
                
                // Get all tracks from local stream (if available)
                const audioTracks = localStream ? localStream.getAudioTracks() : [];
                const videoTracks = localStream ? localStream.getVideoTracks() : [];
                const allTracks = [...audioTracks, ...videoTracks];
                
                console.log(`📤 Ensuring ${allTracks.length} local track(s) are added to peer connection`);
                console.log(`   - ${audioTracks.length} audio track(s)`);
                console.log(`   - ${videoTracks.length} video track(s)`);
                
                if (allTracks.length > 0) {
                    allTracks.forEach(track => {
                        if (!existingTrackIds.includes(track.id)) {
                            console.log(`📤 Adding ${track.kind} track (id: ${track.id}) to peer connection`);
                            try {
                                peerConnection.addTrack(track, localStream);
                                console.log(`✅ ${track.kind} track added successfully`);
                            } catch (err) {
                                console.error(`❌ Error adding ${track.kind} track:`, err);
                                // Try replacing if it's a duplicate
                                const existingSender = existingSenders.find(s => s.track && s.track.kind === track.kind);
                                if (existingSender) {
                                    console.log(`🔄 Replacing existing ${track.kind} track`);
                                    existingSender.replaceTrack(track).catch(e => console.error('Error replacing track:', e));
                                }
                            }
                        } else {
                            console.log(`✓ ${track.kind} track (id: ${track.id}) already in peer connection`);
                        }
                    });
                } else {
                    console.log('ℹ️ No local tracks available - will receive remote streams only');
                    console.log('✅ Call can proceed - you can still see and hear the other party');
                }
                
                // Verify final state
                const finalSenders = peerConnection.getSenders();
                const finalAudioCount = finalSenders.filter(s => s.track && s.track.kind === 'audio').length;
                const finalVideoCount = finalSenders.filter(s => s.track && s.track.kind === 'video').length;
                console.log(`✅ Peer connection now has ${finalAudioCount} audio sender(s) and ${finalVideoCount} video sender(s)`);
                
                if (finalAudioCount === 0 && finalVideoCount === 0) {
                    console.log('ℹ️ No local tracks - you can still receive remote video/audio');
                } else {
                    if (finalAudioCount === 0) {
                        console.log('ℹ️ No audio tracks - you will not transmit audio but can receive it');
                    }
                    if (finalVideoCount === 0) {
                        console.log('ℹ️ No video tracks - you will not transmit video but can receive it');
                    }
                }
            } else {
                console.log('ℹ️ localStream or peerConnection not available - proceeding anyway for receiving remote streams');
            }
            
            try {
                // Set remote description
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                console.log('✅ Remote description set');
                
                // Add any pending ICE candidates that arrived before remote description
                if (peerConnection.pendingIceCandidates && peerConnection.pendingIceCandidates.length > 0) {
                    console.log(`📥 Adding ${peerConnection.pendingIceCandidates.length} pending ICE candidates`);
                    for (const candidate of peerConnection.pendingIceCandidates) {
                        try {
                            await peerConnection.addIceCandidate(candidate);
                        } catch (err) {
                            console.error('Error adding pending ICE candidate:', err);
                        }
                    }
                    peerConnection.pendingIceCandidates = [];
                }
                
                // Verify we have local tracks in peer connection before creating answer
                const senders = peerConnection.getSenders();
                const audioSenders = senders.filter(s => s.track && s.track.kind === 'audio');
                const videoSenders = senders.filter(s => s.track && s.track.kind === 'video');
                
                console.log(`📊 Peer connection has ${senders.length} sender(s) before creating answer:`);
                console.log(`   - ${audioSenders.length} audio sender(s)`);
                console.log(`   - ${videoSenders.length} video sender(s)`);
                
                if (audioSenders.length === 0 || videoSenders.length === 0) {
                    console.warn('⚠️ WARNING: Missing tracks in peer connection before creating answer!');
                    console.warn(`   Current senders: ${audioSenders.length} audio, ${videoSenders.length} video`);
                    
                    if (typeof localStream !== 'undefined' && localStream) {
                        console.log('📤 Re-adding local tracks to peer connection...');
                        const localTracks = localStream.getTracks();
                        console.log(`   Found ${localTracks.length} local track(s) to add`);
                        
                        localTracks.forEach(track => {
                            const hasTrack = senders.some(s => s.track && s.track.id === track.id);
                            if (!hasTrack) {
                                console.log(`📤 Adding ${track.kind} track (${track.id}) to peer connection`);
                                try {
                                    peerConnection.addTrack(track, localStream);
                                    console.log(`✅ ${track.kind} track added successfully`);
                                } catch (err) {
                                    console.error(`❌ Failed to add ${track.kind} track:`, err);
                                    // Try replacing if there's an existing sender of this kind
                                    const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
                                    if (existingSender) {
                                        console.log(`🔄 Replacing existing ${track.kind} sender`);
                                        existingSender.replaceTrack(track).catch(e => {
                                            console.error(`❌ Failed to replace ${track.kind} track:`, e);
                                        });
                                    }
                                }
                            } else {
                                console.log(`✓ ${track.kind} track already in peer connection`);
                            }
                        });
                        
                        // Verify tracks were added
                        const updatedSenders = peerConnection.getSenders();
                        const updatedAudio = updatedSenders.filter(s => s.track && s.track.kind === 'audio').length;
                        const updatedVideo = updatedSenders.filter(s => s.track && s.track.kind === 'video').length;
                        console.log(`✅ After re-adding: ${updatedAudio} audio sender(s), ${updatedVideo} video sender(s)`);
                    } else {
                        console.warn('⚠️ localStream is not available - cannot add tracks');
                    }
                }
                
                // Wait longer for tracks to be properly added and negotiated
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Create answer with both audio and video
                console.log('📞 Creating WebRTC answer...');
                const answer = await peerConnection.createAnswer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                
                // Verify answer SDP includes both media types
                const answerSdp = answer.sdp || '';
                const hasAudio = answerSdp.includes('m=audio') || answerSdp.includes('audio');
                const hasVideo = answerSdp.includes('m=video') || answerSdp.includes('video');
                
                console.log(`📤 Answer created:`);
                console.log(`   - Audio in SDP: ${hasAudio}`);
                console.log(`   - Video in SDP: ${hasVideo}`);
                
                await peerConnection.setLocalDescription(answer);
                console.log('✅ Local description set (answer)');
                
                // Send answer back
                socket.emit('webrtcAnswer', {
                    callId: callId || currentCallId,
                    consultationId: consultationId || (currentConsultation ? currentConsultation.id : null),
                    answer: answer
                });
                
                console.log('📤 Answer sent with audio and video tracks');
            } catch (error) {
                console.error('❌ Error handling WebRTC offer:', error);
            }
        } else if (matchesPendingConsultation && !isOurCall) {
            // Store offer to process when call starts
            console.log('💾 Storing offer for later processing when call starts');
            window.pendingWebRTCOffers.push({ callId, consultationId, offer, timestamp: Date.now() });
            
            // Clean up old offers (older than 30 seconds)
            window.pendingWebRTCOffers = window.pendingWebRTCOffers.filter(
                p => Date.now() - p.timestamp < 30000
            );
            
            // Try to start the call if we have the consultation
            try {
                const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
                const consultation = consultations.find(c => c.id === consultationId || c.id === callId);
                if (consultation && consultation.status === 'accepted') {
                    console.log('🚀 Auto-starting call for pending offer...');
                    // Small delay to ensure UI is ready
                    setTimeout(() => {
                        if (typeof startVideoCall === 'function') {
                            startVideoCall(consultation);
                        }
                    }, 100);
                }
            } catch (e) {
                console.error('Error auto-starting call:', e);
            }
        } else {
            console.log('⚠️ Offer not for current call, ignoring');
        }
    });
    
    // Helper function to process WebRTC offers (can be called from dashboard.js)
    window.processWebRTCOffer = async function({ callId, consultationId, offer }) {
        console.log('🔄 Processing WebRTC offer:', { callId, consultationId });
        
        // Ensure we have the right context
        if (typeof currentCallId === 'undefined' || !currentCallId) {
            console.log('⚠️ currentCallId not set, setting it now...');
            if (typeof window.currentCallId !== 'undefined') {
                currentCallId = window.currentCallId;
            } else {
                currentCallId = callId || consultationId;
            }
        }
        
        if (typeof currentConsultation === 'undefined' || !currentConsultation) {
            console.log('⚠️ currentConsultation not set, trying to find it...');
            try {
                const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
                const consultation = consultations.find(c => c.id === consultationId || c.id === callId);
                if (consultation) {
                    currentConsultation = consultation;
                }
            } catch (e) {
                console.error('Error finding consultation:', e);
            }
        }
        
        // Now process the offer using the same logic as the socket handler
        if (typeof peerConnection === 'undefined' || !peerConnection) {
            console.log('⚠️ Peer connection not ready, creating now...');
            if (typeof createPeerConnection === 'function') {
                createPeerConnection();
            } else {
                console.error('⚠️ createPeerConnection function not available');
                return;
            }
        }
        
        // Ensure local stream is ready
        if (typeof localStream === 'undefined' || !localStream) {
            console.log('⚠️ Local stream not initialized - initializing now...');
            if (typeof initializeVideoStreams === 'function') {
                try {
                    await initializeVideoStreams();
                    await new Promise(resolve => setTimeout(resolve, 300));
                    if (typeof localStream === 'undefined' || !localStream) {
                        localStream = new MediaStream();
                    }
                } catch (err) {
                    console.error('❌ Failed to initialize video streams:', err);
                    localStream = new MediaStream();
                }
            } else {
                localStream = new MediaStream();
            }
        }
        
        // Add local tracks to peer connection
        if (localStream && peerConnection) {
            const existingSenders = peerConnection.getSenders();
            const existingTrackIds = existingSenders.map(s => s.track?.id).filter(Boolean);
            const allTracks = [...(localStream.getAudioTracks() || []), ...(localStream.getVideoTracks() || [])];
            
            allTracks.forEach(track => {
                if (!existingTrackIds.includes(track.id)) {
                    try {
                        peerConnection.addTrack(track, localStream);
                    } catch (err) {
                        const existingSender = existingSenders.find(s => s.track && s.track.kind === track.kind);
                        if (existingSender) {
                            existingSender.replaceTrack(track).catch(e => console.error('Error replacing track:', e));
                        }
                    }
                }
            });
        }
        
        try {
            // Set remote description
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log('✅ Remote description set');
            
            // Add pending ICE candidates
            if (peerConnection.pendingIceCandidates && peerConnection.pendingIceCandidates.length > 0) {
                for (const candidate of peerConnection.pendingIceCandidates) {
                    try {
                        await peerConnection.addIceCandidate(candidate);
                    } catch (err) {
                        console.error('Error adding pending ICE candidate:', err);
                    }
                }
                peerConnection.pendingIceCandidates = [];
            }
            
            // Create answer
            const answer = await peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await peerConnection.setLocalDescription(answer);
            console.log('✅ Local description set (answer)');
            
            // Send answer back
            if (typeof socket !== 'undefined' && socket && socket.connected) {
                socket.emit('webrtcAnswer', {
                    callId: callId || currentCallId,
                    consultationId: consultationId || (currentConsultation ? currentConsultation.id : null),
                    answer: answer
                });
                console.log('📤 Answer sent');
            }
        } catch (error) {
            console.error('❌ Error processing WebRTC offer:', error);
        }
    };
    
    socket.on('webrtcAnswer', async ({ callId, consultationId, answer }) => {
        console.log('📥 Received WebRTC answer:', { callId, consultationId });
        
        // Check if this is for our current call
        const isOurCall = (typeof currentCallId !== 'undefined' && currentCallId && 
                          (currentCallId === callId || currentCallId === consultationId)) ||
                         (typeof currentConsultation !== 'undefined' && currentConsultation &&
                          (currentConsultation.id === consultationId || currentConsultation.id === callId));
        
        if (isOurCall && typeof peerConnection !== 'undefined' && peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('✅ Remote description set (answer)');
                
                // Add any pending ICE candidates that arrived before remote description
                if (peerConnection.pendingIceCandidates && peerConnection.pendingIceCandidates.length > 0) {
                    console.log(`📥 Adding ${peerConnection.pendingIceCandidates.length} pending ICE candidates`);
                    for (const candidate of peerConnection.pendingIceCandidates) {
                        try {
                            await peerConnection.addIceCandidate(candidate);
                        } catch (err) {
                            console.error('Error adding pending ICE candidate:', err);
                        }
                    }
                    peerConnection.pendingIceCandidates = [];
                }
            } catch (error) {
                console.error('Error handling WebRTC answer:', error);
            }
        }
    });
    
    socket.on('iceCandidate', async ({ callId, consultationId, candidate }) => {
        console.log('🧊 Received ICE candidate:', { callId, consultationId });
        
        // Check if this is for our current call
        const isOurCall = (typeof currentCallId !== 'undefined' && currentCallId && 
                          (currentCallId === callId || currentCallId === consultationId)) ||
                         (typeof currentConsultation !== 'undefined' && currentConsultation &&
                          (currentConsultation.id === consultationId || currentConsultation.id === callId));
        
        if (isOurCall && typeof peerConnection !== 'undefined' && peerConnection) {
            try {
                // Check if remote description is set before adding ICE candidate
                if (peerConnection.remoteDescription) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('✅ ICE candidate added');
                } else {
                    // Store candidate to add later when remote description is set
                    console.log('⏳ Storing ICE candidate until remote description is set');
                    if (!peerConnection.pendingIceCandidates) {
                        peerConnection.pendingIceCandidates = [];
                    }
                    peerConnection.pendingIceCandidates.push(new RTCIceCandidate(candidate));
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
                // If error is about invalid state, try to queue it
                if (error.message && error.message.includes('remoteDescription')) {
                    if (!peerConnection.pendingIceCandidates) {
                        peerConnection.pendingIceCandidates = [];
                    }
                    peerConnection.pendingIceCandidates.push(new RTCIceCandidate(candidate));
                }
            }
        }
    });
}

// API Functions

async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.body,
            mode: 'cors' // Explicitly set CORS mode
        });
        
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = `API Error: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // Response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }
            
            const error = new Error(errorMessage);
            error.status = response.status;
            throw error;
        }
        
        return await response.json();
    } catch (error) {
        // Check if it's a CORS/network error
        if (error.message.includes('CORS') || 
            error.message.includes('Failed to fetch') || 
            error.name === 'TypeError' ||
            error.message.includes('network') ||
            error.message.includes('NetworkError')) {
            console.log('Server unavailable (CORS/network error), using local storage only');
            throw new Error('SERVER_UNAVAILABLE'); // Special error code for server unavailability
        }
        console.error('API Request failed:', error);
        throw error; // Re-throw other errors
    }
}

// User Management (server-side)
// Register/update user profile on the server (includes password hash for cross-device login)
async function registerUserOnServer(email, userData, userType, passwordHash) {
    try {
        console.log(`📝 Registering user on server: ${email}, passwordHash length: ${passwordHash?.length || 0}`);
        
        const result = await apiRequest('/users/register', {
            method: 'POST',
            body: JSON.stringify({ email, userData, userType, passwordHash })
        });
        
        console.log(`📝 Server registration response:`, result ? 'Success' : 'Failed');
        
        if (result && result.success && result.user) {
            console.log(`✅ User registered on server: ${email}`);
            
            // Verify password_hash was stored on server
            // Note: The server response doesn't include password_hash (for security),
            // but we trust it was stored since registration succeeded
            
            // Also save to localStorage as backup
            // IMPORTANT: Preserve the password from local storage
            const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
            const existingUser = usersDB[email] || {};
            usersDB[email] = {
                ...result.user, // Server data (user_data, user_type, etc.)
                password: passwordHash, // Always use the hash that was registered on server (for consistency across devices)
                registered_date: existingUser.registered_date || result.user.registered_date
            };
            localStorage.setItem('usersDB', JSON.stringify(usersDB));
            
            console.log(`✅ User data synced to localStorage for ${email}`);
        }
        
        return result ? result.user : null;
    } catch (error) {
        // Log the error but don't throw - local storage is sufficient for login
        console.error('❌ Server registration failed:', error);
        console.log('⚠️ Continuing with local storage only');
        return null;
    }
}

// Login on server (for cross-device login)
async function loginUserOnServer(email, passwordHash) {
    try {
        console.log(`🔑 Attempting server login for: ${email}`);
        console.log(`🔑 Password hash length: ${passwordHash?.length || 0}`);
        console.log(`🔑 Password hash preview: ${passwordHash ? passwordHash.substring(0, 10) + '...' : 'N/A'}`);
        
        const result = await apiRequest('/users/login', {
            method: 'POST',
            body: JSON.stringify({ email, passwordHash })
        });
        
        console.log('🔑 Server login response received:', result ? 'Has result' : 'No result');
        
        if (result && result.success && result.user) {
            console.log(`✅ Server login successful for ${email}`);
            
            // Store user in localStorage for future logins
            const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
            const existingUser = usersDB[email] || {};
            
            // IMPORTANT: Store the passwordHash that successfully logged in
            // This ensures future logins on this device will work
            usersDB[email] = {
                ...result.user,
                password: passwordHash, // Store the hash that worked for login
                registered_date: existingUser.registered_date || result.user.registered_date
            };
            
            localStorage.setItem('usersDB', JSON.stringify(usersDB));
            console.log(`✅ User data and password hash saved to localStorage for ${email}`);
            
            return { success: true, user: usersDB[email] };
        }
        
        console.error('❌ Server login failed - no success response');
        return { success: false, message: 'Login failed' };
    } catch (error) {
        console.error('❌ Failed to login on server:', error);
        console.error('❌ Error details:', {
            message: error.message,
            status: error.status,
            name: error.name
        });
        
        // Handle server unavailable
        if (error.message === 'SERVER_UNAVAILABLE') {
            return { success: false, message: 'Server unavailable. Please check your connection.' };
        }
        
        // Check for specific HTTP error codes
        if (error.status === 404 || (error.message && error.message.includes('404'))) {
            return { success: false, message: 'Email not found. Please register first.' };
        }
        if (error.status === 401 || (error.message && error.message.includes('401')) || (error.message && error.message.includes('Incorrect password'))) {
            return { success: false, message: 'Incorrect password. Please try again.' };
        }
        if (error.status === 400 || (error.message && error.message.includes('400'))) {
            return { success: false, message: error.message || 'Invalid request. Please try again.' };
        }
        
        // Use error message if available
        if (error.message && !error.message.includes('API Error')) {
            return { success: false, message: error.message };
        }
        
        return { success: false, message: 'Login failed. Please try again.' };
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
        return result.callId || result; // Return callId or full result
    } catch (error) {
        // Fallback - return consultationId so both parties can match
        throw error; // Let caller handle fallback
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
