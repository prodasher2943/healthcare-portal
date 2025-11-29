// Gemini API Configuration - uses CONFIG from config.js

// Global variables for multi-chat system
let currentChatId = null;
let chats = {}; // { chatId: { id, title, messages, consultationUnlocked, createdAt, updatedAt } }
let onlineDoctors = new Set(); // Track online doctors

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    initializeChatbot();
    loadMedicineSchedule();
    loadConsultationRequests();
    loadConsultationHistory();
    initializeOnlineStatus();
    
    // Set default dates for medicine form
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('med-start-date');
    const endDateInput = document.getElementById('med-end-date');
    if (startDateInput) startDateInput.value = today;
    if (endDateInput) endDateInput.setAttribute('min', today);
    
    // Start polling for doctors to see new requests
    startDoctorRequestPolling();
    
    // Start polling for online status
    startOnlineStatusPolling();
});

// Load dashboard based on user type
function loadDashboard() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }

    const userInfo = userData.user_data;
    const userType = userData.user_type;
    
    console.log('=== LOADING DASHBOARD ===');
    console.log('User type:', userType);
    console.log('Full user data:', userData);

    // Case-insensitive check for user type
    const isPatient = userType === 'Patient' || userType === 'patient' || userType?.toLowerCase() === 'patient';

    if (isPatient) {
        document.getElementById('patient-dashboard').style.display = 'block';
        document.getElementById('doctor-dashboard').style.display = 'none';
        document.getElementById('welcome-message').textContent = `👋 Welcome, ${userInfo.name || 'User'}!`;
        document.getElementById('user-type-display').textContent = 'You are logged in as a Patient';
        console.log('Loaded patient dashboard');
    } else {
        document.getElementById('patient-dashboard').style.display = 'none';
        document.getElementById('doctor-dashboard').style.display = 'block';
        document.getElementById('doctor-welcome-message').textContent = `👋 Welcome, Dr. ${userInfo.name || 'User'}!`;
        document.getElementById('doctor-type-display').textContent = `You are logged in as a Doctor - ${userInfo.specialization || 'General'} Specialist`;
        console.log('Loaded doctor dashboard');
    }
}

// Initialize chatbot - multi-chat system
function initializeChatbot() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    // Load all chats from localStorage (user-specific)
    const userEmail = userData.email;
    const savedChats = localStorage.getItem(`chats_${userEmail}`);
    if (savedChats) {
        chats = JSON.parse(savedChats);
    }
    
    // Load current chat ID or create new one
    const savedCurrentChatId = localStorage.getItem(`currentChatId_${userEmail}`);
    if (savedCurrentChatId && chats[savedCurrentChatId]) {
        currentChatId = savedCurrentChatId;
        loadChat(currentChatId);
    } else {
        // Create first chat if none exists
        if (Object.keys(chats).length === 0) {
            createNewChat();
        } else {
            // Load the most recent chat
            const chatIds = Object.keys(chats);
            const sortedChats = chatIds.sort((a, b) => 
                new Date(chats[b].updatedAt) - new Date(chats[a].updatedAt)
            );
            currentChatId = sortedChats[0];
            loadChat(currentChatId);
        }
    }
    
    // Load chat list
    loadChatList();
}

// Save chats to localStorage
function saveChats() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    const userEmail = userData.email;
    localStorage.setItem(`chats_${userEmail}`, JSON.stringify(chats));
    if (currentChatId) {
        localStorage.setItem(`currentChatId_${userEmail}`, currentChatId);
    }
}

// Create new chat
function createNewChat() {
    const chatId = `chat_${Date.now()}`;
    const newChat = {
        id: chatId,
        title: 'New Chat',
        messages: [{
            role: 'bot',
            text: "Hello! I'm your AI Doctor Assistant. I'm here to help you with health concerns, diagnosis, treatment suggestions, and medication information. How can I assist you today?",
            timestamp: new Date().toISOString()
        }],
        consultationUnlocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    chats[chatId] = newChat;
    currentChatId = chatId;
    saveChats();
    loadChat(chatId);
    loadChatList();
    
    // Clear chat input
    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.value = '';
}

// Load a specific chat
function loadChat(chatId) {
    if (!chats[chatId]) return;
    
    currentChatId = chatId;
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (userData) {
        localStorage.setItem(`currentChatId_${userData.email}`, chatId);
    }
    
    const chat = chats[chatId];
    displayChatHistory(chat.messages);
    updateChatTitle(chat.title);
    
    // Update consultation panel based on chat's consultationUnlocked status
    if (chat.consultationUnlocked) {
        showConsultationOption();
    } else {
        const consultationContent = document.getElementById('consultation-content');
        if (consultationContent) {
            consultationContent.innerHTML = `
                <div class="consultation-placeholder">
                    <p>Complete AI diagnosis to consult with a real doctor</p>
                </div>
            `;
        }
    }
}

// Display chat history
function displayChatHistory(messages) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="message bot-message">
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <p>Hello! I'm your AI Doctor Assistant. How can I assist you today?</p>
                    <small class="message-time"></small>
                </div>
            </div>
        `;
        return;
    }
    
    messages.forEach(msg => {
        addMessageToChat(msg.text, msg.role, false); // false = don't save, already in history
    });
}

// Update chat title in UI
function updateChatTitle(title) {
    const titleElement = document.getElementById('chat-title');
    if (titleElement) {
        titleElement.textContent = title;
    }
}

// Toggle chat list dropdown
function toggleChatList() {
    const dropdown = document.getElementById('chat-list-dropdown');
    const panelHeader = document.querySelector('.chatbot-panel .panel-header');
    
    if (dropdown && panelHeader) {
        const isShowing = dropdown.style.display !== 'none';
        
        if (!isShowing) {
            // Calculate position to appear above panel-header
            const headerRect = panelHeader.getBoundingClientRect();
            const panelRect = panelHeader.closest('.chatbot-panel').getBoundingClientRect();
            const offsetTop = headerRect.top - panelRect.top;
            
            dropdown.style.display = 'block';
            dropdown.style.top = `${offsetTop - 2}px`; // Position above header with 2px gap
            dropdown.style.transform = 'translateY(-100%)'; // Move up by its own height
            
            loadChatList();
        } else {
            dropdown.style.display = 'none';
        }
    }
}

// Load chat list items
function loadChatList() {
    const chatListItems = document.getElementById('chat-list-items');
    if (!chatListItems) return;
    
    const chatIds = Object.keys(chats);
    if (chatIds.length === 0) {
        chatListItems.innerHTML = '<p class="empty-chat-list">No chats yet. Start a new chat!</p>';
        return;
    }
    
    // Sort by updatedAt (most recent first)
    const sortedChats = chatIds
        .map(id => chats[id])
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    chatListItems.innerHTML = sortedChats.map(chat => `
        <div class="chat-list-item ${chat.id === currentChatId ? 'active' : ''}" onclick="switchToChat('${chat.id}'); toggleChatList();">
            <div class="chat-list-item-title">${chat.title}</div>
            <div class="chat-list-item-meta">
                <span class="chat-list-item-date">${formatChatDate(chat.updatedAt)}</span>
                ${chat.consultationUnlocked ? '<span class="consultation-badge">💊</span>' : ''}
            </div>
        </div>
    `).join('');
}

// Switch to a different chat
function switchToChat(chatId) {
    if (!chats[chatId]) return;
    loadChat(chatId);
    loadChatList();
}

// Format chat date for display
function formatChatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Send message to AI chatbot
async function sendMessage() {
    if (!currentChatId) {
        createNewChat();
    }
    
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;

    // Display user message
    addMessageToChat(message, 'user');
    input.value = '';

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        // Check if API key is configured
        if (typeof CONFIG === 'undefined' || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || !CONFIG.GEMINI_API_KEY) {
            removeTypingIndicator(typingId);
            addMessageToChat('⚠️ Gemini API key is not configured. Please add your API key in config.js file. You can get one from https://makersuite.google.com/app/apikey', 'bot');
            return;
        }

        // Use REST API
        await sendMessageWithREST(message, typingId);
        
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        removeTypingIndicator(typingId);
        
        // More detailed error message
        let errorMsg = 'I apologize, but I\'m having trouble connecting right now. ';
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('CORS')) {
            errorMsg += 'CORS/Network error detected. The Gemini API may require a backend server. Please check the browser console (F12) for details. ';
        } else {
            errorMsg += `Error: ${error.message}. `;
        }
        errorMsg += 'For immediate medical concerns, please consult with a real doctor.';
        
        addMessageToChat(errorMsg, 'bot');
    }
}

// Send message using REST API
async function sendMessageWithREST(message, typingId) {
    if (!currentChatId || !chats[currentChatId]) return;
    
    const currentChat = chats[currentChatId];
    
    // Build conversation history for context
    const recentHistory = currentChat.messages.slice(-4);
    let conversationContext = '';
    if (recentHistory.length > 0) {
        conversationContext = '\n\nPrevious conversation:\n' + 
            recentHistory.map(m => `${m.role === 'user' ? 'Patient' : 'AI Doctor'}: ${m.text}`).join('\n');
    }
    
    // Prepare the complete prompt - asking for concise responses
    const fullPrompt = `You are an AI medical assistant. Provide helpful medical guidance, diagnosis suggestions, treatment recommendations, and medication information. Be professional, empathetic, and remind users to consult real doctors for serious conditions, not always, just when the problem is serious.

IMPORTANT: Keep your responses CONCISE and to the point. Aim for 2-6 sentences maximum unless more detail is absolutely necessary. Be clear and direct. Provide treatment advice like a real doctor would.

Current question: ${message}${conversationContext}

Please provide a helpful, concise medical response:`;
    
    // Build the request payload
    const requestPayload = {
        contents: [{
            parts: [{
                text: fullPrompt
            }]
        }]
    };
    
    // Call Gemini API
    const apiUrl = CONFIG.GEMINI_API_URL();
    console.log('Calling Gemini API (REST)');
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
    });

        // Check response status
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', response.status, errorData);
            
            let errorMessage = 'I apologize, but I encountered an error. ';
            if (response.status === 400) {
                removeTypingIndicator(typingId);
                errorMessage += 'Invalid request. Please check your API configuration.';
                addMessageToChat(errorMessage, 'bot');
                return;
            } else if (response.status === 401 || response.status === 403) {
                removeTypingIndicator(typingId);
                errorMessage += 'Authentication failed. Please check your API key in config.js. Make sure it\'s valid.';
                addMessageToChat(errorMessage, 'bot');
                return;
            } else if (response.status === 429) {
                // Check if it's a quota error - try to retry automatically
                if (errorData.error && errorData.error.message && errorData.error.message.includes('quota')) {
                    // Extract retry time
                    let retrySeconds = 60; // default 60 seconds
                    if (errorData.error.message.includes('retry in')) {
                        const retryMatch = errorData.error.message.match(/retry in ([\d.]+)s/);
                        if (retryMatch) {
                            retrySeconds = Math.ceil(parseFloat(retryMatch[1]));
                        }
                    }
                    
                    removeTypingIndicator(typingId);
                    errorMessage += `Free tier quota exceeded. I'll automatically retry in ${retrySeconds} seconds...`;
                    addMessageToChat(errorMessage, 'bot');
                    
                    // Show countdown
                    let remaining = retrySeconds;
                    const countdownId = setInterval(() => {
                        remaining--;
                        if (remaining > 0) {
                            // Update last message with countdown
                            const messages = document.querySelectorAll('.bot-message');
                            if (messages.length > 0) {
                                const lastMessage = messages[messages.length - 1];
                                const messageContent = lastMessage.querySelector('.message-content p');
                                if (messageContent) {
                                    messageContent.textContent = `Free tier quota exceeded. Retrying in ${remaining} seconds...`;
                                }
                            }
                        } else {
                            clearInterval(countdownId);
                            // Retry the request
                            const lastUserMessage = chatHistory[chatHistory.length - 1];
                            if (lastUserMessage && lastUserMessage.role === 'user') {
                                setTimeout(() => {
                                    sendMessageWithREST(lastUserMessage.text, showTypingIndicator());
                                }, 1000);
                            }
                        }
                    }, 1000);
                    
                    return;
                } else {
                    removeTypingIndicator(typingId);
                    errorMessage += 'Rate limit exceeded. Please try again later.';
                    addMessageToChat(errorMessage, 'bot');
                    return;
                }
            } else {
                removeTypingIndicator(typingId);
                errorMessage += `Error ${response.status}. `;
                if (errorData.error && errorData.error.message) {
                    errorMessage += errorData.error.message;
                }
                errorMessage += ' Please check the browser console (F12) for details.';
                addMessageToChat(errorMessage, 'bot');
                return;
            }
        }

    const data = await response.json();
    removeTypingIndicator(typingId);

    // Check for errors in response
    if (data.error) {
        console.error('API returned error:', data.error);
        addMessageToChat(`Error: ${data.error.message || 'Unknown error occurred'}. Please check your API key and try again.`, 'bot');
        return;
    }

    // Extract response text
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiResponse = data.candidates[0].content.parts[0].text;
        addMessageToChat(aiResponse, 'bot');
        
        // Title generation is now handled in addMessageToChat after saveChats()
        
        // Check if diagnosis seems complete
        if (aiResponse.toLowerCase().includes('diagnosis') || 
            aiResponse.toLowerCase().includes('treatment') ||
            aiResponse.toLowerCase().includes('medication') ||
            aiResponse.toLowerCase().includes('medicine')) {
            markDiagnosisComplete(aiResponse);
        }
        } else {
            console.error('Unexpected response format. Full response:', JSON.stringify(data, null, 2));
            addMessageToChat('I apologize, but I encountered an unexpected response format. The API response structure was different than expected. Please check the browser console (F12) for details and verify your API key is correct.', 'bot');
        }
}

// Generate chat title using Gemini AI
async function generateChatTitle(chat) {
    if (!chat || !chat.messages || chat.messages.length < 2) {
        console.log('Cannot generate title: chat has less than 2 messages');
        return;
    }
    
    // Don't regenerate if title already exists and is not "New Chat"
    if (chat.title && chat.title !== 'New Chat') {
        console.log('Title already exists:', chat.title);
        return;
    }
    
    try {
        // Get first few messages to generate title (filter out welcome message)
        const userMessages = chat.messages.filter(m => m.role === 'user').slice(0, 3);
        if (userMessages.length === 0) {
            console.log('No user messages found for title generation');
            return;
        }
        
        const conversationText = chat.messages.slice(0, 6)
            .filter(m => m.role === 'user' || m.role === 'bot')
            .map(m => `${m.role === 'user' ? 'Patient' : 'AI'}: ${m.text.substring(0, 200)}`) // Limit text length
            .join('\n');
        
        const titlePrompt = `Based on this medical conversation, generate a short, descriptive title (maximum 5-6 words) that summarizes the main health concern or topic. Only return the title, nothing else. Do not include quotes.

Conversation:
${conversationText}

Title:`;
        
        if (typeof CONFIG === 'undefined' || !CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
            console.log('Cannot generate title: API key not configured');
            return;
        }
        
        console.log('Generating chat title...');
        
        const requestPayload = {
            contents: [{
                parts: [{
                    text: titlePrompt
                }]
            }]
        };
        
        const response = await fetch(CONFIG.GEMINI_API_URL(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                let title = data.candidates[0].content.parts[0].text.trim();
                // Clean up title (remove quotes, extra whitespace, newlines)
                title = title.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim();
                // Extract just the title (sometimes AI adds "Title:" prefix)
                if (title.toLowerCase().includes('title:')) {
                    title = title.split(/title:/i)[1].trim();
                }
                if (title.length > 50) {
                    title = title.substring(0, 47) + '...';
                }
                if (title && title !== 'New Chat') {
                    // Update the chat object directly
                    const chatId = chat.id || currentChatId;
                    if (chatId && chats[chatId]) {
                        chats[chatId].title = title;
                        updateChatTitle(title);
                        saveChats();
                        loadChatList();
                        console.log('✅ Chat title generated:', title);
                    }
                }
            } else {
                console.error('Unexpected response format for title generation:', data);
            }
        } else {
            const errorText = await response.text();
            console.error('Failed to generate title. Response:', response.status, errorText);
        }
    } catch (error) {
        console.error('Error generating chat title:', error);
        // Don't show error to user, just use default title
    }
}

// Handle Enter key in chat input
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Add message to chat
function addMessageToChat(text, role, saveToHistory = true) {
    if (!currentChatId || !chats[currentChatId]) {
        if (saveToHistory) {
            createNewChat();
        } else {
            return;
        }
    }
    
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const timestamp = new Date().toLocaleTimeString();
    const timestampISO = new Date().toISOString();
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">
            <p>${formatMessage(text)}</p>
            <small class="message-time">${timestamp}</small>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Save to current chat if saving
    if (saveToHistory && currentChatId && chats[currentChatId]) {
        const currentChat = chats[currentChatId];
        currentChat.messages.push({ role, text, timestamp: timestampISO });
        currentChat.updatedAt = timestampISO;
        saveChats();
        
        // Trigger title generation if needed (after saving)
        // Use setTimeout to ensure chat object is fully updated
        setTimeout(() => {
            const updatedChat = chats[currentChatId];
            if (updatedChat && updatedChat.messages && 
                updatedChat.messages.length >= 2 && 
                updatedChat.messages.length <= 6 && 
                updatedChat.title === 'New Chat') {
                generateChatTitle(updatedChat);
            }
        }, 1000);
    }
}

// Format message text (basic formatting)
function formatMessage(text) {
    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');
    // Make bold text
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return text;
}

// Display chat history - now handled in loadChat function

// Show typing indicator
function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return 'typing-indicator';
}

// Remove typing indicator
function removeTypingIndicator(id) {
    const typingIndicator = document.getElementById(id);
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Mark diagnosis as complete
function markDiagnosisComplete(diagnosisText) {
    if (!currentChatId || !chats[currentChatId]) return;
    
    const currentChat = chats[currentChatId];
    if (!currentChat.consultationUnlocked) {
        currentChat.consultationUnlocked = true;
        saveChats();
        showConsultationOption();
        loadChatList(); // Update chat list to show consultation badge
    }
}

// Show consultation option
function showConsultationOption() {
    const consultationContent = document.getElementById('consultation-content');
    if (!consultationContent) return;
    
    consultationContent.innerHTML = `
        <div class="consultation-option">
            <div class="consultation-icon">👨‍⚕️</div>
            <h4>AI Diagnosis Complete</h4>
            <p>Would you like to consult with a real doctor for further assistance?</p>
            <button class="btn-primary" onclick="showConsultationModal()">Request Consultation</button>
        </div>
    `;
}

// Medicine Schedule Functions
function loadMedicineSchedule() {
    const medicines = JSON.parse(localStorage.getItem('medicineSchedule') || '[]');
    const scheduleList = document.getElementById('medicine-schedule-list');
    
    if (medicines.length === 0) {
        scheduleList.innerHTML = '<p class="empty-state">No medicines scheduled. Add a medicine to get started.</p>';
        return;
    }
    
    const today = new Date();
    const activeMedicines = medicines.filter(med => {
        const endDate = new Date(med.endDate);
        return endDate >= today;
    });
    
    if (activeMedicines.length === 0) {
        scheduleList.innerHTML = '<p class="empty-state">No active medicines. All medicines have been completed.</p>';
        return;
    }
    
    scheduleList.innerHTML = activeMedicines.map((med, index) => `
        <div class="medicine-item">
            <div class="medicine-header">
                <h4>${med.name}</h4>
                <button class="btn-delete" onclick="deleteMedicine(${index})">🗑️</button>
            </div>
            <div class="medicine-details">
                <p><strong>Dosage:</strong> ${med.dosage}</p>
                <p><strong>Frequency:</strong> ${med.frequency}</p>
                <p><strong>Times:</strong> ${med.times}</p>
                <p><strong>Duration:</strong> ${formatDate(med.startDate)} - ${formatDate(med.endDate)}</p>
                <p><strong>Prescribed by:</strong> ${med.prescribedBy}</p>
            </div>
        </div>
    `).join('');
}

function showAddMedicineForm() {
    document.getElementById('medicine-modal').style.display = 'block';
}

function closeMedicineModal() {
    document.getElementById('medicine-modal').style.display = 'none';
    document.getElementById('add-medicine-form').reset();
}

function addMedicine(event) {
    event.preventDefault();
    
    const medicine = {
        name: document.getElementById('med-name').value,
        dosage: document.getElementById('med-dosage').value,
        frequency: document.getElementById('med-frequency').value,
        startDate: document.getElementById('med-start-date').value,
        endDate: document.getElementById('med-end-date').value,
        times: document.getElementById('med-times').value,
        prescribedBy: document.getElementById('med-prescribed-by').value
    };
    
    const medicines = JSON.parse(localStorage.getItem('medicineSchedule') || '[]');
    medicines.push(medicine);
    localStorage.setItem('medicineSchedule', JSON.stringify(medicines));
    
    closeMedicineModal();
    loadMedicineSchedule();
}

function deleteMedicine(index) {
    if (confirm('Are you sure you want to delete this medicine?')) {
        const medicines = JSON.parse(localStorage.getItem('medicineSchedule') || '[]');
        medicines.splice(index, 1);
        localStorage.setItem('medicineSchedule', JSON.stringify(medicines));
        loadMedicineSchedule();
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Consultation Functions
function showConsultationModal() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    
    // Debug: Log current user data
    console.log('=== CHECKING USER TYPE FOR CONSULTATION ===');
    console.log('Current userData:', userData);
    console.log('User type:', userData ? userData.user_type : 'N/A');
    console.log('User type comparison:', userData ? (userData.user_type === 'Patient') : 'N/A');
    
    // Verify user is a patient
    if (!userData) {
        alert('Error: Please login first.');
        return;
    }
    
    // Get user data from database first to check what's actually stored
    const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
    const userInDB = usersDB[userData.email];
    
    // Check user type (case-insensitive check for safety)
    const userType = userData.user_type;
    const dbUserType = userInDB ? userInDB.user_type : null;
    
    console.log('=== USER TYPE CHECK ===');
    console.log('Session user_type:', userType);
    console.log('Database user_type:', dbUserType);
    console.log('Full userData:', userData);
    console.log('Full DB user:', userInDB);
    
    // Use database type if available, otherwise use session type
    const actualUserType = dbUserType || userType;
    const isPatient = actualUserType === 'Patient' || actualUserType === 'patient' || actualUserType?.toLowerCase() === 'patient';
    
    console.log('Actual user type:', actualUserType);
    console.log('Is patient?', isPatient);
    
    if (!isPatient) {
        console.error('User type check failed!');
        console.error('Session type:', userType);
        console.error('DB type:', dbUserType);
        
        const errorMsg = `Error: Only patients can request consultations.\n\n` +
            `You are currently logged in as: "${actualUserType || 'Unknown'}"\n` +
            `Email: ${userData.email}\n\n` +
            `If you registered as a patient, your account might have the wrong type stored.\n\n` +
            `Please:\n` +
            `1. Open "fix-account.html" to check and fix your account type, OR\n` +
            `2. Logout and login again as a patient, OR\n` +
            `3. Register a new patient account with a different email.`;
        
        alert(errorMsg);
        return;
    }
    
    // Verify patient exists in database
    if (!userInDB) {
        alert('Error: Patient account not found in database. Please login again.');
        return;
    }
    
    const modal = document.getElementById('consultation-modal');
    
    // Use patient data from database (most reliable source)
    const patientData = userInDB.user_data;
    const patientName = patientData.name || 'N/A';
    const patientContact = patientData.contact || 'N/A';
    const patientBioData = patientData.bio_data || 'N/A';
    
    console.log('=== SHOWING CONSULTATION MODAL ===');
    console.log('Logged in as:', userData.email);
    console.log('User type:', userData.user_type);
    console.log('Patient name from DB:', patientName);
    console.log('Patient data:', patientData);
    
    // Generate AI summary for current chat
    generateChatSummaryForConsultation().then(summary => {
        // Display AI-generated chat summary
        document.getElementById('consultation-summary-display').innerHTML = `
            <div class="consultation-section">
                <h3>📋 Chat Summary</h3>
                <div class="summary-content">${formatMessage(summary)}</div>
            </div>
        `;
    }).catch(error => {
        console.error('Error generating summary:', error);
        // Fallback to showing a message
        document.getElementById('consultation-summary-display').innerHTML = `
            <div class="consultation-section">
                <h3>📋 Chat Summary</h3>
                <div class="summary-content">Unable to generate summary. Please try again.</div>
            </div>
        `;
    });
    
    // Display patient info - using verified patient data from database
    document.getElementById('patient-info-display').innerHTML = `
        <div class="consultation-section">
            <h3>👤 Patient Information</h3>
            <div class="patient-details">
                <p><strong>Name:</strong> ${patientName}</p>
                <p><strong>Contact:</strong> ${patientContact}</p>
                <p><strong>Bio Data:</strong> ${patientBioData}</p>
                <p style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">
                    <em>Logged in as: ${userData.email}</em>
                </p>
            </div>
        </div>
    `;
    
    // Load available doctors
    loadAvailableDoctors();
    
    modal.style.display = 'block';
}

function closeConsultationModal() {
    document.getElementById('consultation-modal').style.display = 'none';
}

async function loadAvailableDoctors() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    // Get users from server (with localStorage fallback)
    let users = {};
    try {
        users = await getAllUsers();
    } catch (error) {
        console.error('Error fetching users from server, falling back to localStorage:', error);
        users = JSON.parse(localStorage.getItem('usersDB') || '{}');
    }
    
    // Get consultations from API (with localStorage fallback)
    let consultations = [];
    try {
        consultations = await getConsultations(userData.email, userData.user_type);
    } catch (error) {
        console.error('Error fetching consultations from server, falling back to localStorage:', error);
        consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    }
    
    // Get online doctors from API
    try {
        const onlineDoctorsList = await getOnlineDoctors();
        onlineDoctors = onlineDoctorsList;
    } catch (error) {
        // Fallback - use existing onlineDoctors set
    }
    
    // Get all doctors
    const allDoctors = Object.keys(users)
        .filter(email => users[email].user_type === 'Doctor')
        .map(email => ({
            email,
            ...users[email]
        }));
    
    // Get doctors the patient has consulted with (accepted consultations)
    const consultedDoctors = new Set();
    consultations.forEach(consultation => {
        if (consultation.patientEmail === userData.email && consultation.status === 'accepted') {
            consultedDoctors.add(consultation.doctorEmail);
        }
    });
    
    // Filter doctors: only show ones patient has consulted with OR ones who are online
    const availableDoctors = allDoctors.filter(doctor => {
        const hasConsulted = consultedDoctors.has(doctor.email);
        const isOnline = onlineDoctors.has(doctor.email);
        return hasConsulted || isOnline;
    });
    
    const doctorsContainer = document.getElementById('available-doctors');
    
    if (availableDoctors.length === 0) {
        doctorsContainer.innerHTML = `
            <div class="consultation-section">
                <h3>👨‍⚕️ Available Doctors</h3>
                <p>No doctors available at the moment. You can only see doctors you've previously consulted with or doctors who are currently online.</p>
            </div>
        `;
        return;
    }
    
    doctorsContainer.innerHTML = `
        <div class="consultation-section">
            <h3>👨‍⚕️ Available Doctors</h3>
            <div class="doctors-list">
                ${availableDoctors.map(doctor => {
                    const hasConsulted = consultedDoctors.has(doctor.email);
                    const isOnline = onlineDoctors.has(doctor.email);
                    return `
                        <div class="doctor-card">
                            <div class="doctor-card-header">
                                <h4>Dr. ${doctor.user_data.name}</h4>
                                ${isOnline ? '<span class="online-badge">🟢 Online</span>' : ''}
                                ${hasConsulted ? '<span class="consulted-badge">✓ Consulted</span>' : ''}
                            </div>
                            <p><strong>Specialization:</strong> ${doctor.user_data.specialization}</p>
                            <p><strong>Experience:</strong> ${doctor.user_data.experience} years</p>
                            <button class="btn-primary" onclick="requestConsultation('${doctor.email}')">Request Consultation</button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Generate AI summary for consultation
async function generateChatSummaryForConsultation() {
    if (!currentChatId || !chats[currentChatId]) {
        return 'No chat history available.';
    }
    
    const currentChat = chats[currentChatId];
    if (!currentChat.messages || currentChat.messages.length === 0) {
        return 'No chat history available.';
    }
    
    try {
        // Get conversation text
        const conversationText = currentChat.messages.map(m => 
            `${m.role === 'user' ? 'Patient' : 'AI Doctor'}: ${m.text}`
        ).join('\n\n');
        
        const summaryPrompt = `You are a medical assistant. Based on this conversation between a patient and an AI doctor, generate a concise summary focusing on:
1. The patient's main health concern/problem
2. Key symptoms mentioned
3. Any diagnosis or treatment suggestions discussed
4. Important medical information

Keep the summary professional, clear, and focused on the patient's problem. Maximum 200 words.

Conversation:
${conversationText}

Summary:`;
        
        if (typeof CONFIG === 'undefined' || !CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
            // Fallback if no API key
            const userMessages = currentChat.messages.filter(m => m.role === 'user');
            return userMessages.map(m => m.text).join('\n\n') || 'No chat history available.';
        }
        
        const requestPayload = {
            contents: [{
                parts: [{
                    text: summaryPrompt
                }]
            }]
        };
        
        const response = await fetch(CONFIG.GEMINI_API_URL(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                let summary = data.candidates[0].content.parts[0].text.trim();
                return summary || 'Unable to generate summary.';
            }
        }
        
        // Fallback if API call fails
        const userMessages = currentChat.messages.filter(m => m.role === 'user');
        return userMessages.map(m => m.text).join('\n\n') || 'No chat history available.';
    } catch (error) {
        console.error('Error generating AI summary:', error);
        // Fallback to showing user messages only
        const userMessages = currentChat.messages.filter(m => m.role === 'user');
        return userMessages.map(m => m.text).join('\n\n') || 'No chat history available.';
    }
}

async function requestConsultation(doctorEmail) {
    // Show immediate feedback - update UI right away
    const consultationContent = document.getElementById('consultation-content');
    if (consultationContent) {
        consultationContent.innerHTML = `
            <div class="consultation-waiting">
                <div class="waiting-icon">⏳</div>
                <h4>Processing Request...</h4>
                <p>Please wait while we prepare your consultation request...</p>
                <div class="waiting-status">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        `;
    }
    
    // Close modal immediately
    closeConsultationModal();
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    
    console.log('=== REQUEST CONSULTATION - USER CHECK ===');
    console.log('User data:', userData);
    console.log('User type:', userData ? userData.user_type : 'N/A');
    
    // Verify user is a patient
    if (!userData) {
        alert('Error: Please login first.');
        // Reset consultation panel
        if (consultationContent) {
            consultationContent.innerHTML = `
                <div class="consultation-placeholder">
                    <p>Complete AI diagnosis to consult with a real doctor</p>
                </div>
            `;
        }
        return;
    }
    
    // Check user type (case-insensitive)
    const userType = userData.user_type;
    const isPatient = userType === 'Patient' || userType === 'patient' || userType?.toLowerCase() === 'patient';
    
    console.log('Is patient?', isPatient);
    
    if (!isPatient) {
        console.error('Wrong user type:', userType);
        alert(`Error: Only patients can request consultations. You are currently logged in as: "${userType || 'Unknown'}". Please logout and login as a patient.`);
        // Reset consultation panel
        if (consultationContent) {
            if (currentChatId && chats[currentChatId] && chats[currentChatId].consultationUnlocked) {
                showConsultationOption();
            } else {
                consultationContent.innerHTML = `
                    <div class="consultation-placeholder">
                        <p>Complete AI diagnosis to consult with a real doctor</p>
                    </div>
                `;
            }
        }
        return;
    }
    
    // Double-check: Get patient data from users database to ensure we have correct info
    const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
    const patientInDB = usersDB[userData.email];
    
    if (!patientInDB || patientInDB.user_type !== 'Patient') {
        alert('Error: Patient account not found. Please login again as a patient.');
        // Reset consultation panel
        if (consultationContent) {
            if (currentChatId && chats[currentChatId] && chats[currentChatId].consultationUnlocked) {
                showConsultationOption();
            } else {
                consultationContent.innerHTML = `
                    <div class="consultation-placeholder">
                        <p>Complete AI diagnosis to consult with a real doctor</p>
                    </div>
                `;
            }
        }
        return;
    }
    
    // Use patient data from database (most reliable)
    const patientData = patientInDB.user_data;
    const patientName = patientData.name || 'Unknown';
    const patientContact = patientData.contact || 'N/A';
    const patientBioData = patientData.bio_data || 'N/A';
    
    console.log('=== CREATING CONSULTATION REQUEST ===');
    console.log('Current user:', userData);
    console.log('Patient data from DB:', patientData);
    console.log('Patient name:', patientName);
    console.log('User type:', userData.user_type);
    console.log('Target doctor:', doctorEmail);
    
    // Generate AI summary for consultation request
    let chatSummary = '';
    if (currentChatId && chats[currentChatId]) {
        const currentChat = chats[currentChatId];
        // Generate summary using AI
        try {
            chatSummary = await generateChatSummaryForConsultation();
        } catch (error) {
            console.error('Error generating summary:', error);
            // Fallback to basic summary
            const userMessages = currentChat.messages.filter(m => m.role === 'user');
            chatSummary = userMessages.map(m => m.text).join('\n\n') || 'No chat history available.';
        }
    }
    
    const consultation = {
        id: Date.now(),
        patientEmail: userData.email,
        patientName: patientName, // Use verified patient name from database
        patientContact: patientContact,
        patientBioData: patientBioData,
        doctorEmail: doctorEmail,
        chatSummary: chatSummary,
        chatId: currentChatId, // Store which chat this consultation is from
        status: 'pending',
        requestedDate: new Date().toISOString()
    };
    
    console.log('Consultation object:', consultation);
    
    console.log('=== CONSULTATION REQUEST ===');
    console.log('Sending consultation request:', consultation);
    console.log('Doctor email (target):', doctorEmail);
    
    // Save consultation via API (with localStorage fallback)
    try {
        const savedConsultation = await createConsultation(consultation);
        console.log('✅ Consultation saved via API');
        console.log('Consultation:', savedConsultation);
    } catch (error) {
        // Fallback to localStorage if API fails
        const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
        consultations.push(consultation);
        localStorage.setItem('consultations', JSON.stringify(consultations));
        console.log('✅ Consultation saved to localStorage (fallback)');
    }
    
    console.log('=== END REQUEST ===');
    
    // Show immediate feedback - don't wait for async operations
    closeConsultationModal();
    showWaitingForDoctor(consultation.id);
    
    // Start polling for status updates
    startConsultationStatusPolling(consultation.id);
    
    // Show success message (non-blocking)
    setTimeout(() => {
        alert(`✅ Consultation request sent!\n\nDoctor: ${doctorEmail}\nRequest ID: ${consultation.id}\n\nThe doctor will be notified in real-time if they're online.`);
    }, 100);
}

function showWaitingForDoctor(consultationId) {
    const consultationContent = document.getElementById('consultation-content');
    consultationContent.innerHTML = `
        <div class="consultation-waiting">
            <div class="waiting-icon">⏳</div>
            <h4>Consultation Request Sent!</h4>
            <p>Waiting for doctor to accept your request...</p>
            <div class="waiting-status">
                <div class="loading-spinner"></div>
                <p id="waiting-message">Request ID: ${consultationId}</p>
            </div>
        </div>
    `;
}

// Poll for consultation status updates
let consultationPollInterval = null;

function startConsultationStatusPolling(consultationId) {
    // Clear any existing polling
    if (consultationPollInterval) {
        clearInterval(consultationPollInterval);
    }
    
    // Poll every 2 seconds for status updates
    consultationPollInterval = setInterval(async () => {
        try {
            // Try API first
            const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
            const consultations = await getConsultations(userData.email, userData.user_type);
            const consultation = consultations.find(c => c.id === consultationId);
            
            if (!consultation) {
                clearInterval(consultationPollInterval);
                return;
            }
            
            if (consultation.status === 'accepted') {
                clearInterval(consultationPollInterval);
                startVideoCall(consultation);
            } else if (consultation.status === 'rejected') {
                clearInterval(consultationPollInterval);
                document.getElementById('consultation-content').innerHTML = `
                    <div class="consultation-rejected">
                        <p>❌ Your consultation request was declined.</p>
                        <button class="btn-primary" onclick="showConsultationModal()">Request Another Consultation</button>
                    </div>
                `;
            }
        } catch (error) {
            // Fallback to localStorage
            const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
            const consultation = consultations.find(c => c.id === consultationId);
            
            if (!consultation) {
                clearInterval(consultationPollInterval);
                return;
            }
            
            if (consultation.status === 'accepted') {
                clearInterval(consultationPollInterval);
                startVideoCall(consultation);
            } else if (consultation.status === 'rejected') {
                clearInterval(consultationPollInterval);
                document.getElementById('consultation-content').innerHTML = `
                    <div class="consultation-rejected">
                        <p>❌ Your consultation request was declined.</p>
                        <button class="btn-primary" onclick="showConsultationModal()">Request Another Consultation</button>
                    </div>
                `;
            }
        }
    }, 2000); // Check every 2 seconds
}

function stopConsultationStatusPolling() {
    if (consultationPollInterval) {
        clearInterval(consultationPollInterval);
        consultationPollInterval = null;
    }
}

// Doctor Dashboard Functions
let doctorPollInterval = null;

function startDoctorRequestPolling() {
    // Only load requests once when dashboard loads - no auto-refresh
    // Doctors can manually refresh using the refresh button
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    
    if (!userData) {
        console.log('Not loading doctor requests - no user logged in');
        return;
    }
    
    // Case-insensitive check
    const userType = userData.user_type;
    const isDoctor = userType === 'Doctor' || userType === 'doctor' || userType?.toLowerCase() === 'doctor';
    
    if (!isDoctor) {
        console.log('Not loading doctor requests - user is not a doctor. User type:', userType);
        return;
    }
    
    console.log('Loading doctor requests for:', userData.email);
    
    // Load requests once when dashboard loads
    setTimeout(() => {
        loadConsultationRequests();
    }, 500); // Small delay to ensure DOM is ready
    
    // No auto-polling - doctors refresh manually
}

function stopDoctorRequestPolling() {
    if (doctorPollInterval) {
        clearInterval(doctorPollInterval);
        doctorPollInterval = null;
    }
}

async function loadConsultationRequests() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    
    const requestsList = document.getElementById('requests-list');
    
    if (!requestsList) {
        console.log('Requests list element not found - not on doctor dashboard');
        return; // Exit if not on doctor dashboard
    }
    
    // Save scroll position before updating
    const scrollPosition = requestsList.scrollTop;
    
    // Get consultations from API (with localStorage fallback)
    let consultations = [];
    try {
        consultations = await getConsultations(userData.email, userData.user_type);
    } catch (error) {
        // Fallback to localStorage
        consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    }
    
    if (!userData) {
        console.log('No user logged in');
        requestsList.innerHTML = '<p class="empty-state">No user logged in. Please login as a doctor.</p>';
        return;
    }
    
    // Case-insensitive check for doctor
    const userType = userData.user_type;
    const isDoctor = userType === 'Doctor' || userType === 'doctor' || userType?.toLowerCase() === 'doctor';
    
    console.log('Checking doctor status:', {
        userType: userType,
        isDoctor: isDoctor,
        email: userData.email
    });
    
    if (!isDoctor) {
        console.log('User is not a doctor. User type:', userType);
        requestsList.innerHTML = `<p class="empty-state">You are logged in as: "${userType || 'Unknown'}".<br>Only doctors can see consultation requests.<br>Please login as a doctor in this tab.</p>`;
        return;
    }
    
    // Debug logging
    console.log('=== LOADING CONSULTATION REQUESTS ===');
    console.log('Doctor email:', userData.email);
    console.log('Total consultations in storage:', consultations.length);
    console.log('All consultations:', consultations);
    
    // Show all consultations for this doctor (any status) for debugging
    const allDoctorConsultations = consultations.filter(c => c.doctorEmail === userData.email);
    console.log('All consultations for this doctor:', allDoctorConsultations);
    
    // Only show pending requests for this doctor
    const pendingRequests = consultations.filter(c => {
        const emailMatch = c.doctorEmail === userData.email;
        const statusMatch = c.status === 'pending';
        const matches = emailMatch && statusMatch;
        
        if (emailMatch) {
            console.log(`Found consultation for this doctor:`, {
                id: c.id,
                doctorEmail: c.doctorEmail,
                patientName: c.patientName,
                status: c.status,
                emailMatches: emailMatch,
                statusMatches: statusMatch,
                willShow: matches
            });
        }
        
        return matches;
    });
    
    console.log('Pending requests that will be shown:', pendingRequests);
    console.log('=== END LOADING ===');
    
    if (pendingRequests.length === 0) {
        if (allDoctorConsultations.length > 0) {
            // There are consultations but none are pending
            const statuses = allDoctorConsultations.map(c => c.status).join(', ');
            requestsList.innerHTML = `
                <p class="empty-state">No pending consultation requests.</p>
                <p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">
                    Found ${allDoctorConsultations.length} consultation(s) for this doctor, but none are pending.<br>
                    Statuses: ${statuses}
                </p>
                <button class="btn-refresh" onclick="debugConsultations()" style="margin-top: 1rem;">🔍 Debug Details</button>
            `;
        } else {
            requestsList.innerHTML = `
                <p class="empty-state">No pending consultation requests.</p>
                <p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">
                    ⚠️ <strong>Important:</strong> If a patient sent a request, make sure:<br>
                    1. You're using the SAME browser (different tabs)<br>
                    2. Not using incognito mode<br>
                    3. Patient requested consultation for: <strong>${userData.email}</strong>
                </p>
                <button class="btn-refresh" onclick="debugConsultations()" style="margin-top: 1rem;">🔍 Debug Details</button>
            `;
        }
        // Restore scroll position
        setTimeout(() => {
            requestsList.scrollTop = scrollPosition;
        }, 0);
        return;
    }
    
    requestsList.innerHTML = pendingRequests.map(request => `
        <div class="request-card">
            <div class="request-header">
                <h4>📋 Request from ${request.patientName}</h4>
                <span class="request-date">${formatDateTime(request.requestedDate)}</span>
            </div>
            <div class="request-summary">
                <h5>Chat Summary:</h5>
                <div class="summary-text">${formatMessage(request.chatSummary || 'No summary available.')}</div>
            </div>
            <div class="patient-info">
                <p><strong>Name:</strong> ${request.patientName}</p>
                <p><strong>Contact:</strong> ${request.patientContact}</p>
                <p><strong>Bio Data:</strong> ${request.patientBioData || 'N/A'}</p>
            </div>
            <div class="request-actions">
                <button class="btn-primary" onclick="acceptConsultation(${request.id})">✅ Accept & Start Video Call</button>
                <button class="btn-secondary" onclick="rejectConsultation(${request.id})">❌ Reject</button>
            </div>
        </div>
    `).join('');
    
    // Restore scroll position after DOM update
    setTimeout(() => {
        requestsList.scrollTop = scrollPosition;
    }, 0);
}

async function loadConsultationHistory() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const historyList = document.getElementById('history-list');
    
    if (!historyList) return;
    
    if (!userData) {
        historyList.innerHTML = '<p class="empty-state">No user logged in.</p>';
        return;
    }
    
    // Get consultations from API (with localStorage fallback)
    let consultations = [];
    try {
        consultations = await getConsultations(userData.email, userData.user_type);
    } catch (error) {
        console.error('Error fetching consultations from server, falling back to localStorage:', error);
        consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    }
    
    // Get users from server (with localStorage fallback)
    let users = {};
    try {
        users = await getAllUsers();
    } catch (error) {
        console.error('Error fetching users from server, falling back to localStorage:', error);
        users = JSON.parse(localStorage.getItem('usersDB') || '{}');
    }
    
    const history = consultations.filter(c => 
        (c.doctorEmail === userData.email || c.patientEmail === userData.email) && 
        c.status !== 'pending'
    ).sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No consultation history.</p>';
        return;
    }
    
    historyList.innerHTML = history.map(request => {
        let otherPartyName;
        if (request.patientEmail === userData.email) {
            // User is patient, show doctor name
            const doctor = users[request.doctorEmail];
            otherPartyName = doctor ? `Dr. ${doctor.user_data.name}` : request.doctorEmail;
        } else {
            // User is doctor, show patient name
            otherPartyName = request.patientName;
        }
        
        return `
            <div class="history-card">
                <div class="history-header">
                    <h4>${request.status === 'accepted' ? '✅' : '❌'} Consultation with ${otherPartyName}</h4>
                    <span class="history-date">${formatDateTime(request.requestedDate)}</span>
                </div>
                <div class="history-status">
                    <span class="status-badge status-${request.status}">${request.status}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function acceptConsultation(requestId) {
    // Update via API (with localStorage fallback)
    try {
        const consultation = await updateConsultationStatus(requestId, 'accepted');
        // Update UI
        loadConsultationRequests();
        // Start video call
        startVideoCall(consultation);
    } catch (error) {
        // Fallback to localStorage
        const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
        const request = consultations.find(c => c.id === requestId);
        
        if (!request) {
            alert('Consultation request not found.');
            return;
        }
        
        if (request.status !== 'pending') {
            alert('This consultation request has already been ' + request.status + ' by another doctor.');
            loadConsultationRequests();
            return;
        }
        
        request.status = 'accepted';
        request.acceptedDate = new Date().toISOString();
        localStorage.setItem('consultations', JSON.stringify(consultations));
        
        loadConsultationRequests();
        startVideoCall(request);
    }
}

async function rejectConsultation(requestId) {
    if (confirm('Are you sure you want to reject this consultation request?')) {
        // Update via API (with localStorage fallback)
        try {
            await updateConsultationStatus(requestId, 'rejected');
            loadConsultationRequests();
            loadConsultationHistory();
        } catch (error) {
            // Fallback to localStorage
            const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
            const request = consultations.find(c => c.id === requestId);
            
            if (!request) {
                alert('Consultation request not found.');
                return;
            }
            
            if (request.status !== 'pending') {
                alert('This consultation request has already been ' + request.status + '.');
                loadConsultationRequests();
                return;
            }
            
            request.status = 'rejected';
            request.rejectedDate = new Date().toISOString();
            localStorage.setItem('consultations', JSON.stringify(consultations));
            
            loadConsultationRequests();
            loadConsultationHistory();
        }
    }
}

let currentCallId = null;
let callEndPollInterval = null;
let callTimerInterval = null;
let callStartTime = null;
let currentConsultation = null;

async function startVideoCall(consultation) {
    // Stop polling when call starts
    stopConsultationStatusPolling();
    stopDoctorRequestPolling();
    
    // Store consultation for later use
    currentConsultation = consultation;
    
    // Set current call ID for synchronization
    let callIdToUse = consultation.id;
    
    // Mark call as active via API (with localStorage fallback)
    try {
        const result = await startCall(consultation.id);
        // Server returns { callId, consultationId }
        callIdToUse = result.callId || result;
        currentCallId = callIdToUse;
        
        // Also store in localStorage for fallback
        const activeCalls = JSON.parse(localStorage.getItem('activeCalls') || '{}');
        activeCalls[currentCallId] = {
            consultationId: consultation.id,
            startTime: new Date().toISOString(),
            ended: false
        };
        localStorage.setItem('activeCalls', JSON.stringify(activeCalls));
    } catch (error) {
        console.log('Failed to start call via API, using localStorage:', error);
        // Fallback to localStorage
        const activeCalls = JSON.parse(localStorage.getItem('activeCalls') || '{}');
        currentCallId = `call_${consultation.id}_${Date.now()}`;
        activeCalls[currentCallId] = {
            consultationId: consultation.id,
            startTime: new Date().toISOString(),
            ended: false
        };
        localStorage.setItem('activeCalls', JSON.stringify(activeCalls));
        callIdToUse = currentCallId;
    }
    
    // Hide dashboards and show video call screen
    document.getElementById('patient-dashboard').style.display = 'none';
    document.getElementById('doctor-dashboard').style.display = 'none';
    document.getElementById('video-call-screen').style.display = 'flex';
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const users = await getAllUsers();
    const isDoctor = userData && (userData.user_type === 'Doctor' || userData.user_type?.toLowerCase() === 'doctor');
    
    // Set up participant info in header
    const participantNameEl = document.getElementById('call-participant-name');
    if (isDoctor) {
        participantNameEl.textContent = `Patient: ${consultation.patientName || 'Unknown'}`;
        document.getElementById('remote-video-label').textContent = consultation.patientName || 'Patient';
        document.getElementById('remote-video-name-label').textContent = consultation.patientName || 'Patient';
    } else {
        const doctor = users[consultation.doctorEmail];
        const doctorName = (doctor && doctor.user_data && doctor.user_data.name) ? doctor.user_data.name : 'Unknown Doctor';
        participantNameEl.textContent = `Dr. ${doctorName}`;
        document.getElementById('remote-video-label').textContent = `Dr. ${doctorName}`;
        document.getElementById('remote-video-name-label').textContent = `Dr. ${doctorName}`;
    }
    
    // Set up participant details panel
    const participantDetailsEl = document.getElementById('call-participant-details');
    const callInfoTitleEl = document.getElementById('call-info-title');
    
    if (isDoctor) {
        callInfoTitleEl.textContent = '👤 Patient Information';
        participantDetailsEl.innerHTML = `
            <p><strong>Name:</strong> ${consultation.patientName || 'N/A'}</p>
            <p><strong>Contact:</strong> ${consultation.patientContact || 'N/A'}</p>
            <p><strong>Bio Data:</strong> ${consultation.patientBioData || 'N/A'}</p>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem;">💬 Chat Summary</h4>
                <div class="call-summary" style="max-height: 150px; overflow-y: auto;">${formatMessage(consultation.chatSummary || 'No summary available.')}</div>
            </div>
        `;
    } else {
        const doctor = users[consultation.doctorEmail];
        callInfoTitleEl.textContent = '👨‍⚕️ Doctor Information';
        if (doctor && doctor.user_data) {
            const doctorName = doctor.user_data.name || 'Unknown Doctor';
            const specialization = doctor.user_data.specialization || 'N/A';
            const contact = doctor.user_data.contact || 'N/A';
            const experience = doctor.user_data.experience || 0;
            const bio = doctor.user_data.bio || 'N/A';
            
            participantDetailsEl.innerHTML = `
                <p><strong>Name:</strong> Dr. ${doctorName}</p>
                <p><strong>Specialization:</strong> ${specialization}</p>
                <p><strong>Contact:</strong> ${contact}</p>
                <p><strong>Experience:</strong> ${experience} years</p>
                <p><strong>Bio:</strong> ${bio}</p>
            `;
        } else {
            participantDetailsEl.innerHTML = `<p>Doctor information not available.</p>`;
        }
    }
    
    // Set up prescription panel
    const prescriptionTextarea = document.getElementById('prescription-textarea');
    const prescriptionActions = document.getElementById('prescription-actions');
    const prescriptionNotice = document.getElementById('prescription-readonly-notice');
    
    if (isDoctor) {
        // Doctor can edit prescription
        prescriptionTextarea.removeAttribute('readonly');
        prescriptionTextarea.placeholder = 'Write prescription here... (Updates in real-time for patient)';
        prescriptionActions.style.display = 'flex';
        prescriptionNotice.style.display = 'none';
        
        // Load existing prescription if any
        if (consultation.prescription) {
            prescriptionTextarea.value = consultation.prescription;
        } else {
            prescriptionTextarea.value = '';
        }
    } else {
        // Patient can only view prescription
        prescriptionTextarea.setAttribute('readonly', 'true');
        prescriptionTextarea.placeholder = 'Prescription will appear here when the doctor writes it...';
        prescriptionActions.style.display = 'none';
        
        // Load existing prescription if any
        if (consultation.prescription) {
            prescriptionTextarea.value = consultation.prescription;
            prescriptionNotice.style.display = 'none';
        } else {
            prescriptionTextarea.value = '';
            prescriptionNotice.style.display = 'block';
        }
    }
    
    // Initialize video streams (placeholder for now - WebRTC can be added later)
    initializeVideoStreams();
    
    // Start call timer
    callStartTime = new Date();
    startCallTimer();
    
    // Start polling for call end signal
    startCallEndPolling();
}

function startCallEndPolling() {
    // Clear any existing polling
    if (callEndPollInterval) {
        clearInterval(callEndPollInterval);
    }
    
    // Poll every 1 second to check if call was ended by other party
    callEndPollInterval = setInterval(async () => {
        if (!currentCallId) return;
        
        // Check API first (for global synchronization)
        try {
            // Try both callId and consultation ID
            const checkIds = [currentCallId];
            if (currentConsultation && currentConsultation.id) {
                checkIds.push(currentConsultation.id);
            }
            
            for (const checkId of checkIds) {
                try {
                    const callStatus = await getCallStatus(checkId);
                    if (callStatus && callStatus.ended) {
                        // Call was ended by other party via API
                        console.log('Call ended detected via API polling for:', checkId);
                        endVideoCall();
                        return;
                    }
                } catch (err) {
                    // Try next ID
                }
            }
        } catch (error) {
            // Fallback to localStorage if API fails
            console.log('API call status check failed, using localStorage fallback:', error);
        }
        
        // Also check localStorage as fallback
        try {
            const activeCalls = JSON.parse(localStorage.getItem('activeCalls') || '{}');
            // Check by callId or consultation ID
            const call = activeCalls[currentCallId] || 
                        (currentConsultation && activeCalls[currentConsultation.id]);
            
            if (call && call.ended) {
                // Call was ended by other party
                console.log('Call ended detected via localStorage polling');
                endVideoCall();
            }
        } catch (error) {
            console.error('Error checking localStorage for call end:', error);
        }
    }, 1000); // Check every second
}

function stopCallEndPolling() {
    if (callEndPollInterval) {
        clearInterval(callEndPollInterval);
        callEndPollInterval = null;
    }
}

// Initialize video streams (placeholder - WebRTC can be added later)
function initializeVideoStreams() {
    // Request user media for local video
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                const localVideo = document.getElementById('local-video');
                if (localVideo) {
                    localVideo.srcObject = stream;
                    localVideo.play().catch(err => console.log('Video play error:', err));
                    
                    // Hide placeholder when video starts
                    const placeholder = document.getElementById('local-video-placeholder');
                    if (placeholder) placeholder.style.display = 'none';
                    
                    // Mark video box as active
                    const localVideoBox = document.getElementById('local-video-box');
                    if (localVideoBox) {
                        localVideoBox.setAttribute('data-video-active', 'true');
                    }
                }
            })
            .catch(error => {
                console.log('Could not access camera/microphone:', error);
                // Continue without video - user can still use the call
                // Show a message that video is unavailable
                const placeholder = document.getElementById('local-video-placeholder');
                if (placeholder) {
                    placeholder.querySelector('p').textContent = 'Camera unavailable';
                }
            });
    } else {
        console.log('getUserMedia not supported in this browser');
    }
}

// Call timer functions
function startCallTimer() {
    stopCallTimer(); // Clear any existing timer
    callStartTime = new Date();
    
    callTimerInterval = setInterval(() => {
        if (!callStartTime) return;
        
        const elapsed = Math.floor((new Date() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        const timerEl = document.getElementById('call-timer');
        if (timerEl) {
            timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
}

// Prescription functions
let prescriptionDebounceTimer = null;

function onPrescriptionChange() {
    if (!currentCallId || !currentConsultation) return;
    
    const prescriptionTextarea = document.getElementById('prescription-textarea');
    const prescription = prescriptionTextarea.value;
    
    // Debounce to avoid too many updates
    if (prescriptionDebounceTimer) {
        clearTimeout(prescriptionDebounceTimer);
    }
    
    prescriptionDebounceTimer = setTimeout(() => {
        // Send prescription update via Socket.io
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('prescriptionUpdate', {
                callId: currentCallId,
                consultationId: currentConsultation.id,
                prescription: prescription
            });
        }
    }, 500); // Wait 500ms after user stops typing
}

function clearPrescription() {
    const prescriptionTextarea = document.getElementById('prescription-textarea');
    if (prescriptionTextarea && confirm('Are you sure you want to clear the prescription?')) {
        prescriptionTextarea.value = '';
        onPrescriptionChange(); // Sync the clear
    }
}

async function savePrescription() {
    if (!currentCallId || !currentConsultation) return;
    
    const prescriptionTextarea = document.getElementById('prescription-textarea');
    const prescription = prescriptionTextarea.value.trim();
    
    if (!prescription) {
        alert('Please write a prescription before saving.');
        return;
    }
    
    // Save to consultation
    try {
        // Update consultation with prescription via API
        const consultations = await getConsultations(currentConsultation.patientEmail || currentConsultation.doctorEmail, 'Patient');
        const consultation = consultations.find(c => c.id === currentConsultation.id);
        
        if (consultation) {
            consultation.prescription = prescription;
            consultation.prescriptionUpdatedAt = new Date().toISOString();
            
            // Save to localStorage
            const allConsultations = JSON.parse(localStorage.getItem('consultations') || '[]');
            const index = allConsultations.findIndex(c => c.id === consultation.id);
            if (index !== -1) {
                allConsultations[index] = consultation;
                localStorage.setItem('consultations', JSON.stringify(allConsultations));
            }
        }
        
        alert('✅ Prescription saved successfully!');
    } catch (error) {
        console.error('Error saving prescription:', error);
        alert('Prescription saved locally. Some features may not work until server connection is restored.');
    }
}

async function endVideoCall() {
    // Stop video streams
    const localVideo = document.getElementById('local-video');
    if (localVideo && localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach(track => track.stop());
    }
    
    // Stop timer
    stopCallTimer();
    
    // Mark call as ended via API (with localStorage fallback)
    // Try to end by callId, or by consultation ID if available
    const callIdsToTry = [];
    if (currentCallId) {
        callIdsToTry.push(currentCallId);
    }
    if (currentConsultation && currentConsultation.id) {
        callIdsToTry.push(currentConsultation.id);
    }
    
    let callEnded = false;
    for (const callId of callIdsToTry) {
        try {
            await endCall(callId);
            callEnded = true;
            console.log('✅ Call ended via API for callId:', callId);
            break;
        } catch (error) {
            console.log('Failed to end call with callId:', callId, error);
        }
    }
    
    // Fallback to localStorage
    if (!callEnded) {
        const activeCalls = JSON.parse(localStorage.getItem('activeCalls') || '{}');
        for (const callId of callIdsToTry) {
            if (activeCalls[callId]) {
                activeCalls[callId].ended = true;
                activeCalls[callId].endTime = new Date().toISOString();
                localStorage.setItem('activeCalls', JSON.stringify(activeCalls));
                console.log('✅ Call ended via localStorage for callId:', callId);
                break;
            }
        }
    }
    
    // Stop polling
    stopCallEndPolling();
    stopConsultationStatusPolling(); // Stop patient's consultation status polling
    
    // Clear current call ID
    currentCallId = null;
    currentConsultation = null;
    
    document.getElementById('video-call-screen').style.display = 'none';
    loadDashboard();
    loadConsultationRequests();
    loadConsultationHistory();
    
    // Reset consultation panel based on current chat state
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (userData) {
        const userType = userData.user_type;
        const isPatient = userType === 'Patient' || userType === 'patient' || userType?.toLowerCase() === 'patient';
        
        if (isPatient) {
            // Reset consultation panel for patient
            if (currentChatId && chats[currentChatId]) {
                const currentChat = chats[currentChatId];
                if (currentChat.consultationUnlocked) {
                    // Show consultation option if unlocked
                    showConsultationOption();
                } else {
                    // Show placeholder
                    const consultationContent = document.getElementById('consultation-content');
                    if (consultationContent) {
                        consultationContent.innerHTML = `
                            <div class="consultation-placeholder">
                                <p>Complete AI diagnosis to consult with a real doctor</p>
                            </div>
                        `;
                    }
                }
            } else {
                // No current chat, show placeholder
                const consultationContent = document.getElementById('consultation-content');
                if (consultationContent) {
                    consultationContent.innerHTML = `
                        <div class="consultation-placeholder">
                            <p>Complete AI diagnosis to consult with a real doctor</p>
                        </div>
                    `;
                }
            }
        }
    }
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function logout() {
    // Stop all polling before logout
    stopConsultationStatusPolling();
    stopDoctorRequestPolling();
    stopOnlineStatusPolling();
    stopCallEndPolling();
    
    // End any active call
    if (currentCallId) {
        endVideoCall();
    }
    
    // Remove from sessionStorage (tab-specific)
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Debug function to see all consultations
function debugConsultations() {
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
    
    let debugInfo = `
=== DEBUG INFORMATION ===
Current User Email: ${userData ? userData.email : 'None'}
Current User Type: ${userData ? userData.user_type : 'None'}
Current User Type (raw): ${userData ? JSON.stringify(userData.user_type) : 'None'}

User in Database:
${userData && usersDB[userData.email] ? `
  Email: ${userData.email}
  User Type in DB: ${usersDB[userData.email].user_type}
  User Type Match: ${usersDB[userData.email].user_type === userData.user_type ? '✅ MATCH' : '❌ MISMATCH'}
` : 'User not found in database'}

Total Consultations: ${consultations.length}

All Consultations:
${JSON.stringify(consultations, null, 2)}
`;
    
    if (userData && userData.user_type === 'Doctor' || userData?.user_type?.toLowerCase() === 'doctor') {
        debugInfo += `
Consultations for this doctor (${userData.email}):
${consultations.filter(c => c.doctorEmail === userData.email).map(c => 
    `ID: ${c.id}\n` +
    `Doctor: ${c.doctorEmail}\n` +
    `Patient: ${c.patientName} (${c.patientEmail})\n` +
    `Status: ${c.status}\n` +
    `Date: ${c.requestedDate}\n` +
    `---\n`
).join('\n')}

Pending for this doctor:
${consultations.filter(c => c.doctorEmail === userData.email && c.status === 'pending').length}
`;
    }
    
    debugInfo += `
=== END DEBUG ===
    `;
    
    console.log(debugInfo);
    alert(debugInfo);
    
    // Also reload requests if doctor
    if (userData && (userData.user_type === 'Doctor' || userData.user_type?.toLowerCase() === 'doctor')) {
        loadConsultationRequests();
    }
}

// New function to check user account details
function checkUserAccount() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
    
    if (!userData) {
        alert('No user logged in.');
        return;
    }
    
    const dbUser = usersDB[userData.email];
    
    const accountInfo = `
=== YOUR ACCOUNT DETAILS ===

Currently Logged In:
  Email: ${userData.email}
  User Type: "${userData.user_type}"
  Name: ${userData.user_data?.name || 'N/A'}

In Database:
  ${dbUser ? `
    Email: ${dbUser.email || userData.email}
    User Type: "${dbUser.user_type}"
    Registered: ${dbUser.registered_date || 'N/A'}
    Name: ${dbUser.user_data?.name || 'N/A'}
  ` : '❌ Account not found in database!'}

${dbUser && dbUser.user_type !== userData.user_type ? 
  '⚠️ WARNING: User type mismatch between session and database!' : 
  '✅ User type matches'}
    `;
    
    console.log(accountInfo);
    alert(accountInfo);
}

// Online Status Tracking Functions
function initializeOnlineStatus() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    // Mark current user as online if they're a doctor
    const userType = userData.user_type;
    const isDoctor = userType === 'Doctor' || userType === 'doctor' || userType?.toLowerCase() === 'doctor';
    
    if (isDoctor) {
        // Mark this doctor as online
        markDoctorOnline(userData.email);
        
        // Update online status when page becomes visible
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                markDoctorOnline(userData.email);
            }
        });
        
        // Mark as online on page unload (will be cleared after timeout)
        window.addEventListener('beforeunload', function() {
            markDoctorOnline(userData.email);
        });
    }
    
    // Load online doctors from localStorage
    loadOnlineDoctors();
}

function markDoctorOnline(doctorEmail) {
    if (!doctorEmail) return;
    
    // Add to online set
    onlineDoctors.add(doctorEmail);
    
    // Save to localStorage with timestamp
    const onlineStatus = JSON.parse(localStorage.getItem('onlineDoctors') || '{}');
    onlineStatus[doctorEmail] = Date.now();
    localStorage.setItem('onlineDoctors', JSON.stringify(onlineStatus));
}

function loadOnlineDoctors() {
    const onlineStatus = JSON.parse(localStorage.getItem('onlineDoctors') || '{}');
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes timeout
    
    // Clear old entries and load current online doctors
    onlineDoctors.clear();
    Object.keys(onlineStatus).forEach(email => {
        const lastSeen = onlineStatus[email];
        if (now - lastSeen < timeout) {
            onlineDoctors.add(email);
        }
    });
    
    // Clean up old entries
    const cleanedStatus = {};
    Object.keys(onlineStatus).forEach(email => {
        if (now - onlineStatus[email] < timeout) {
            cleanedStatus[email] = onlineStatus[email];
        }
    });
    localStorage.setItem('onlineDoctors', JSON.stringify(cleanedStatus));
}

let onlineStatusPollInterval = null;

function startOnlineStatusPolling() {
    // Clear any existing polling
    if (onlineStatusPollInterval) {
        clearInterval(onlineStatusPollInterval);
    }
    
    // Poll every 30 seconds to update online status
    onlineStatusPollInterval = setInterval(() => {
        const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        if (userData) {
            const userType = userData.user_type;
            const isDoctor = userType === 'Doctor' || userType === 'doctor' || userType?.toLowerCase() === 'doctor';
            
            if (isDoctor) {
                markDoctorOnline(userData.email);
            }
        }
        
        // Reload online doctors list
        loadOnlineDoctors();
        
        // Refresh doctor list if consultation modal is open
        const consultationModal = document.getElementById('consultation-modal');
        if (consultationModal && consultationModal.style.display === 'block') {
            loadAvailableDoctors();
        }
    }, 30000); // Every 30 seconds
}

function stopOnlineStatusPolling() {
    if (onlineStatusPollInterval) {
        clearInterval(onlineStatusPollInterval);
        onlineStatusPollInterval = null;
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const medicineModal = document.getElementById('medicine-modal');
    const consultationModal = document.getElementById('consultation-modal');
    
    if (event.target === medicineModal) {
        closeMedicineModal();
    }
    if (event.target === consultationModal) {
        closeConsultationModal();
    }
}

