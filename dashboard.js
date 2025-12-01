// Gemini API Configuration - uses CONFIG from config.js

// Global variables for multi-chat system
let currentChatId = null;
let chats = {}; // { chatId: { id, title, messages, consultationUnlocked, createdAt, updatedAt } }
let onlineDoctors = new Set(); // Track online doctors

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    initializeChatbot();
    initializeOnlineStatus();
    initializeTheme();
    loadSettings();
    
    // Initialize compact mode on page load
    const compactMode = localStorage.getItem('compactMode') === 'true';
    if (compactMode) {
        document.body.classList.add('compact-mode');
    }
    
    // Set default dates for medicine form
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('med-start-date');
    const endDateInput = document.getElementById('med-end-date');
    if (startDateInput) startDateInput.value = today;
    if (endDateInput) endDateInput.setAttribute('min', today);
    
    // Load user-specific data based on user type
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (userData) {
        const userType = userData.user_type;
        const isPatient = userType === 'Patient' || userType === 'patient' || userType?.toLowerCase() === 'patient';
        
        if (isPatient) {
            // Load patient-specific data
            loadMedicineSchedule();
            // Main tab data is already loaded by loadDashboard
        } else {
            // Load doctor-specific data
            loadConsultationRequests();
            loadConsultationHistory();
        }
    }
    
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
        const patientName = (userInfo && userInfo.name) ? userInfo.name : 'User';
        document.getElementById('welcome-message').textContent = `👋 Welcome, ${patientName}!`;
        document.getElementById('user-type-display').textContent = 'You are logged in as a Patient';
        console.log('Loaded patient dashboard');
        
        // Load medicine schedule
        loadMedicineSchedule();
    } else {
        document.getElementById('patient-dashboard').style.display = 'none';
        document.getElementById('doctor-dashboard').style.display = 'block';
        const doctorName = (userInfo && userInfo.name) ? userInfo.name : 'User';
        document.getElementById('doctor-welcome-message').textContent = `👋 Welcome, Dr. ${doctorName}!`;
        const specialization = (userInfo && userInfo.specialization) ? userInfo.specialization : 'General';
        document.getElementById('doctor-type-display').textContent = `You are logged in as a Doctor - ${specialization} Specialist`;
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
        // Call server endpoint (API key is server-side only - secure)
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
    const fullPrompt = `You are an AI medical assistant. Provide helpful medical guidance, diagnosis suggestions, treatment recommendations, and medication information. Be professional, empathetic, and helpful.

CRITICAL GUIDELINES:
1. DO NOT assume or jump to conclusions based on limited information. If the patient provides only 1-2 lines about their problem, ALWAYS ask follow-up questions to gather more relevant information before providing any diagnosis or treatment advice.
2. Ask specific, relevant questions like: "When did this start?", "Can you describe the severity?", "Any other symptoms?", "Have you taken any medications?", etc.
3. Only provide diagnosis/treatment suggestions after you have gathered sufficient information through follow-up questions.
4. If the patient asks for permission/allows/requests to consult with a real doctor, IMMEDIATELY grant permission and say something like: "Yes, absolutely! You can now consult with a real doctor. The consultation option has been enabled."
5. After providing a helpful response or when the conversation seems complete, you may suggest consulting a real doctor if appropriate.

IMPORTANT: Keep your responses CONCISE but thorough. Aim for 2-6 sentences when providing information, but don't hesitate to ask follow-up questions when needed. Be clear and direct. Provide treatment advice like a real doctor would.

Current question: ${message}${conversationContext}

Please provide a helpful, concise medical response:`;
    
    // Build the request payload
    // Call Gemini API via server endpoint (secure - API key not exposed)
    console.log('Calling Gemini API via server endpoint');
    
    // Get API_BASE_URL from api-client.js (it's defined globally there)
    const apiBaseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);
    
    const response = await fetch(`${apiBaseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: fullPrompt })
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
                errorMessage += 'Authentication failed. Please check that the GEMINI_API_KEY environment variable is set on the server.';
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
        
        // Check if patient asked for permission to consult (in their message)
        const userMessage = message.toLowerCase();
        const askedForPermission = userMessage.includes('can i consult') || 
                                   userMessage.includes('may i consult') ||
                                   userMessage.includes('allow me to consult') ||
                                   userMessage.includes('permission to consult') ||
                                   userMessage.includes('want to consult') ||
                                   userMessage.includes('would like to consult') ||
                                   userMessage.includes('consult a doctor') ||
                                   userMessage.includes('consult with a doctor') ||
                                   userMessage.includes('see a doctor') ||
                                   userMessage.includes('talk to a doctor');
        
        // Check if AI granted permission or conversation seems complete
        const aiResponseLower = aiResponse.toLowerCase();
        const aiGrantedPermission = aiResponseLower.includes('consult with a real doctor') ||
                                   aiResponseLower.includes('consultation option') ||
                                   aiResponseLower.includes('consultation has been enabled') ||
                                   aiResponseLower.includes('you can now consult') ||
                                   aiResponseLower.includes('absolutely! you can');
        
        // Check if diagnosis/consultation seems complete
        const diagnosisComplete = aiResponseLower.includes('diagnosis') || 
                                  aiResponseLower.includes('treatment') ||
                                  aiResponseLower.includes('medication') ||
                                  aiResponseLower.includes('medicine') ||
                                  aiResponseLower.includes('suggest consulting') ||
                                  aiResponseLower.includes('recommend consulting') ||
                                  aiResponseLower.includes('consult a doctor') ||
                                  aiResponseLower.includes('see a doctor') ||
                                  aiResponseLower.includes('seek medical');
        
        // Unlock consultation if:
        // 1. Patient asked for permission and AI granted it, OR
        // 2. Patient asked for permission, OR
        // 3. Conversation seems complete (diagnosis/treatment provided)
        if (askedForPermission || aiGrantedPermission || diagnosisComplete) {
            markDiagnosisComplete(aiResponse);
        }
        
        // Also check after a few messages if conversation seems naturally complete
        // Use setTimeout to ensure messages are saved first
        setTimeout(() => {
            const updatedChat = chats[currentChatId];
            if (updatedChat && updatedChat.messages && !updatedChat.consultationUnlocked) {
                const messageCount = updatedChat.messages.length;
                if (messageCount >= 4) {
                    // Check if conversation has natural ending signals
                    const lastFewMessages = updatedChat.messages.slice(-4).map(m => m.text.toLowerCase()).join(' ');
                    const hasEndingSignals = lastFewMessages.includes('thank') ||
                                             lastFewMessages.includes('that helps') ||
                                             lastFewMessages.includes('got it') ||
                                             lastFewMessages.includes('understand') ||
                                             lastFewMessages.includes('clear') ||
                                             lastFewMessages.includes('okay') ||
                                             lastFewMessages.includes('ok');
                    
                    const hasCompletionSignals = aiResponseLower.includes('consult') ||
                                                 aiResponseLower.includes('doctor') ||
                                                 aiResponseLower.includes('complete') ||
                                                 aiResponseLower.includes('finished') ||
                                                 diagnosisComplete;
                    
                    if (hasEndingSignals && hasCompletionSignals) {
                        markDiagnosisComplete(aiResponse);
                    }
                }
            }
        }, 500);
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
        
        console.log('Generating chat title via server endpoint...');
        
        const apiBaseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);
        const response = await fetch(`${apiBaseUrl}/api/gemini/title`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: titlePrompt })
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
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Failed to generate title. Response:', response.status, errorData);
            if (response.status === 500 && errorData.error && errorData.error.includes('not configured')) {
                console.warn('Gemini API key not configured on server');
            }
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
        
        console.log('✅ Consultation option unlocked for chat:', currentChatId);
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

// Medicine Schedule Functions - Enhanced to show prescriptions and reminders
function loadMedicineSchedule() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const scheduleList = document.getElementById('medicine-schedule-list');
    if (!scheduleList) return;
    
    const patientEmail = userData.email;
    
    // Get medication schedules from prescriptions (doctor-prescribed)
    const schedules = getMedicationSchedule(patientEmail);
    
    // Get medical reminders (patient-set)
    const reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
    const userReminders = reminders.filter(r => r.patientEmail === patientEmail && r.enabled);
    
    // Combine both sources
    let allMedications = [];
    
    // Add medications from prescriptions
    schedules.forEach(schedule => {
        schedule.medications.forEach(med => {
            allMedications.push({
                ...med,
                source: 'prescription',
                consultationId: schedule.consultationId,
                doctorEmail: schedule.doctorEmail,
                createdAt: schedule.createdAt
            });
        });
    });
    
    // Add medications from reminders
    userReminders.forEach(reminder => {
        reminder.days.forEach(day => {
            allMedications.push({
                name: reminder.medication,
                dosage: reminder.dosage || 'As prescribed',
                time: reminder.time,
                timeOfDay: getTimeOfDayFromTime(reminder.time),
                source: 'reminder',
                reminderId: reminder.id,
                days: [day]
            });
        });
    });
    
    if (allMedications.length === 0) {
        scheduleList.innerHTML = `
            <div class="empty-state" style="padding: 2rem; text-align: center; color: #666;">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">💊 No medications scheduled</p>
                <p style="font-size: 0.9rem;">Medications from doctor prescriptions and your reminders will appear here.</p>
            </div>
        `;
        return;
    }
    
    // Group by time of day
    const groupedByTime = {
        morning: [],
        afternoon: [],
        evening: [],
        night: []
    };
    
    allMedications.forEach(med => {
        const timeOfDay = med.timeOfDay || inferTimeOfDay(med.time || '');
        const timeKey = timeOfDay === 'morning' ? 'morning' : 
                       timeOfDay === 'afternoon' ? 'afternoon' :
                       timeOfDay === 'evening' ? 'evening' : 'night';
        
        // Check for duplicates
        const exists = groupedByTime[timeKey].some(existing => 
            existing.name.toLowerCase() === med.name.toLowerCase() && 
            existing.time === med.time &&
            existing.source === med.source
        );
        
        if (!exists) {
            groupedByTime[timeKey].push(med);
        }
    });
    
    // Build display
    let html = '<div class="medicine-schedule-display">';
    
    const timeLabels = {
        morning: { label: '🌅 Morning', defaultTime: '08:00' },
        afternoon: { label: '☀️ Afternoon', defaultTime: '14:00' },
        evening: { label: '🌆 Evening', defaultTime: '18:00' },
        night: { label: '🌙 Night', defaultTime: '20:00' }
    };
    
    let hasAnyMeds = false;
    Object.keys(timeLabels).forEach(timeKey => {
        if (groupedByTime[timeKey].length > 0) {
            hasAnyMeds = true;
            const { label, defaultTime } = timeLabels[timeKey];
            const meds = groupedByTime[timeKey];
            
            html += `<div class="medication-time-group" style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">`;
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">`;
            html += `<h4 style="margin: 0; color: #333; font-size: 1rem;">${label}</h4>`;
            html += `<span style="color: #667eea; font-weight: 600; font-size: 0.9rem;">${meds[0].time || defaultTime}</span>`;
            html += `</div>`;
            
            html += `<div class="medication-list">`;
            meds.forEach(med => {
                const sourceBadge = med.source === 'prescription' 
                    ? '<span style="background: #28a745; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">👨‍⚕️ Prescribed</span>'
                    : '<span style="background: #ffc107; color: #333; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">⏰ Reminder</span>';
                
                html += `<div class="medication-item" style="background: white; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 6px; border-left: 3px solid #667eea;">`;
                html += `<div style="display: flex; align-items: center; justify-content: space-between;">`;
                html += `<div class="medication-name" style="font-weight: 600; color: #333; font-size: 0.95rem;">💊 ${med.name}</div>`;
                html += `${sourceBadge}`;
                html += `</div>`;
                if (med.dosage && med.dosage.trim()) {
                    html += `<div class="medication-dosage" style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">💉 ${med.dosage}</div>`;
                }
                html += `<div class="medication-time" style="color: #999; font-size: 0.8rem; margin-top: 0.25rem;">⏰ ${med.time || defaultTime}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
            html += `</div>`;
        }
    });
    
    if (!hasAnyMeds) {
        html += `<div class="empty-state" style="padding: 2rem; text-align: center; color: #666;">`;
        html += `<p>No medications scheduled for today.</p>`;
        html += `</div>`;
    }
    
    html += '</div>';
    scheduleList.innerHTML = html;
}

// Helper function to get time of day from time string
function getTimeOfDayFromTime(timeStr) {
    if (!timeStr) return 'morning';
    const hour = parseInt(timeStr.split(':')[0]);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

// Old function kept for backward compatibility
function loadOldMedicineSchedule() {
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
    
    // Refresh online doctors list when modal opens to ensure latest status
    setTimeout(() => {
        // Refresh after a short delay to ensure Socket.io is connected
        if (typeof getOnlineDoctors === 'function') {
            getOnlineDoctors().then(onlineDoctorsList => {
                if (onlineDoctorsList && onlineDoctorsList.size > 0) {
                    onlineDoctorsList.forEach(email => onlineDoctors.add(email));
                    console.log(`🔄 Refreshed online doctors when opening modal: ${onlineDoctors.size} doctors`);
                    loadAvailableDoctors(); // Reload the list with updated online status
                }
            }).catch(err => {
                console.error('Error refreshing online doctors:', err);
            });
        }
    }, 500); // Small delay to ensure socket is connected
}

function closeConsultationModal() {
    document.getElementById('consultation-modal').style.display = 'none';
    
    // Clear search input when closing modal
    const searchInput = document.getElementById('doctor-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
}

// Global variables for doctor data
let allDoctorsCache = [];
let consultedDoctorsCache = new Set();
let currentlyDisplayedDoctors = [];

async function loadAvailableDoctors() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    // Get users from server (with localStorage fallback)
    let users = {};
    try {
        users = await getAllUsers();
        // Merge with localStorage to ensure we have all doctors
        const localUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
        users = { ...localUsers, ...users }; // localStorage takes precedence for local doctors
    } catch (error) {
        console.error('Error fetching users from server, falling back to localStorage:', error);
        users = JSON.parse(localStorage.getItem('usersDB') || '{}');
    }
    
    // Get consultations from API (with localStorage fallback)
    let consultations = [];
    try {
        consultations = await getConsultations(userData.email, userData.user_type);
        // Merge with localStorage consultations
        const localConsultations = JSON.parse(localStorage.getItem('consultations') || '[]');
        const consultationMap = new Map();
        [...localConsultations, ...consultations].forEach(c => {
            if (!consultationMap.has(c.id) || new Date(c.createdAt || c.requestedDate) > new Date(consultationMap.get(c.id).createdAt || consultationMap.get(c.id).requestedDate)) {
                consultationMap.set(c.id, c);
            }
        });
        consultations = Array.from(consultationMap.values());
    } catch (error) {
        console.error('Error fetching consultations from server, falling back to localStorage:', error);
        consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    }
    
    // Get online doctors from API (merge with existing Socket.io updates, don't replace)
    try {
        const onlineDoctorsList = await getOnlineDoctors();
        // Merge API results with existing Socket.io real-time updates
        if (onlineDoctorsList && onlineDoctorsList.size > 0) {
            onlineDoctorsList.forEach(email => {
                onlineDoctors.add(email);
            });
            console.log(`📡 Fetched ${onlineDoctorsList.size} online doctors from server, total now: ${onlineDoctors.size}`);
        } else {
            console.log('📡 No online doctors found in API response');
        }
    } catch (error) {
        console.error('Error fetching online doctors from API:', error);
        // Keep existing onlineDoctors set from Socket.io events
    }
    
    // Get all doctors and store in cache - include ALL doctors regardless of online status
    allDoctorsCache = Object.keys(users)
        .filter(email => {
            const userType = users[email].user_type;
            return userType === 'Doctor' || userType === 'doctor' || userType?.toLowerCase() === 'doctor';
        })
        .map(email => ({
            email,
            ...users[email],
            doctorName: (users[email].user_data && users[email].user_data.name) 
                ? users[email].user_data.name 
                : (email.split('@')[0] || 'Unknown Doctor'),
            specialization: (users[email].user_data && users[email].user_data.specialization) 
                ? users[email].user_data.specialization 
                : 'N/A',
            experience: (users[email].user_data && users[email].user_data.experience) 
                ? users[email].user_data.experience 
                : 0
        }));
    
    console.log(`📋 Loaded ${allDoctorsCache.length} total doctors into cache`);
    
    // Get doctors the patient has consulted with (any consultation status)
    consultedDoctorsCache = new Set();
    consultations.forEach(consultation => {
        if (consultation.patientEmail === userData.email) {
            // Include all consultations, not just accepted ones
            consultedDoctorsCache.add(consultation.doctorEmail);
        }
    });
    
    // Default: Show previously consulted doctors + online doctors
    // Previously consulted doctors are ALWAYS shown (even if offline)
    const consultedDoctorsList = allDoctorsCache.filter(doctor => 
        consultedDoctorsCache.has(doctor.email)
    );
    
    // Add online doctors who aren't already in consulted list
    const onlineDoctorsList = allDoctorsCache.filter(doctor => {
        const isOnline = onlineDoctors.has(doctor.email);
        const alreadyInList = consultedDoctorsCache.has(doctor.email);
        return isOnline && !alreadyInList;
    });
    
    currentlyDisplayedDoctors = [...consultedDoctorsList, ...onlineDoctorsList];
    
    // Clear search input
    const searchInput = document.getElementById('doctor-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    renderDoctors(currentlyDisplayedDoctors);
}

// Filter doctors based on search query
function filterDoctors(searchQuery) {
    if (!searchQuery || searchQuery.trim() === '') {
        // No search query - show default: consulted + online doctors
        loadAvailableDoctors();
        return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    // Ensure allDoctorsCache is populated - load from localStorage if empty
    if (allDoctorsCache.length === 0) {
        const users = JSON.parse(localStorage.getItem('usersDB') || '{}');
        allDoctorsCache = Object.keys(users)
            .filter(email => {
                const userType = users[email].user_type;
                return userType === 'Doctor' || userType === 'doctor' || userType?.toLowerCase() === 'doctor';
            })
            .map(email => ({
                email,
                ...users[email],
                doctorName: (users[email].user_data && users[email].user_data.name) 
                    ? users[email].user_data.name 
                    : (email.split('@')[0] || 'Unknown Doctor'),
                specialization: (users[email].user_data && users[email].user_data.specialization) 
                    ? users[email].user_data.specialization 
                    : 'N/A',
                experience: (users[email].user_data && users[email].user_data.experience) 
                    ? users[email].user_data.experience 
                    : 0
            }));
        console.log(`📋 Loaded ${allDoctorsCache.length} doctors from localStorage for search`);
    }
    
    // Refresh online doctors from API before filtering (to ensure latest status)
    // Do this in background - don't block search
    if (typeof getOnlineDoctors === 'function') {
        getOnlineDoctors().then(onlineDoctorsList => {
            if (onlineDoctorsList && onlineDoctorsList.size > 0) {
                onlineDoctorsList.forEach(email => onlineDoctors.add(email));
                // Re-render with updated online status (don't re-filter to avoid recursion)
                renderDoctors(currentlyDisplayedDoctors, true);
            }
        }).catch(err => {
            console.error('Error fetching online doctors during search:', err);
        });
    }
    
    // Search through ALL doctors (including offline ones)
    const filtered = allDoctorsCache.filter(doctor => {
        const name = (doctor.doctorName || '').toLowerCase();
        const specialization = (doctor.specialization || '').toLowerCase();
        const email = (doctor.email || '').toLowerCase();
        const experience = String(doctor.experience || 0);
        const bio = (doctor.user_data?.bio || '').toLowerCase();
        
        return name.includes(query) || 
               specialization.includes(query) || 
               email.includes(query) ||
               experience.includes(query) ||
               bio.includes(query);
    });
    
    currentlyDisplayedDoctors = filtered;
    renderDoctors(filtered, true); // true indicates we're in search mode
}

// Show all registered doctors (online and offline)
function showAllDoctors() {
    // Ensure allDoctorsCache is populated
    if (allDoctorsCache.length === 0) {
        const users = JSON.parse(localStorage.getItem('usersDB') || '{}');
        allDoctorsCache = Object.keys(users)
            .filter(email => {
                const userType = users[email].user_type;
                return userType === 'Doctor' || userType === 'doctor' || userType?.toLowerCase() === 'doctor';
            })
            .map(email => ({
                email,
                ...users[email],
                doctorName: (users[email].user_data && users[email].user_data.name) 
                    ? users[email].user_data.name 
                    : (email.split('@')[0] || 'Unknown Doctor'),
                specialization: (users[email].user_data && users[email].user_data.specialization) 
                    ? users[email].user_data.specialization 
                    : 'N/A',
                experience: (users[email].user_data && users[email].user_data.experience) 
                    ? users[email].user_data.experience 
                    : 0
            }));
    }
    
    // Clear search input
    const searchInput = document.getElementById('doctor-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Show all doctors
    currentlyDisplayedDoctors = [...allDoctorsCache];
    renderDoctors(allDoctorsCache, true); // true to show it's a filtered view
}

// Render doctors list
function renderDoctors(doctors, isSearchMode = false) {
    const doctorsContainer = document.getElementById('available-doctors');
    
    if (!doctors || doctors.length === 0) {
        const message = isSearchMode 
            ? 'No doctors found matching your search. Try different keywords.'
            : 'No doctors available at the moment. Use the search box to find all registered doctors.';
        doctorsContainer.innerHTML = `
            <div class="consultation-section">
                <h3>👨‍⚕️ ${isSearchMode ? 'Search Results' : 'Available Doctors'}</h3>
                <p>${message}</p>
                ${!isSearchMode ? '<p style="color: #667eea; font-size: 0.9rem; margin-top: 0.5rem;">💡 Tip: Use the search box above to find all registered doctors, including offline ones.</p>' : ''}
            </div>
        `;
        return;
    }
    
    // Get doctor ratings for display
    const reviews = JSON.parse(localStorage.getItem('doctorReviews') || '[]');
    const doctorRatings = {};
    reviews.forEach(review => {
        if (!doctorRatings[review.doctorEmail]) {
            doctorRatings[review.doctorEmail] = { total: 0, count: 0, ratings: [] };
        }
        doctorRatings[review.doctorEmail].total += review.rating;
        doctorRatings[review.doctorEmail].count += 1;
        doctorRatings[review.doctorEmail].ratings.push(review.rating);
    });
    
    doctorsContainer.innerHTML = `
        <div class="consultation-section">
            <h3>👨‍⚕️ ${isSearchMode ? `Search Results (${doctors.length} found)` : 'Available Doctors'}</h3>
            ${!isSearchMode ? '<p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">Previously consulted doctors are always shown. Use search to find all registered doctors.</p>' : `<p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">Showing all matching doctors (online and offline).</p>`}
            <div class="doctors-list">
                ${doctors.map(doctor => {
                    const hasConsulted = consultedDoctorsCache.has(doctor.email);
                    const isOnline = onlineDoctors.has(doctor.email);
                    const doctorName = doctor.doctorName;
                    const specialization = doctor.specialization;
                    const experience = doctor.experience;
                    const bio = doctor.user_data?.bio || '';
                    
                    // Calculate average rating
                    const rating = doctorRatings[doctor.email];
                    const avgRating = rating && rating.count > 0 
                        ? (rating.total / rating.count).toFixed(1) 
                        : null;
                    const ratingStars = avgRating ? '⭐'.repeat(Math.round(parseFloat(avgRating))) : '';
                    
                    return `
                        <div class="doctor-card">
                            <div class="doctor-card-header">
                                <h4>Dr. ${doctorName}</h4>
                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                                    ${isOnline ? '<span class="online-badge">🟢 Online</span>' : '<span class="offline-badge">⚫ Offline</span>'}
                                    ${hasConsulted ? '<span class="consulted-badge">✓ Previously Consulted</span>' : ''}
                                    ${avgRating ? `<span style="background: #ffd700; color: #333; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">${ratingStars} ${avgRating} (${rating.count})</span>` : ''}
                                </div>
                            </div>
                            <p><strong>Specialization:</strong> ${specialization}</p>
                            <p><strong>Experience:</strong> ${experience} years</p>
                            ${bio ? `<p style="color: #666; font-size: 0.9rem; margin-top: 0.5rem;"><em>${bio.substring(0, 100)}${bio.length > 100 ? '...' : ''}</em></p>` : ''}
                            <p style="margin-top: 0.5rem;"><strong>Email:</strong> ${doctor.email}</p>
                            <button class="btn-primary" onclick="requestConsultation('${doctor.email}')" style="margin-top: 1rem;">
                                ${hasConsulted ? 'Request Consultation Again' : 'Request Consultation'}
                            </button>
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
        
        const apiBaseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);
        const response = await fetch(`${apiBaseUrl}/api/gemini/summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: summaryPrompt })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                let summary = data.candidates[0].content.parts[0].text.trim();
                return summary || 'Unable to generate summary.';
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Failed to generate summary. Response:', response.status, errorData);
            if (response.status === 500 && errorData.error && errorData.error.includes('not configured')) {
                console.warn('Gemini API key not configured on server');
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
    
    requestsList.innerHTML = pendingRequests.map(request => {
        // Get medication schedule for this patient
        const medicationSchedule = request.patientEmail ? getMedicationSchedule(request.patientEmail) : [];
        const hasSchedule = medicationSchedule.length > 0;
        
        let scheduleHtml = '';
        if (hasSchedule) {
            // Build schedule preview
            const allMeds = [];
            medicationSchedule.forEach(schedule => {
                schedule.medications.forEach(med => {
                    allMeds.push(med);
                });
            });
            
            // Group by time of day
            const grouped = {};
            allMeds.forEach(med => {
                const timeKey = med.timeOfDay || 'morning';
                if (!grouped[timeKey]) grouped[timeKey] = [];
                grouped[timeKey].push(med);
            });
            
            scheduleHtml = '<div class="medication-schedule-preview">';
            scheduleHtml += '<h5>📅 Current Medication Schedule:</h5>';
            Object.keys(grouped).forEach(timeOfDay => {
                const timeLabel = timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1);
                scheduleHtml += `<div class="schedule-time-row"><strong>${timeLabel}:</strong> `;
                scheduleHtml += grouped[timeOfDay].map(med => `${med.name} (${med.time || getTimeForPeriod(timeOfDay)})`).join(', ');
                scheduleHtml += '</div>';
            });
            scheduleHtml += '</div>';
        }
        
        return `
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
            ${scheduleHtml}
            <div class="request-actions">
                <button class="btn-primary" onclick="acceptConsultation(${request.id})">✅ Accept & Start Video Call</button>
                <button class="btn-secondary" onclick="rejectConsultation(${request.id})">❌ Reject</button>
            </div>
        </div>
    `;
    }).join('');
    
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
            const doctorName = (doctor && doctor.user_data && doctor.user_data.name) 
                ? doctor.user_data.name 
                : (request.doctorEmail || 'Unknown Doctor');
            otherPartyName = `Dr. ${doctorName}`;
        } else {
            // User is doctor, show patient name
            otherPartyName = request.patientName || 'Unknown Patient';
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
    console.log('🎬 Starting video call for consultation:', consultation.id);
    
    // Load video call settings
    loadVideoCallSettings();
    
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
        console.log(`✅ Call started with ID: ${currentCallId}`);
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
        console.log(`✅ Call started with fallback ID: ${currentCallId}`);
    }
    
    // Hide dashboards and show video call screen IMMEDIATELY
    document.getElementById('patient-dashboard').style.display = 'none';
    document.getElementById('doctor-dashboard').style.display = 'none';
    document.getElementById('video-call-screen').style.display = 'flex';
    
    // CRITICAL: Initialize video streams BEFORE proceeding with other setup
    // This ensures tracks are ready before WebRTC offer/answer
    console.log('🎥 Initializing video streams...');
    try {
        await initializeVideoStreams();
        console.log('✅ Video streams initialized successfully');
    } catch (err) {
        console.error('❌ Error initializing video streams:', err);
        // Continue anyway - might be permission issue
    }
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    
    // Get users from server with fallback to localStorage
    let users = {};
    try {
        users = await getAllUsers();
        // Also merge with localStorage for better fallback
        const localUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
        users = { ...localUsers, ...users };
    } catch (error) {
        console.log('Error fetching users, using localStorage:', error);
        users = JSON.parse(localStorage.getItem('usersDB') || '{}');
    }
    
    const isDoctor = userData && (userData.user_type === 'Doctor' || userData.user_type?.toLowerCase() === 'doctor');
    
    // Set up participant info in header
    const participantNameEl = document.getElementById('call-participant-name');
    if (isDoctor) {
        participantNameEl.textContent = `Patient: ${consultation.patientName || 'Unknown'}`;
        document.getElementById('remote-video-label').textContent = consultation.patientName || 'Patient';
        document.getElementById('remote-video-name-label').textContent = consultation.patientName || 'Patient';
    } else {
        // Fetch doctor info more reliably - try multiple sources
        const doctorEmail = consultation.doctorEmail;
        let doctor = users[doctorEmail];
        
        // Try to get from server if not found or incomplete
        if (!doctor || !doctor.user_data || !doctor.user_data.name) {
            console.log('Fetching doctor info from server...', doctorEmail);
            try {
                // Fetch all users from server
                const serverUsers = await getAllUsers();
                if (serverUsers && serverUsers[doctorEmail]) {
                    doctor = serverUsers[doctorEmail];
                    // Update local users cache
                    users[doctorEmail] = doctor;
                }
                
                // Also check localStorage as additional fallback
                if ((!doctor || !doctor.user_data || !doctor.user_data.name) && typeof localStorage !== 'undefined') {
                    const localUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
                    if (localUsers[doctorEmail]) {
                        doctor = localUsers[doctorEmail];
                    }
                }
            } catch (err) {
                console.log('Error fetching doctor info:', err);
            }
        }
        
        // Try multiple ways to get doctor name
        let doctorName = null;
        if (doctor && doctor.user_data) {
            doctorName = doctor.user_data.name;
        }
        
        // If still no name, try email-based fallback
        if (!doctorName && doctorEmail) {
            const emailParts = doctorEmail.split('@')[0].split(/[._-]/);
            doctorName = emailParts.map(part => 
                part.charAt(0).toUpperCase() + part.slice(1)
            ).join(' ');
        }
        
        // Final fallback
        if (!doctorName) {
            doctorName = 'Doctor';
        }
        
        participantNameEl.textContent = `Dr. ${doctorName}`;
        const remoteLabel = document.getElementById('remote-video-label');
        const remoteNameLabel = document.getElementById('remote-video-name-label');
        if (remoteLabel) remoteLabel.textContent = `Dr. ${doctorName}`;
        if (remoteNameLabel) remoteNameLabel.textContent = `Dr. ${doctorName}`;
    }
    
    // Set up participant details panel
    const participantDetailsEl = document.getElementById('call-participant-details');
    const callInfoTitleEl = document.getElementById('call-info-title');
    
    if (isDoctor) {
        callInfoTitleEl.textContent = '👤 Patient Information';
        
        // Get medication schedule for this patient
        const patientEmail = consultation.patientEmail;
        const medicationSchedules = patientEmail ? getMedicationSchedule(patientEmail) : [];
        const hasSchedule = medicationSchedules.length > 0;
        
        let scheduleSection = '';
        if (hasSchedule) {
            // Create a container for medication schedule
            scheduleSection = `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem;">📅 Medication Schedule</h4>
                <div id="call-medication-schedule" style="max-height: 200px; overflow-y: auto;"></div>
            </div>
            `;
        }
        
        participantDetailsEl.innerHTML = `
            <p><strong>Name:</strong> ${consultation.patientName || 'N/A'}</p>
            <p><strong>Contact:</strong> ${consultation.patientContact || 'N/A'}</p>
            <p><strong>Bio Data:</strong> ${consultation.patientBioData || 'N/A'}</p>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem;">💬 Chat Summary</h4>
                <div class="call-summary" style="max-height: 150px; overflow-y: auto;">${formatMessage(consultation.chatSummary || 'No summary available.')}</div>
            </div>
            ${scheduleSection}
        `;
        
        // Display medication schedule if available
        if (hasSchedule && patientEmail) {
            const scheduleContainer = document.getElementById('call-medication-schedule');
            if (scheduleContainer) {
                displayMedicationSchedule(patientEmail, scheduleContainer);
            }
        }
    } else {
        // Fetch doctor info more reliably
        const doctorEmail = consultation.doctorEmail;
        let doctor = users[doctorEmail];
        
        // If doctor not found, try to fetch again
        if (!doctor || !doctor.user_data || !doctor.user_data.name) {
            try {
                const allUsersAgain = await getAllUsers();
                doctor = allUsersAgain[doctorEmail] || users[doctorEmail];
                // Update users object
                if (doctor) users[doctorEmail] = doctor;
            } catch (err) {
                console.log('Error fetching doctor info:', err);
            }
        }
        
        callInfoTitleEl.textContent = '👨‍⚕️ Doctor Information';
        
        // Get doctor info with multiple fallbacks
        let doctorInfo = null;
        if (doctor && doctor.user_data) {
            doctorInfo = {
                name: doctor.user_data.name,
                specialization: doctor.user_data.specialization,
                contact: doctor.user_data.contact,
                experience: doctor.user_data.experience,
                bio: doctor.user_data.bio
            };
        }
        
        // If doctor info found, display it
        if (doctorInfo && doctorInfo.name) {
            participantDetailsEl.innerHTML = `
                <p><strong>Name:</strong> Dr. ${doctorInfo.name}</p>
                <p><strong>Specialization:</strong> ${doctorInfo.specialization || 'N/A'}</p>
                <p><strong>Contact:</strong> ${doctorInfo.contact || 'N/A'}</p>
                <p><strong>Experience:</strong> ${doctorInfo.experience || 0} years</p>
                <p><strong>Bio:</strong> ${doctorInfo.bio || 'N/A'}</p>
            `;
        } else {
            // Fallback display with at least email
            let displayName = 'Doctor';
            if (doctorEmail) {
                const emailParts = doctorEmail.split('@')[0].split(/[._-]/);
                displayName = emailParts.map(part => 
                    part.charAt(0).toUpperCase() + part.slice(1)
                ).join(' ');
            }
            
            participantDetailsEl.innerHTML = `
                <p><strong>Name:</strong> Dr. ${displayName}</p>
                <p><strong>Email:</strong> ${doctorEmail || 'N/A'}</p>
                <p style="color: rgba(255,255,255,0.7); font-size: 0.85rem; margin-top: 0.5rem;">
                    Loading additional information...
                </p>
            `;
        }
    }
    
    // Set up prescription panel
    const prescriptionTextarea = document.getElementById('prescription-textarea');
    const prescriptionHeaderActions = document.getElementById('prescription-header-actions');
    const prescriptionNotice = document.getElementById('prescription-readonly-notice');
    
    if (isDoctor) {
        // Doctor can edit prescription
        if (prescriptionTextarea) {
            prescriptionTextarea.removeAttribute('readonly');
            prescriptionTextarea.placeholder = 'Write prescription here... (Updates in real-time for patient)';
            // oninput attribute in HTML already calls onPrescriptionChange, no need to add listener
            
            // Show header actions (Clear and Save buttons) for doctor
            if (prescriptionHeaderActions) prescriptionHeaderActions.style.display = 'flex';
            if (prescriptionNotice) prescriptionNotice.style.display = 'none';
            
            // Load existing prescription if any
            if (consultation.prescription) {
                prescriptionTextarea.value = consultation.prescription;
            } else {
                prescriptionTextarea.value = '';
            }
        }
    } else {
        // Patient can only view prescription
        if (prescriptionTextarea) {
            prescriptionTextarea.setAttribute('readonly', 'true');
            prescriptionTextarea.placeholder = 'Prescription will appear here when the doctor writes it...';
            // Hide header actions for patient
            if (prescriptionHeaderActions) prescriptionHeaderActions.style.display = 'none';
            
            // Load existing prescription if any
            if (consultation.prescription) {
                prescriptionTextarea.value = consultation.prescription;
                if (prescriptionNotice) prescriptionNotice.style.display = 'none';
            } else {
                prescriptionTextarea.value = '';
                if (prescriptionNotice) prescriptionNotice.style.display = 'block';
            }
        }
    }
    
    // Reset video control states
    isMicMuted = false;
    isVideoOff = false;
    
    // Reset control buttons
    const micBtn = document.getElementById('toggle-mic-btn');
    if (micBtn) {
        micBtn.classList.remove('muted');
        micBtn.title = 'Mute Microphone';
        const micIcon = micBtn.querySelector('.control-icon');
        if (micIcon) micIcon.textContent = '🎤';
    }
    const cameraBtn = document.getElementById('toggle-camera-btn');
    if (cameraBtn) {
        cameraBtn.classList.remove('video-off');
        cameraBtn.title = 'Turn Camera Off';
        const cameraIcon = cameraBtn.querySelector('.control-icon');
        if (cameraIcon) cameraIcon.textContent = '📹';
    }
    
    // Reset remote stream and video element
    remoteStream = null;
    
    // Reset remote video element
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
        // Stop any existing stream
        if (remoteVideo.srcObject) {
            const oldStream = remoteVideo.srcObject;
            oldStream.getTracks().forEach(track => track.stop());
        }
        remoteVideo.srcObject = null;
        remoteVideo.muted = false;
        remoteVideo.volume = 1.0;
        
        // Show placeholder again
        const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
        if (remoteVideoPlaceholder) {
            remoteVideoPlaceholder.style.display = 'block';
        }
        
        const remoteVideoBox = document.getElementById('remote-video-box');
        if (remoteVideoBox) {
            remoteVideoBox.removeAttribute('data-video-active');
        }
    }
    
    // Video streams should already be initialized above
    // Verify we have a local stream before proceeding
    if (!localStream || localStream.getTracks().length === 0) {
        console.log('⚠️ Video stream not ready, initializing now...');
        try {
            await initializeVideoStreams();
        } catch (err) {
            console.error('Error initializing video streams:', err);
        }
    }
    
    // Verify we have tracks before starting WebRTC
    if (localStream && localStream.getTracks().length > 0) {
        console.log(`✅ Local stream ready with ${localStream.getTracks().length} track(s) - starting WebRTC connection`);
        
        // Create peer connection if it doesn't exist
        if (!peerConnection) {
            createPeerConnection();
        }
        
        // Ensure tracks are added to peer connection
        const existingSenders = peerConnection.getSenders();
        const existingTrackIds = existingSenders.map(s => s.track?.id).filter(Boolean);
        
        localStream.getTracks().forEach(track => {
            if (!existingTrackIds.includes(track.id)) {
                console.log(`📤 Adding ${track.kind} track to peer connection`);
                try {
                    peerConnection.addTrack(track, localStream);
                    // Ensure new tracks respect current mute state
                    if (track.kind === 'audio' && isMicMuted) {
                        track.enabled = false;
                        console.log(`🔇 New audio track ${track.id} added but muted (respecting mute state)`);
                    }
                } catch (err) {
                    console.error(`Error adding ${track.kind} track:`, err);
                }
            }
        });
        
        // Check for pending WebRTC offers that arrived before call initialization
        if (typeof window !== 'undefined' && window.pendingWebRTCOffers && window.pendingWebRTCOffers.length > 0) {
            console.log(`📥 Found ${window.pendingWebRTCOffers.length} pending WebRTC offer(s)`);
            const relevantOffers = window.pendingWebRTCOffers.filter(p => 
                p.consultationId === consultation.id || p.callId === consultation.id ||
                String(p.consultationId) === String(consultation.id) || String(p.callId) === String(consultation.id)
            );
            
            if (relevantOffers.length > 0) {
                console.log(`✅ Processing ${relevantOffers.length} relevant pending offer(s)`);
                // Process the most recent offer
                const latestOffer = relevantOffers[relevantOffers.length - 1];
                // Remove processed offers
                window.pendingWebRTCOffers = window.pendingWebRTCOffers.filter(p => 
                    !relevantOffers.includes(p)
                );
                
                // Store the offer to process after peer connection is created
                window.pendingOfferToProcess = latestOffer;
            }
        }
        
        // Start WebRTC connection (doctor creates offer, patient waits)
        await startWebRTCConnection();
        
        // Process pending offer if we have one (after peer connection is ready)
        if (typeof window !== 'undefined' && window.pendingOfferToProcess) {
            const pendingOffer = window.pendingOfferToProcess;
            delete window.pendingOfferToProcess;
            
            console.log('🔄 Processing stored pending offer now that call is initialized...');
            // Wait a moment for peer connection to be fully ready, then process the offer
            setTimeout(async () => {
                if (peerConnection) {
                    await processWebRTCOffer(pendingOffer);
                }
            }, 800);
        }
    } else {
        console.warn('⚠️ Local stream not ready - WebRTC connection may have issues');
    }
    
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

// WebRTC Variables
let localStream = null;
let peerConnection = null;
let remoteStream = null;
const pcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Initialize video streams with WebRTC - Gracefully handles missing devices
async function initializeVideoStreams() {
    // Prevent multiple simultaneous initializations
    if (initializeVideoStreams.inProgress) {
        console.log('⚠️ Video stream initialization already in progress, skipping...');
        return;
    }
    
    initializeVideoStreams.inProgress = true;
    
    try {
        // Load video call settings
        loadVideoCallSettings();
        
        // Strategy: Try to get media with fallback options using video call settings
        // First, try both video and audio with user settings
        let constraints = {
            video: getVideoConstraints(),
            audio: getAudioConstraints()
        };
        
        console.log('🎥 Requesting camera/microphone access with settings...', constraints);
        let stream = null;
        
        try {
            // Try to get both video and audio with settings
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Camera and microphone access granted');
            
            // Apply video mirror if enabled
            applyVideoMirror();
            
            // Set audio volume
            updateAudioVolume(videoCallSettings.audio.volume);
        } catch (error) {
            console.warn('⚠️ Could not get both video and audio with settings, trying with defaults...', error.name);
            
            // Fallback 1: Try audio only with settings
            try {
                console.log('🎤 Trying audio only with settings...');
                stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
                console.log('✅ Audio access granted (no camera)');
                updateAudioVolume(videoCallSettings.audio.volume);
            } catch (audioError) {
                console.warn('⚠️ Could not get audio with settings, trying default...', audioError.name);
                
                // Fallback 2: Try video only with settings
                try {
                    console.log('📹 Trying video only with settings...');
                    stream = await navigator.mediaDevices.getUserMedia({ video: getVideoConstraints() });
                    console.log('✅ Video access granted (no microphone)');
                    applyVideoMirror();
                } catch (videoError) {
                    console.warn('⚠️ Could not get video with settings, trying defaults...', videoError.name);
                    
                    // Fallback 3: Try with basic constraints
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ 
                            video: true, 
                            audio: true 
                        });
                        console.log('✅ Basic media access granted');
                    } catch (basicError) {
                        console.warn('⚠️ Could not get media, proceeding without local media...', basicError.name);
                        stream = new MediaStream();
                        console.log('ℹ️ Proceeding without local camera/microphone - will still receive remote streams');
                    }
                }
            }
        }
        
        // Set the local stream (even if empty)
        localStream = stream;
        
        // Update UI based on what we got
        const localVideo = document.getElementById('local-video');
        const placeholder = document.getElementById('local-video-placeholder');
        const localVideoBox = document.getElementById('local-video-box');
        
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        console.log(`📊 Local media state: ${videoTracks.length} video track(s), ${audioTracks.length} audio track(s)`);
        
        if (videoTracks.length > 0) {
            // We have video - display it
            if (localVideo) {
                localVideo.srcObject = stream;
                localVideo.muted = true; // Mute local to avoid feedback
                localVideo.play().catch(err => console.log('Local video play error:', err));
                
                if (placeholder) placeholder.style.display = 'none';
                if (localVideoBox) {
                    localVideoBox.setAttribute('data-video-active', 'true');
                }
                console.log('✅ Local video displayed');
            }
        } else {
            // No video - show placeholder message
            if (placeholder) {
                placeholder.style.display = 'flex';
                const pTag = placeholder.querySelector('p');
                if (pTag) {
                    if (audioTracks.length > 0) {
                        pTag.textContent = '📷 Camera unavailable - Audio only mode';
                    } else {
                        pTag.textContent = '📷 Camera unavailable - You can still view remote video';
                    }
                }
            }
            if (localVideoBox) {
                localVideoBox.removeAttribute('data-video-active');
            }
            console.log('ℹ️ No local video available');
        }
        
        // Enumerate devices for camera switching (if available)
        navigator.mediaDevices.enumerateDevices().then(devices => {
            availableCameras = devices.filter(device => device.kind === 'videoinput');
            console.log(`📷 Found ${availableCameras.length} camera(s) available`);
        }).catch(err => {
            console.error('Error enumerating devices:', err);
        });
        
        // CRITICAL: Always create peer connection - even without local media
        // This allows us to receive remote video/audio streams
        if (!peerConnection) {
            createPeerConnection();
            console.log('✅ Peer connection created (ready to receive remote streams)');
        } else {
            console.log('ℹ️ Peer connection already exists, ensuring tracks are added');
        }
        
        // Add local stream tracks to peer connection (if we have any)
        if (peerConnection && stream && stream.getTracks().length > 0) {
            console.log('📤 Adding local tracks to peer connection...');
            
            // Check existing senders to avoid duplicates
            const existingSenders = peerConnection.getSenders();
            const existingTrackIds = existingSenders
                .map(s => s.track?.id)
                .filter(Boolean);
            
            stream.getTracks().forEach(track => {
                // Skip if track already exists
                if (existingTrackIds.includes(track.id)) {
                    console.log(`  - ${track.kind} track (${track.id}) already in peer connection`);
                    return;
                }
                
                console.log(`  - Adding ${track.kind} track (${track.id})`);
                try {
                    peerConnection.addTrack(track, stream);
                    // Ensure new tracks respect current mute state
                    if (track.kind === 'audio' && isMicMuted) {
                        track.enabled = false;
                        console.log(`🔇 New audio track ${track.id} added but muted (respecting mute state)`);
                    }
                } catch (err) {
                    console.error(`Error adding ${track.kind} track:`, err);
                    // If error is about duplicate track, try to replace existing one
                    const existingSender = existingSenders.find(s => s.track && s.track.kind === track.kind);
                    if (existingSender) {
                        console.log(`  - Replacing existing ${track.kind} track`);
                        existingSender.replaceTrack(track).then(() => {
                            // Ensure replaced tracks respect current mute state
                            if (track.kind === 'audio' && isMicMuted) {
                                track.enabled = false;
                                console.log(`🔇 Replaced audio track ${track.id} muted (respecting mute state)`);
                            }
                        }).catch(replaceErr => {
                            console.error(`Error replacing ${track.kind} track:`, replaceErr);
                        });
                    }
                }
            });
            
            // Verify tracks were added
            const senders = peerConnection.getSenders();
            console.log(`✅ Peer connection has ${senders.length} local track sender(s)`);
            senders.forEach(sender => {
                if (sender.track) {
                    console.log(`  - ${sender.track.kind} track (id: ${sender.track.id}, enabled: ${sender.track.enabled})`);
                }
            });
        } else {
            if (!peerConnection) {
                console.error('❌ Peer connection not created!');
            } else if (!stream || stream.getTracks().length === 0) {
                console.log('ℹ️ No local tracks to add - will receive remote streams only');
                console.log('✅ Call can proceed - you can still see and hear the other party');
            }
        }
        
    } catch (error) {
        // Final fallback - proceed without any local media
        console.error('❌ Error initializing video streams:', error);
        console.log('ℹ️ Proceeding without local media - call will still work for receiving remote streams');
        
        localStream = new MediaStream(); // Empty stream
        
        const placeholder = document.getElementById('local-video-placeholder');
        if (placeholder) {
            placeholder.style.display = 'flex';
            const pTag = placeholder.querySelector('p');
            if (pTag) {
                pTag.textContent = '📷 Camera/Mic unavailable - You can still view remote video/audio';
            }
        }
        
        // Still create peer connection to receive remote streams
        if (!peerConnection) {
            createPeerConnection();
            console.log('✅ Peer connection created despite error - ready to receive remote streams');
        }
    } finally {
        // Clear the in-progress flag
        initializeVideoStreams.inProgress = false;
    }
}

// Create RTCPeerConnection
function createPeerConnection() {
    // Don't create if already exists and is in good state
    if (peerConnection && (peerConnection.connectionState === 'new' || peerConnection.connectionState === 'connecting')) {
        console.log('ℹ️ Peer connection already exists in good state, reusing');
        return;
    }
    
    // Close existing peer connection if any and in bad state
    if (peerConnection) {
        console.log('⚠️ Closing existing peer connection before creating new one');
        try {
            peerConnection.close();
        } catch (e) {
            console.error('Error closing peer connection:', e);
        }
        peerConnection = null;
    }
    
    peerConnection = new RTCPeerConnection(pcConfig);
    
    // CRITICAL: Initialize remoteStream BEFORE any tracks arrive
    if (!remoteStream) {
        remoteStream = new MediaStream();
        console.log('✅ Initialized empty remote stream for incoming tracks');
    }
    
    // Handle remote stream - can receive multiple tracks (audio + video)
    peerConnection.ontrack = (event) => {
        console.log('📹 Received remote track:', event.track.kind, 'Streams:', event.streams.length);
        console.log('📹 Track details:', {
            kind: event.track.kind,
            id: event.track.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState,
            streamCount: event.streams.length
        });
        
        const track = event.track;
        
        // CRITICAL: Ensure remoteStream exists (should already be initialized)
        if (!remoteStream) {
            remoteStream = new MediaStream();
            console.log('⚠️ Remote stream was null, created new one');
        }
        
        // CRITICAL: Check if this track already exists in our stream
        const existingTrack = remoteStream.getTracks().find(t => t.id === track.id);
        if (existingTrack) {
            console.log(`⚠️ Track ${track.kind} (id: ${track.id}) already in remote stream, skipping`);
            return;
        }
        
        // CRITICAL: Add track to our consolidated remote stream
        remoteStream.addTrack(track);
        console.log(`✅ Added ${track.kind} track (id: ${track.id}) to remote stream`);
        
        // Log all tracks in the stream now
        const currentTracks = remoteStream.getTracks();
        console.log(`📊 Remote stream now has ${currentTracks.length} track(s):`);
        currentTracks.forEach(t => {
            console.log(`   - ${t.kind} track: id=${t.id}, enabled=${t.enabled}, readyState=${t.readyState}`);
        });
        
        // Log track state changes
        track.onended = () => {
            console.log(`❌ Remote ${track.kind} track ended`);
        };
        
        track.onmute = () => {
            console.log(`🔇 Remote ${track.kind} track muted`);
        };
        
        track.onunmute = () => {
            console.log(`🔊 Remote ${track.kind} track unmuted`);
        };
        
        // Get remote video element - ensure it exists
        const remoteVideo = document.getElementById('remote-video');
        if (!remoteVideo) {
            console.error('❌ Remote video element not found! Cannot display remote video.');
            return;
        }
        
        // CRITICAL: Get all tracks for logging and display
        const audioTracks = remoteStream.getAudioTracks();
        const videoTracks = remoteStream.getVideoTracks();
        
        console.log(`📊 Remote stream summary: ${audioTracks.length} audio, ${videoTracks.length} video`);
        
        // CRITICAL: Update video element EVERY TIME a track arrives
        // This ensures the video element always has the latest stream with all tracks
        console.log('📺 Updating remote video element with consolidated stream...');
        
        // Stop any existing stream tracks on the video element first
        if (remoteVideo.srcObject && remoteVideo.srcObject !== remoteStream) {
            console.log('🔄 Replacing existing stream on video element');
            remoteVideo.srcObject.getTracks().forEach(t => t.stop());
        }
        
        // Set the consolidated stream
        remoteVideo.srcObject = remoteStream;
        
        // CRITICAL: Configure video element for proper playback
        remoteVideo.muted = false; // Must be false to hear audio
        remoteVideo.volume = 1.0;
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.controls = false;
        
        // Hide placeholder when we have video track
        if (track.kind === 'video' || videoTracks.length > 0) {
            const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
            if (remoteVideoPlaceholder) {
                remoteVideoPlaceholder.style.display = 'none';
                console.log('✅ Hiding remote video placeholder');
            }
            
            const remoteVideoBox = document.getElementById('remote-video-box');
            if (remoteVideoBox) {
                remoteVideoBox.setAttribute('data-video-active', 'true');
            }
        }
        
        // CRITICAL: Force play immediately - don't wait
        console.log('▶️ Attempting to play remote video...');
        
        // Use a function to handle playing
        const playRemoteVideo = async () => {
            try {
                await remoteVideo.play();
                console.log('✅ Remote video playing successfully');
                
                // Verify tracks after play
                console.log(`📊 Remote stream state after play:`);
                console.log(`   - Total tracks: ${remoteStream.getTracks().length}`);
                console.log(`   - Audio tracks: ${audioTracks.length}`);
                console.log(`   - Video tracks: ${videoTracks.length}`);
                
                if (videoTracks.length > 0) {
                    const vTrack = videoTracks[0];
                    console.log(`   - Video track: enabled=${vTrack.enabled}, readyState=${vTrack.readyState}, muted=${vTrack.muted}`);
                }
                if (audioTracks.length > 0) {
                    const aTrack = audioTracks[0];
                    console.log(`   - Audio track: enabled=${aTrack.enabled}, readyState=${aTrack.readyState}, muted=${aTrack.muted}`);
                }
                
                // Verify video element is actually showing video
                const hasVideoTrack = remoteVideo.srcObject && remoteVideo.srcObject.getVideoTracks().length > 0;
                console.log(`   - Video element has stream: ${!!remoteVideo.srcObject}`);
                console.log(`   - Video element has video track: ${hasVideoTrack}`);
                
            } catch (err) {
                console.error('❌ Remote video play error:', err);
                console.error('   Error details:', err.message, err.name);
                
                // Check if it's a user interaction issue
                if (err.name === 'NotAllowedError') {
                    console.error('⚠️ Autoplay was blocked - video will play once user interacts with page');
                }
                
                // Try again after a delay
                setTimeout(() => {
                    console.log('🔄 Retrying remote video play...');
                    remoteVideo.play().then(() => {
                        console.log('✅ Remote video play retry successful');
                    }).catch(e => {
                        console.error('❌ Retry play failed:', e.message);
                        
                        // Check diagnostic info
                        const videoCallScreen = document.getElementById('video-call-screen');
                        if (videoCallScreen && videoCallScreen.style.display === 'none') {
                            console.error('⚠️ Video call screen is hidden - video won\'t play until screen is shown');
                        }
                        
                        if (remoteStream.getTracks().length === 0) {
                            console.error('⚠️ Remote stream has no tracks! This is a critical issue.');
                        }
                        
                        // Log video element state
                        console.log('📺 Video element state:', {
                            paused: remoteVideo.paused,
                            muted: remoteVideo.muted,
                            volume: remoteVideo.volume,
                            hasSrcObject: !!remoteVideo.srcObject,
                            readyState: remoteVideo.readyState
                        });
                    });
                }, 1000);
            }
        };
        
        // Play immediately
        playRemoteVideo();
        
        // Also log all tracks in the stream
        const trackKinds = remoteStream.getTracks().map(t => `${t.kind}(${t.enabled ? 'on' : 'off'}, ${t.readyState})`);
        console.log('✅ Remote stream updated. Active tracks:', trackKinds.join(', '));
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('🧊 Sending ICE candidate');
            if (typeof socket !== 'undefined' && socket && socket.connected) {
                socket.emit('iceCandidate', {
                    callId: currentCallId,
                    consultationId: currentConsultation ? currentConsultation.id : null,
                    candidate: event.candidate
                });
            }
        }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('🔌 Peer connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
            console.log('✅ WebRTC connected!');
        } else if (peerConnection.connectionState === 'disconnected' || 
                   peerConnection.connectionState === 'failed') {
            console.log('❌ WebRTC connection lost');
        }
    };
    
    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
    };
}

// Start WebRTC connection - create offer or wait for offer
async function startWebRTCConnection() {
    if (!peerConnection || !currentCallId) {
        console.log('⚠️ Cannot start WebRTC - missing prerequisites');
        return;
    }
    
    // Wait a bit for socket connection if not ready
    if (!socket || !socket.connected) {
        console.log('⏳ Waiting for socket connection...');
        setTimeout(() => startWebRTCConnection(), 1000);
        return;
    }
    
    // Get user data to determine who initiated the call
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const isDoctor = userData && (userData.user_type === 'Doctor' || userData.user_type?.toLowerCase() === 'doctor');
    
    try {
        if (isDoctor) {
            // Doctor creates offer (caller)
            console.log('📞 Doctor creating offer...');
            
            // Ensure local stream exists (may be empty if no camera/mic)
            if (!localStream) {
                localStream = new MediaStream(); // Create empty stream if needed
                console.log('ℹ️ Created empty local stream (no camera/mic available)');
            }
            
            // Add local tracks if available (but proceed even if none)
            const existingSenders = peerConnection.getSenders();
            const existingTrackIds = existingSenders.map(s => s.track?.id).filter(Boolean);
            const localTracks = localStream.getTracks();
            
            console.log(`📤 Preparing to add ${localTracks.length} local track(s) to peer connection`);
            console.log('ℹ️ Note: Call will proceed even without local tracks - you can still receive remote streams');
            
            // Add local tracks if we have any
            if (localTracks.length > 0) {
                localTracks.forEach(track => {
                    if (!existingTrackIds.includes(track.id)) {
                        console.log(`📤 Adding ${track.kind} track (id: ${track.id}, enabled: ${track.enabled}) to peer connection`);
                        try {
                            // Add track with the same stream reference
                            peerConnection.addTrack(track, localStream);
                    // Ensure new tracks respect current mute state
                    if (track.kind === 'audio' && isMicMuted) {
                        track.enabled = false;
                        console.log(`🔇 New audio track ${track.id} added but muted (respecting mute state)`);
                    }
                            console.log(`✅ ${track.kind} track added successfully`);
                        } catch (err) {
                            console.error(`❌ Error adding ${track.kind} track:`, err);
                        }
                    } else {
                        console.log(`✓ ${track.kind} track already in peer connection`);
                    }
                });
            } else {
                console.log('ℹ️ No local tracks to add - will receive remote streams only');
            }
            
            // Verify sender state before creating offer
            const senders = peerConnection.getSenders();
            const audioSenders = senders.filter(s => s.track && s.track.kind === 'audio');
            const videoSenders = senders.filter(s => s.track && s.track.kind === 'video');
            
            console.log(`✅ Peer connection has ${senders.length} sender(s) before creating offer:`);
            console.log(`   - ${audioSenders.length} audio sender(s)`);
            console.log(`   - ${videoSenders.length} video sender(s)`);
            
            if (audioSenders.length === 0 && videoSenders.length === 0) {
                console.log('ℹ️ No local tracks - you can still receive remote video/audio');
            } else {
                if (audioSenders.length === 0) {
                    console.log('ℹ️ No audio tracks - you will not transmit audio but can receive it');
                }
                if (videoSenders.length === 0) {
                    console.log('ℹ️ No video tracks - you will not transmit video but can receive it');
                }
            }
            
            // Wait a moment for tracks to be fully added (if any)
            if (localTracks.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Create offer with explicit audio/video requirements
            console.log('📞 Creating WebRTC offer...');
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            // Verify offer SDP includes both media types
            const offerSdp = offer.sdp || '';
            const hasAudio = offerSdp.includes('m=audio') || offerSdp.includes('audio');
            const hasVideo = offerSdp.includes('m=video') || offerSdp.includes('video');
            
            console.log(`📤 Offer created:`);
            console.log(`   - Audio in SDP: ${hasAudio}`);
            console.log(`   - Video in SDP: ${hasVideo}`);
            console.log(`   - SDP preview: ${offerSdp.substring(0, 200)}...`);
            
            if (!hasAudio || !hasVideo) {
                console.warn('⚠️ WARNING: Offer may be missing audio or video media!');
            }
            
            await peerConnection.setLocalDescription(offer);
            console.log('✅ Local description set');
            
            // Send offer via Socket.io
            socket.emit('webrtcOffer', {
                callId: currentCallId,
                consultationId: currentConsultation ? currentConsultation.id : null,
                offer: offer
            });
            
            console.log('📤 Offer sent via Socket.io to remote party');
        } else {
            // Patient waits for offer from doctor
            console.log('📥 Patient waiting for offer from doctor...');
            
            // Ensure local stream is ready
            if (!localStream || localStream.getTracks().length === 0) {
                console.log('⚠️ Patient local stream not ready - initializing...');
                if (typeof initializeVideoStreams === 'function') {
                    await initializeVideoStreams();
                }
            }
        }
    } catch (error) {
        console.error('Error creating offer:', error);
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
    if (!currentCallId || !currentConsultation) {
        console.log('⚠️ Cannot update prescription - no active call:', { currentCallId, currentConsultation });
        return;
    }
    
    const prescriptionTextarea = document.getElementById('prescription-textarea');
    if (!prescriptionTextarea) {
        console.log('⚠️ Prescription textarea not found');
        return;
    }
    
    const prescription = prescriptionTextarea.value;
    
    // Debounce to avoid too many updates
    if (prescriptionDebounceTimer) {
        clearTimeout(prescriptionDebounceTimer);
    }
    
    prescriptionDebounceTimer = setTimeout(() => {
        // Send prescription update via Socket.io
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            console.log('📤 Sending prescription update:', {
                callId: currentCallId,
                consultationId: currentConsultation.id,
                length: prescription.length
            });
            
            socket.emit('prescriptionUpdate', {
                callId: currentCallId,
                consultationId: currentConsultation.id,
                prescription: prescription
            });
        } else {
            console.log('⚠️ Socket not connected, cannot send prescription update');
            // Try to reconnect socket
            if (typeof initSocket === 'function') {
                initSocket();
            }
        }
    }, 300); // Wait 300ms after user stops typing
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
            
            // CRITICAL: Also update currentConsultation so it's available when call ends
            if (currentConsultation && currentConsultation.id === consultation.id) {
                currentConsultation.prescription = prescription;
                currentConsultation.prescriptionUpdatedAt = consultation.prescriptionUpdatedAt;
            }
            
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

// Video Call Control Functions
let isMicMuted = false;
let isVideoOff = false;

function toggleMicrophone() {
    if (!localStream) {
        console.log('No local stream available');
        return;
    }
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
        console.log('No audio tracks available');
        return;
    }
    
    isMicMuted = !isMicMuted;
    
    // Disable/enable tracks in local stream
    audioTracks.forEach(track => {
        track.enabled = !isMicMuted;
        console.log(`🎤 Audio track ${track.id} ${isMicMuted ? 'disabled' : 'enabled'}`);
    });
    
    // CRITICAL: Also update peer connection senders to ensure audio is truly muted
    if (peerConnection) {
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
            if (sender.track && sender.track.kind === 'audio') {
                // Update the track in the sender - this is the key fix
                sender.track.enabled = !isMicMuted;
                console.log(`🔌 Peer connection audio sender ${sender.track.id} ${isMicMuted ? 'disabled' : 'enabled'}`);
            }
        });
        
        // Double-check: Verify all audio tracks are properly muted
        const allAudioTracks = localStream.getAudioTracks();
        const allMuted = allAudioTracks.every(track => !track.enabled);
        if (isMicMuted && !allMuted) {
            console.warn('⚠️ Some audio tracks are still enabled, forcing mute...');
            allAudioTracks.forEach(track => {
                track.enabled = false;
            });
            // Also force mute in peer connection senders
            senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'audio') {
                    sender.track.enabled = false;
                }
            });
        }
    }
    
    // Also check screen share stream if it exists (it might have audio)
    if (screenShareStream) {
        const screenAudioTracks = screenShareStream.getAudioTracks();
        screenAudioTracks.forEach(track => {
            track.enabled = !isMicMuted;
            console.log(`🖥️ Screen share audio track ${track.id} ${isMicMuted ? 'disabled' : 'enabled'}`);
        });
    }
    
    // Update button appearance
    const micBtn = document.getElementById('toggle-mic-btn');
    if (micBtn) {
        const micIcon = micBtn.querySelector('.control-icon');
        if (isMicMuted) {
            micBtn.classList.add('muted');
            if (micIcon) micIcon.textContent = '🎤';
            micBtn.title = 'Unmute Microphone';
        } else {
            micBtn.classList.remove('muted');
            if (micIcon) micIcon.textContent = '🎤';
            micBtn.title = 'Mute Microphone';
        }
    }
    
    console.log(`Microphone ${isMicMuted ? 'muted' : 'unmuted'} - All tracks updated`);
}

function toggleCamera() {
    if (!localStream) {
        console.log('No local stream available');
        return;
    }
    
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) {
        console.log('No video tracks available');
        return;
    }
    
    isVideoOff = !isVideoOff;
    videoTracks.forEach(track => {
        track.enabled = !isVideoOff;
    });
    
    // Update button appearance
    const cameraBtn = document.getElementById('toggle-camera-btn');
    if (cameraBtn) {
        const cameraIcon = cameraBtn.querySelector('.control-icon');
        if (isVideoOff) {
            cameraBtn.classList.add('video-off');
            if (cameraIcon) cameraIcon.textContent = '📹';
            cameraBtn.title = 'Turn Camera On';
            
            // Show placeholder when video is off
            const placeholder = document.getElementById('local-video-placeholder');
            if (placeholder) placeholder.style.display = 'flex';
        } else {
            cameraBtn.classList.remove('video-off');
            if (cameraIcon) cameraIcon.textContent = '📹';
            cameraBtn.title = 'Turn Camera Off';
            
            // Hide placeholder when video is on
            const placeholder = document.getElementById('local-video-placeholder');
            if (placeholder) placeholder.style.display = 'none';
        }
    }
    
    console.log(`Camera ${isVideoOff ? 'turned off' : 'turned on'}`);
}

// Camera switching function
let currentCameraIndex = 0;
let availableCameras = [];

async function switchCamera() {
    if (!localStream) {
        console.log('No local stream available');
        return;
    }
    
    try {
        // Get available video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableCameras = devices.filter(device => device.kind === 'videoinput');
        
        if (availableCameras.length < 2) {
            alert('Only one camera is available. Cannot switch cameras.');
            return;
        }
        
        // Get current video track
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length === 0) {
            console.log('No video tracks available');
            return;
        }
        
        // Get current track's deviceId
        const currentDeviceId = videoTracks[0].getSettings().deviceId;
        const currentIndex = availableCameras.findIndex(cam => cam.deviceId === currentDeviceId);
        
        // Switch to next camera
        currentCameraIndex = (currentIndex + 1) % availableCameras.length;
        const nextCamera = availableCameras[currentCameraIndex];
        
        // Stop current video track
        const oldVideoTrack = videoTracks[0];
        oldVideoTrack.stop();
        
        // Get new stream with switched camera using video call settings
        const videoConstraints = getVideoConstraints();
        videoConstraints.deviceId = { exact: nextCamera.deviceId };
        
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false // Keep audio from existing stream
        });
        
        // Get new video track
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        // Replace track in stream
        localStream.removeTrack(oldVideoTrack);
        localStream.addTrack(newVideoTrack);
        
        // Replace track in peer connection
        if (peerConnection) {
            const sender = peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
                console.log('✅ Video track replaced in peer connection');
                
                // Ensure audio tracks still respect mute state after camera switch
                if (peerConnection && isMicMuted) {
                    const audioSenders = peerConnection.getSenders().filter(s => 
                        s.track && s.track.kind === 'audio'
                    );
                    audioSenders.forEach(audioSender => {
                        if (audioSender.track) {
                            audioSender.track.enabled = false;
                            console.log(`🔇 Audio track ${audioSender.track.id} kept muted after camera switch`);
                        }
                    });
                }
            }
        }
        
        // Update local video element
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
        
        // Stop the temporary stream (we only needed the track)
        newStream.getAudioTracks().forEach(track => track.stop());
        
        console.log(`✅ Switched to camera: ${nextCamera.label || 'Camera ' + (currentCameraIndex + 1)}`);
    } catch (error) {
        console.error('Error switching camera:', error);
        alert('Unable to switch camera. Please check if you have multiple cameras available.');
    }
}

// Cleanup WebRTC connections
function cleanupWebRTC() {
    // Reset control states
    isMicMuted = false;
    isVideoOff = false;
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
        
        // Close all tracks
        peerConnection.getSenders().forEach(sender => {
            if (sender.track) {
                sender.track.stop();
            }
        });
        
        peerConnection.getReceivers().forEach(receiver => {
            if (receiver.track) {
                receiver.track.stop();
            }
        });
        
        peerConnection.close();
        peerConnection = null;
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Stop remote stream
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    // Clear video elements
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
        if (localVideo.srcObject) {
            localVideo.srcObject.getTracks().forEach(track => track.stop());
        }
        localVideo.srcObject = null;
        localVideo.muted = true; // Reset to muted for local video
    }
    
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
        if (remoteVideo.srcObject) {
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        }
        remoteVideo.srcObject = null;
        remoteVideo.muted = false; // Ensure remote video is not muted for audio
    }
    
    // Reset placeholders
    const localPlaceholder = document.getElementById('local-video-placeholder');
    if (localPlaceholder) localPlaceholder.style.display = 'flex';
    
    const remotePlaceholder = document.getElementById('remote-video-placeholder');
    if (remotePlaceholder) remotePlaceholder.style.display = 'flex';
}

// Video Call Settings
let videoCallSettings = {
    video: {
        resolution: 'medium',
        framerate: 30,
        camera: 'default',
        mirror: false,
        autofocus: true
    },
    audio: {
        input: 'default',
        output: 'default',
        echoCancellation: true,
        noiseSuppression: true,
        autoGain: true,
        volume: 50
    },
    network: {
        bandwidth: 'medium',
        quality: 'balanced',
        adaptive: true
    },
    advanced: {
        codec: 'h264',
        dtx: false,
        agc: true,
        aec: true,
        ns: true
    }
};

// Load saved video call settings
function loadVideoCallSettings() {
    const saved = localStorage.getItem('videoCallSettings');
    if (saved) {
        try {
            videoCallSettings = { ...videoCallSettings, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Error loading video call settings:', e);
        }
    }
}

// Save video call settings
function saveVideoCallSettings() {
    localStorage.setItem('videoCallSettings', JSON.stringify(videoCallSettings));
}

// Open video call settings modal
function openVideoCallSettings() {
    const modal = document.getElementById('video-call-settings-modal');
    if (!modal) return;
    
    loadVideoCallSettings();
    loadDeviceOptions();
    updateSettingsUI();
    updateNetworkStats();
    
    modal.style.display = 'block';
}

// Close video call settings modal
function closeVideoCallSettings() {
    const modal = document.getElementById('video-call-settings-modal');
    if (modal) modal.style.display = 'none';
}

// Switch video settings tabs
function openVideoSettingsTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('#video-call-settings-modal .settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('#video-call-settings-modal .settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedContent = document.getElementById(`${tabName}-settings-tab`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Activate selected tab button
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Load available devices
async function loadDeviceOptions() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Video devices
        const videoSelect = document.getElementById('video-camera');
        if (videoSelect) {
            videoSelect.innerHTML = '<option value="default">Default Camera</option>';
            devices.filter(d => d.kind === 'videoinput').forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${videoSelect.options.length}`;
                if (device.deviceId === videoCallSettings.video.camera) {
                    option.selected = true;
                }
                videoSelect.appendChild(option);
            });
        }
        
        // Audio input devices
        const audioInputSelect = document.getElementById('audio-input');
        if (audioInputSelect) {
            audioInputSelect.innerHTML = '<option value="default">Default Microphone</option>';
            devices.filter(d => d.kind === 'audioinput').forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Microphone ${audioInputSelect.options.length}`;
                if (device.deviceId === videoCallSettings.audio.input) {
                    option.selected = true;
                }
                audioInputSelect.appendChild(option);
            });
        }
        
        // Audio output devices
        const audioOutputSelect = document.getElementById('audio-output');
        if (audioOutputSelect) {
            audioOutputSelect.innerHTML = '<option value="default">Default Speaker</option>';
            devices.filter(d => d.kind === 'audiooutput').forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Speaker ${audioOutputSelect.options.length}`;
                if (device.deviceId === videoCallSettings.audio.output) {
                    option.selected = true;
                }
                audioOutputSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading devices:', error);
    }
}

// Update settings UI with current values
function updateSettingsUI() {
    // Video settings
    const videoResolution = document.getElementById('video-resolution');
    if (videoResolution) videoResolution.value = videoCallSettings.video.resolution;
    
    const videoFramerate = document.getElementById('video-framerate');
    if (videoFramerate) videoFramerate.value = videoCallSettings.video.framerate;
    
    const videoMirror = document.getElementById('video-mirror');
    if (videoMirror) videoMirror.checked = videoCallSettings.video.mirror;
    
    const videoAutofocus = document.getElementById('video-autofocus');
    if (videoAutofocus) videoAutofocus.checked = videoCallSettings.video.autofocus;
    
    // Audio settings
    const audioEchoCancellation = document.getElementById('audio-echo-cancellation');
    if (audioEchoCancellation) audioEchoCancellation.checked = videoCallSettings.audio.echoCancellation;
    
    const audioNoiseSuppression = document.getElementById('audio-noise-suppression');
    if (audioNoiseSuppression) audioNoiseSuppression.checked = videoCallSettings.audio.noiseSuppression;
    
    const audioAutoGain = document.getElementById('audio-auto-gain');
    if (audioAutoGain) audioAutoGain.checked = videoCallSettings.audio.autoGain;
    
    const audioVolume = document.getElementById('audio-volume');
    if (audioVolume) {
        audioVolume.value = videoCallSettings.audio.volume;
        updateAudioVolume(videoCallSettings.audio.volume);
    }
    
    // Network settings
    const networkBandwidth = document.getElementById('network-bandwidth');
    if (networkBandwidth) networkBandwidth.value = videoCallSettings.network.bandwidth;
    
    const networkQuality = document.getElementById('network-quality');
    if (networkQuality) networkQuality.value = videoCallSettings.network.quality;
    
    const networkAdaptive = document.getElementById('network-adaptive');
    if (networkAdaptive) networkAdaptive.checked = videoCallSettings.network.adaptive;
    
    // Advanced settings
    const advancedCodec = document.getElementById('advanced-codec');
    if (advancedCodec) advancedCodec.value = videoCallSettings.advanced.codec;
    
    const advancedDtx = document.getElementById('advanced-dtx');
    if (advancedDtx) advancedDtx.checked = videoCallSettings.advanced.dtx;
    
    const advancedAgc = document.getElementById('advanced-agc');
    if (advancedAgc) advancedAgc.checked = videoCallSettings.advanced.agc;
    
    const advancedAec = document.getElementById('advanced-aec');
    if (advancedAec) advancedAec.checked = videoCallSettings.advanced.aec;
    
    const advancedNs = document.getElementById('advanced-ns');
    if (advancedNs) advancedNs.checked = videoCallSettings.advanced.ns;
}

// Update audio volume display
function updateAudioVolume(value) {
    const volumeValue = document.getElementById('audio-volume-value');
    if (volumeValue) volumeValue.textContent = value;
    
    // Update remote video volume
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
        remoteVideo.volume = value / 100;
    }
}

// Update video settings (called on change)
function updateVideoSettings() {
    // Video settings
    const videoResolution = document.getElementById('video-resolution');
    if (videoResolution) videoCallSettings.video.resolution = videoResolution.value;
    
    const videoFramerate = document.getElementById('video-framerate');
    if (videoFramerate) videoCallSettings.video.framerate = parseInt(videoFramerate.value);
    
    const videoCamera = document.getElementById('video-camera');
    if (videoCamera) videoCallSettings.video.camera = videoCamera.value;
    
    const videoMirror = document.getElementById('video-mirror');
    if (videoMirror) {
        videoCallSettings.video.mirror = videoMirror.checked;
        applyVideoMirror();
    }
    
    const videoAutofocus = document.getElementById('video-autofocus');
    if (videoAutofocus) videoCallSettings.video.autofocus = videoAutofocus.checked;
    
    // Audio settings
    const audioInput = document.getElementById('audio-input');
    if (audioInput) videoCallSettings.audio.input = audioInput.value;
    
    const audioOutput = document.getElementById('audio-output');
    if (audioOutput) videoCallSettings.audio.output = audioOutput.value;
    
    const audioEchoCancellation = document.getElementById('audio-echo-cancellation');
    if (audioEchoCancellation) videoCallSettings.audio.echoCancellation = audioEchoCancellation.checked;
    
    const audioNoiseSuppression = document.getElementById('audio-noise-suppression');
    if (audioNoiseSuppression) videoCallSettings.audio.noiseSuppression = audioNoiseSuppression.checked;
    
    const audioAutoGain = document.getElementById('audio-auto-gain');
    if (audioAutoGain) videoCallSettings.audio.autoGain = audioAutoGain.checked;
    
    // Network settings
    const networkBandwidth = document.getElementById('network-bandwidth');
    if (networkBandwidth) videoCallSettings.network.bandwidth = networkBandwidth.value;
    
    const networkQuality = document.getElementById('network-quality');
    if (networkQuality) videoCallSettings.network.quality = networkQuality.value;
    
    const networkAdaptive = document.getElementById('network-adaptive');
    if (networkAdaptive) videoCallSettings.network.adaptive = networkAdaptive.checked;
    
    // Advanced settings
    const advancedCodec = document.getElementById('advanced-codec');
    if (advancedCodec) videoCallSettings.advanced.codec = advancedCodec.value;
    
    const advancedDtx = document.getElementById('advanced-dtx');
    if (advancedDtx) videoCallSettings.advanced.dtx = advancedDtx.checked;
    
    const advancedAgc = document.getElementById('advanced-agc');
    if (advancedAgc) videoCallSettings.advanced.agc = advancedAgc.checked;
    
    const advancedAec = document.getElementById('advanced-aec');
    if (advancedAec) videoCallSettings.advanced.aec = advancedAec.checked;
    
    const advancedNs = document.getElementById('advanced-ns');
    if (advancedNs) videoCallSettings.advanced.ns = advancedNs.checked;
}

// Apply video mirror effect
function applyVideoMirror() {
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
        if (videoCallSettings.video.mirror) {
            localVideo.style.transform = 'scaleX(-1)';
        } else {
            localVideo.style.transform = 'scaleX(1)';
        }
    }
}

// Get video constraints based on settings
function getVideoConstraints() {
    const resolutionMap = {
        low: { width: { ideal: 320 }, height: { ideal: 240 } },
        medium: { width: { ideal: 640 }, height: { ideal: 480 } },
        high: { width: { ideal: 1280 }, height: { ideal: 720 } },
        ultra: { width: { ideal: 1920 }, height: { ideal: 1080 } }
    };
    
    const constraints = {
        ...resolutionMap[videoCallSettings.video.resolution] || resolutionMap.medium,
        frameRate: { ideal: videoCallSettings.video.framerate },
        facingMode: 'user'
    };
    
    if (videoCallSettings.video.camera !== 'default') {
        constraints.deviceId = { exact: videoCallSettings.video.camera };
    }
    
    if (videoCallSettings.video.autofocus !== undefined) {
        constraints.focusMode = videoCallSettings.video.autofocus ? 'continuous' : 'manual';
    }
    
    return constraints;
}

// Get audio constraints based on settings
function getAudioConstraints() {
    const constraints = {
        echoCancellation: videoCallSettings.audio.echoCancellation,
        noiseSuppression: videoCallSettings.audio.noiseSuppression,
        autoGainControl: videoCallSettings.audio.autoGain
    };
    
    if (videoCallSettings.audio.input !== 'default') {
        constraints.deviceId = { exact: videoCallSettings.audio.input };
    }
    
    return constraints;
}

// Apply video call settings
async function applyVideoCallSettings() {
    updateVideoSettings();
    saveVideoCallSettings();
    
    // Apply settings to current stream if active
    if (localStream) {
        try {
            // Update video track
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                const videoTrack = videoTracks[0];
                const settings = getVideoConstraints();
                await videoTrack.applyConstraints(settings);
            }
            
            // Update audio track
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const audioTrack = audioTracks[0];
                const settings = getAudioConstraints();
                await audioTrack.applyConstraints(settings);
            }
            
            applyVideoMirror();
            updateAudioVolume(videoCallSettings.audio.volume);
            
            alert('✅ Video call settings applied successfully!');
        } catch (error) {
            console.error('Error applying settings:', error);
            alert('⚠️ Some settings could not be applied. They will be used for the next call.');
        }
    } else {
        alert('✅ Settings saved! They will be applied when you start a video call.');
    }
    
    closeVideoCallSettings();
}

// Test video settings
function testVideoSettings() {
    alert('🧪 Testing video settings...\n\nThis feature will preview your camera with the current settings.');
    // Could implement a preview window here
}

// Reset video settings to defaults
function resetVideoSettings() {
    if (confirm('Reset all video call settings to defaults?')) {
        videoCallSettings = {
            video: {
                resolution: 'medium',
                framerate: 30,
                camera: 'default',
                mirror: false,
                autofocus: true
            },
            audio: {
                input: 'default',
                output: 'default',
                echoCancellation: true,
                noiseSuppression: true,
                autoGain: true,
                volume: 50
            },
            network: {
                bandwidth: 'medium',
                quality: 'balanced',
                adaptive: true
            },
            advanced: {
                codec: 'h264',
                dtx: false,
                agc: true,
                aec: true,
                ns: true
            }
        };
        updateSettingsUI();
        saveVideoCallSettings();
        alert('✅ Settings reset to defaults!');
    }
}

// Update network statistics
function updateNetworkStats() {
    if (!peerConnection) {
        document.getElementById('network-connection-status').textContent = 'Not connected';
        return;
    }
    
    const connectionState = peerConnection.connectionState || 'unknown';
    document.getElementById('network-connection-status').textContent = connectionState.charAt(0).toUpperCase() + connectionState.slice(1);
    
    // Get stats periodically
    if (peerConnection.getStats) {
        peerConnection.getStats().then(stats => {
            let latency = '-';
            let packetLoss = '-';
            let bitrate = '-';
            
            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime) {
                        latency = Math.round(report.currentRoundTripTime * 1000);
                    }
                }
                if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
                    if (report.bytesReceived || report.bytesSent) {
                        const bytes = report.bytesReceived || report.bytesSent;
                        bitrate = Math.round(bytes / 1024);
                    }
                }
            });
            
            document.getElementById('network-latency').textContent = latency;
            document.getElementById('network-packet-loss').textContent = packetLoss;
            document.getElementById('network-bitrate').textContent = bitrate;
        }).catch(err => {
            console.error('Error getting stats:', err);
        });
    }
}

// Toggle screen share
let screenShareStream = null;
async function toggleScreenShare() {
    try {
        if (!screenShareStream) {
            // Start screen sharing
            screenShareStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: true
            });
            
            // Replace video track in peer connection
            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    await sender.replaceTrack(screenShareStream.getVideoTracks()[0]);
                }
                
                // Handle screen share audio tracks - respect mute state
                const screenAudioTracks = screenShareStream.getAudioTracks();
                if (screenAudioTracks.length > 0) {
                    const audioSender = peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'audio'
                    );
                    if (audioSender && screenAudioTracks[0]) {
                        await audioSender.replaceTrack(screenAudioTracks[0]);
                        // Respect mute state
                        if (isMicMuted) {
                            screenAudioTracks[0].enabled = false;
                            console.log(`🔇 Screen share audio track muted`);
                        }
                    }
                }
            }
            
            // Update local video
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = screenShareStream;
            }
            
            // Update button
            const screenBtn = document.getElementById('toggle-screen-btn');
            if (screenBtn) {
                screenBtn.classList.add('active');
                screenBtn.title = 'Stop Screen Share';
            }
            
            // Handle screen share end
            screenShareStream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };
            
            console.log('✅ Screen sharing started');
        } else {
            stopScreenShare();
        }
    } catch (error) {
        console.error('Error toggling screen share:', error);
        alert('Unable to start screen sharing. Please check your browser permissions.');
    }
}

// Stop screen sharing
async function stopScreenShare() {
    if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
        screenShareStream = null;
        
        // Restore camera video
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length > 0 && peerConnection) {
                const sender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    await sender.replaceTrack(videoTracks[0]);
                }
            }
            
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }
        }
        
        // Update button
        const screenBtn = document.getElementById('toggle-screen-btn');
        if (screenBtn) {
            screenBtn.classList.remove('active');
            screenBtn.title = 'Share Screen';
        }
        
        console.log('✅ Screen sharing stopped');
    }
}

async function endVideoCall() {
    // Stop screen sharing if active
    await stopScreenShare();
    
    // Cleanup WebRTC connections
    cleanupWebRTC();
    
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
    
    // CRITICAL: Convert saved prescription to medication schedule before clearing consultation
    // Get the latest prescription from localStorage in case it was saved but currentConsultation wasn't updated
    let consultationToConvert = currentConsultation;
    if (consultationToConvert && consultationToConvert.id) {
        try {
            const allConsultations = JSON.parse(localStorage.getItem('consultations') || '[]');
            const savedConsultation = allConsultations.find(c => c.id === consultationToConvert.id);
            if (savedConsultation && savedConsultation.prescription) {
                consultationToConvert.prescription = savedConsultation.prescription;
                console.log('✅ Retrieved latest prescription from storage');
            }
        } catch (err) {
            console.log('Could not retrieve saved prescription, using currentConsultation');
        }
    }
    
    if (consultationToConvert && consultationToConvert.prescription && consultationToConvert.prescription.trim()) {
        console.log('Converting prescription to medication schedule...');
        console.log('Prescription text:', consultationToConvert.prescription.substring(0, 200));
        try {
            await convertPrescriptionToSchedule(consultationToConvert);
            console.log('✅ Medication schedule created successfully');
        } catch (error) {
            console.error('Error converting prescription to schedule:', error);
        }
    } else {
        console.log('ℹ️ No prescription found to convert to medication schedule');
    }
    
    // Clear current call ID
    const savedConsultationForSchedule = currentConsultation; // Save reference
    const savedConsultationId = currentConsultation?.id;
    const savedDoctorEmail = currentConsultation?.doctorEmail;
    currentCallId = null;
    currentConsultation = null;
    
    document.getElementById('video-call-screen').style.display = 'none';
    loadDashboard();
    loadConsultationRequests();
    loadConsultationHistory();
    
    // Refresh medicine schedule after call ends (prescription may have been converted)
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (userData && (userData.user_type === 'Patient' || userData.user_type?.toLowerCase() === 'patient')) {
        setTimeout(() => {
            loadMedicineSchedule();
        }, 1000);
        
        // Show review modal for patients after consultation ends
        if (savedConsultationId && savedDoctorEmail) {
            setTimeout(() => {
                showReviewModal(savedConsultationId, savedDoctorEmail);
            }, 1000); // Show after 1 second
        }
    }
    
    // Reset consultation panel based on current chat state
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
            // Also refresh online doctors from API to ensure we have the latest
            if (typeof getOnlineDoctors === 'function') {
                getOnlineDoctors().then(onlineDoctorsList => {
                    if (onlineDoctorsList && onlineDoctorsList.size > 0) {
                        onlineDoctorsList.forEach(email => onlineDoctors.add(email));
                    }
                    loadAvailableDoctors();
                }).catch(err => {
                    console.error('Error fetching online doctors in polling:', err);
                    loadAvailableDoctors(); // Still refresh even if API fails
                });
            } else {
                loadAvailableDoctors();
            }
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
    
    const medicineInfoModal = document.getElementById('medicine-info-modal');
    if (event.target === medicineInfoModal) {
        closeMedicineInfoModal();
    }
    
    const settingsModal = document.getElementById('settings-modal');
    if (event.target === settingsModal) {
        closeSettings();
    }
    
    const videoCallSettingsModal = document.getElementById('video-call-settings-modal');
    if (event.target === videoCallSettingsModal) {
        closeVideoCallSettings();
    }
}

// ========================================
// MEDICINE SEARCH FUNCTIONALITY
// ========================================

// Handle Enter key in medicine search
function handleMedicineSearchKeyPress(event) {
    if (event.key === 'Enter') {
        searchMedicine();
    }
}

// Search for medicine information
async function searchMedicine() {
    const input = document.getElementById('medicine-search-input');
    const medicineName = input.value.trim();
    
    if (!medicineName) {
        // If empty, open modal with placeholder
        const modal = document.getElementById('medicine-info-modal');
        if (modal) {
            modal.style.display = 'block';
        }
        return;
    }
    
    // Show modal with loading state
    const modal = document.getElementById('medicine-info-modal');
    const content = document.getElementById('medicine-info-content');
    
    if (!modal || !content) {
        console.error('Medicine info modal not found');
        return;
    }
    
    modal.style.display = 'block';
    content.innerHTML = `
        <div class="medicine-search-loading" style="text-align: center; padding: 2rem;">
            <div class="loading-spinner"></div>
            <p>Searching for information about <strong>${medicineName}</strong>...</p>
            <p style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">This may take a few seconds</p>
        </div>
    `;
    
    try {
        // Get API base URL - check multiple sources
        let apiBaseUrl;
        if (typeof API_BASE_URL !== 'undefined') {
            apiBaseUrl = API_BASE_URL;
        } else if (typeof getApiBaseUrl === 'function') {
            apiBaseUrl = getApiBaseUrl();
        } else {
            // Fallback: detect from current location
            const isLocal = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.protocol === 'file:';
            apiBaseUrl = isLocal ? 'http://localhost:3000' : window.location.origin;
        }
        
        console.log('🔍 Searching for medicine:', medicineName);
        console.log('🔍 Using API base URL:', apiBaseUrl);
        
        // Create a detailed prompt for medicine information
        const medicinePrompt = `You are a medical information assistant. Provide comprehensive, accurate information about the medicine "${medicineName}".

IMPORTANT: Organize the information in a clear, structured format with proper headings. Cover all of the following sections:

1. **Generic Name and Brand Names**: List the generic name and common brand names
2. **Uses/Indications**: What conditions or symptoms this medicine treats
3. **Dosage Information**: Typical adult and pediatric dosages, frequency
4. **How to Take**: Instructions (with/without food, time of day, etc.)
5. **Side Effects**: Common and serious side effects
6. **Warnings/Precautions**: Important safety information, special populations
7. **Drug Interactions**: Medicines that should not be taken together
8. **Contraindications**: Who should not take this medicine
9. **Storage Instructions**: How to store the medicine
10. **Additional Information**: Any other important notes

Be thorough, accurate, and use clear medical terminology. Format with headings (use ### for section headings) and bullet points for lists. Provide complete and reliable information.`;

        const response = await fetch(`${apiBaseUrl}/api/gemini/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: medicinePrompt })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || data.error || 'Failed to get medicine information');
        }
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const medicineInfo = data.candidates[0].content.parts[0].text;
            
            console.log('✅ Medicine information retrieved successfully');
            
            // Display the information in a formatted way
            displayMedicineInfo(medicineName, medicineInfo);
        } else {
            throw new Error('Unexpected response format from API');
        }
        
    } catch (error) {
        console.error('❌ Error searching for medicine:', error);
        content.innerHTML = `
            <div class="medicine-search-error" style="padding: 2rem; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                <h3 style="color: #dc3545; margin-bottom: 0.5rem;">Error</h3>
                <p style="color: #666; margin-bottom: 1rem;">Failed to retrieve medicine information. Please try again.</p>
                <p style="font-size: 0.9rem; color: #999; margin-top: 1rem; background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                    <strong>Error details:</strong><br>${error.message}
                </p>
                <button class="btn-primary" onclick="searchMedicine()" style="margin-top: 1.5rem;">🔄 Retry Search</button>
                <button class="btn-secondary" onclick="closeMedicineInfoModal()" style="margin-top: 0.5rem; margin-left: 0.5rem; background: #6c757d;">Close</button>
            </div>
        `;
    }
}

// Display medicine information in a formatted way
function displayMedicineInfo(medicineName, infoText) {
    const content = document.getElementById('medicine-info-content');
    
    // Format the text - convert markdown-like formatting to HTML
    let formattedText = infoText;
    
    // Format headings first (before other processing)
    formattedText = formattedText.replace(/^###\s+(.+)$/gim, '<h3 style="color: #667eea; margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.2rem; font-weight: 600;">$1</h3>');
    formattedText = formattedText.replace(/^##\s+(.+)$/gim, '<h2 style="color: #667eea; margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.3rem; font-weight: 600;">$1</h2>');
    formattedText = formattedText.replace(/^#\s+(.+)$/gim, '<h1 style="color: #667eea; margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.5rem; font-weight: 600;">$1</h1>');
    
    // Format bold and italic
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #333;">$1</strong>');
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Split into paragraphs (double newlines)
    const lines = formattedText.split('\n');
    let result = '';
    let currentParagraph = '';
    let inList = false;
    
    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) {
            // Empty line - end current paragraph or list
            if (currentParagraph) {
                if (inList) {
                    result += '</ul>';
                    inList = false;
                } else {
                    result += `<p style="margin: 0.75rem 0; line-height: 1.6; color: #333;">${currentParagraph}</p>`;
                }
                currentParagraph = '';
            }
            return;
        }
        
        // Check if line is a heading (already formatted)
        if (line.startsWith('<h')) {
            if (currentParagraph) {
                if (inList) {
                    result += '</ul>';
                    inList = false;
                } else {
                    result += `<p style="margin: 0.75rem 0; line-height: 1.6; color: #333;">${currentParagraph}</p>`;
                }
                currentParagraph = '';
            }
            result += line;
            return;
        }
        
        // Check if line is a numbered list item
        const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
            if (currentParagraph && !inList) {
                result += `<p style="margin: 0.75rem 0; line-height: 1.6; color: #333;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
            if (!inList) {
                result += '<ul style="margin: 1rem 0; padding-left: 1.5rem;">';
                inList = true;
            }
            result += `<li style="margin: 0.5rem 0; line-height: 1.6;"><strong>${numberedMatch[1]}.</strong> ${numberedMatch[2]}</li>`;
            return;
        }
        
        // Check if line is a bullet list item
        const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
        if (bulletMatch) {
            if (currentParagraph && !inList) {
                result += `<p style="margin: 0.75rem 0; line-height: 1.6; color: #333;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
            if (!inList) {
                result += '<ul style="margin: 1rem 0; padding-left: 1.5rem;">';
                inList = true;
            }
            result += `<li style="margin: 0.5rem 0; line-height: 1.6;">${bulletMatch[1]}</li>`;
            return;
        }
        
        // Regular text line
        if (inList) {
            result += '</ul>';
            inList = false;
        }
        
        if (currentParagraph) {
            currentParagraph += '<br>' + line;
        } else {
            currentParagraph = line;
        }
    });
    
    // Handle remaining paragraph
    if (currentParagraph) {
        if (inList) {
            result += '</ul>';
        } else {
            result += `<p style="margin: 0.75rem 0; line-height: 1.6; color: #333;">${currentParagraph}</p>`;
        }
    } else if (inList) {
        result += '</ul>';
    }
    
    formattedText = result;
    
    content.innerHTML = `
        <div class="medicine-info-display">
            <div class="medicine-info-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <h2 style="margin: 0; font-size: 1.5rem;">💊 ${medicineName}</h2>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9; font-size: 0.95rem;">Comprehensive Medicine Information</p>
            </div>
            <div class="medicine-info-content" style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; max-height: 60vh; overflow-y: auto; line-height: 1.6; color: #333;">
                ${formattedText}
            </div>
            <div style="margin-top: 1.5rem; padding: 1rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                <p style="margin: 0; font-size: 0.9rem; color: #856404;">
                    <strong>⚠️ Disclaimer:</strong> This information is for educational purposes only and should not replace professional medical advice. Always consult with a healthcare professional before taking any medication.
                </p>
            </div>
        </div>
    `;
}

// Close medicine info modal
function closeMedicineInfoModal() {
    const modal = document.getElementById('medicine-info-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    // Clear the search input
    const input = document.getElementById('medicine-search-input');
    if (input) {
        input.value = '';
    }
}

// ========================================
// SETTINGS & THEME FUNCTIONALITY
// ========================================

// Initialize theme on page load
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const themeMode = localStorage.getItem('themeMode') || 'light';
    
    if (themeMode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-mode', prefersDark);
        updateThemeIcon(prefersDark);
    } else {
        const isDark = themeMode === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        updateThemeIcon(isDark);
    }
    
    // Update theme select dropdown
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = themeMode;
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (themeMode === 'auto') {
            document.body.classList.toggle('dark-mode', e.matches);
            updateThemeIcon(e.matches);
        }
    });
}

// Toggle theme manually
function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', !isDark);
    updateThemeIcon(!isDark);
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    localStorage.setItem('themeMode', !isDark ? 'dark' : 'light');
    
    // Update theme select dropdown
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = !isDark ? 'dark' : 'light';
    }
}

// Change theme mode (light/dark/auto)
function changeTheme(mode) {
    localStorage.setItem('themeMode', mode);
    
    if (mode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-mode', prefersDark);
        updateThemeIcon(prefersDark);
    } else {
        const isDark = mode === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        updateThemeIcon(isDark);
    }
}

// Update theme icon
function updateThemeIcon(isDark) {
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = isDark ? '☀️' : '🌙';
    }
}

// Open settings modal
function openSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.display = 'block';
        loadProfileData();
        loadSettings();
    }
}

// Close settings modal
function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Switch settings tabs
function openSettingsTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.settings-tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab content
    const selectedContent = document.getElementById(`settings-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Activate selected tab button
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: find tab button by content
        tabs.forEach(tab => {
            if (tab.textContent.toLowerCase().includes(tabName.toLowerCase().slice(0, 3))) {
                tab.classList.add('active');
            }
        });
    }
}

// Load profile data into settings form
function loadProfileData() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData || !userData.user_data) return;
    
    const userInfo = userData.user_data;
    const userType = userData.user_type;
    
    // Fill form fields
    const nameInput = document.getElementById('settings-name');
    const emailInput = document.getElementById('settings-email');
    const contactInput = document.getElementById('settings-contact');
    const bioInput = document.getElementById('settings-bio');
    
    if (nameInput) nameInput.value = userInfo.name || '';
    if (emailInput) emailInput.value = userData.email || '';
    if (contactInput) contactInput.value = userInfo.contact || '';
    if (bioInput) bioInput.value = userInfo.bio || '';
    
    // Show/hide doctor-specific fields
    if (userType === 'Doctor') {
        const specGroup = document.getElementById('settings-specialization-group');
        const licenseGroup = document.getElementById('settings-license-group');
        const expGroup = document.getElementById('settings-experience-group');
        const bioHint = document.getElementById('settings-bio-hint');
        
        if (specGroup) {
            specGroup.style.display = 'block';
            const specInput = document.getElementById('settings-specialization');
            if (specInput) specInput.value = userInfo.specialization || '';
        }
        if (licenseGroup) {
            licenseGroup.style.display = 'block';
            const licenseInput = document.getElementById('settings-license');
            if (licenseInput) licenseInput.value = userInfo.license || '';
        }
        if (expGroup) {
            expGroup.style.display = 'block';
            const expInput = document.getElementById('settings-experience');
            if (expInput) expInput.value = userInfo.experience || 0;
        }
        if (bioHint) bioHint.textContent = 'Professional background and expertise';
    } else {
        const specGroup = document.getElementById('settings-specialization-group');
        const licenseGroup = document.getElementById('settings-license-group');
        const expGroup = document.getElementById('settings-experience-group');
        const bioHint = document.getElementById('settings-bio-hint');
        
        if (specGroup) specGroup.style.display = 'none';
        if (licenseGroup) licenseGroup.style.display = 'none';
        if (expGroup) expGroup.style.display = 'none';
        if (bioHint) bioHint.textContent = 'Age, gender, medical history, allergies, etc.';
    }
}

// Save profile changes
async function saveProfile(event) {
    event.preventDefault();
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const userType = userData.user_type;
    const messageDiv = document.getElementById('profile-message');
    
    // Get form values
    const updatedData = {
        name: document.getElementById('settings-name').value,
        contact: document.getElementById('settings-contact').value,
        bio: document.getElementById('settings-bio').value
    };
    
    if (userType === 'Doctor') {
        updatedData.specialization = document.getElementById('settings-specialization').value;
        updatedData.license = document.getElementById('settings-license').value;
        updatedData.experience = parseInt(document.getElementById('settings-experience').value) || 0;
    }
    
    // Merge with existing user data
    const mergedUserData = {
        ...userData.user_data,
        ...updatedData
    };
    
    // Update in sessionStorage
    userData.user_data = mergedUserData;
    sessionStorage.setItem('currentUser', JSON.stringify(userData));
    
    // Update in localStorage usersDB
    const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
    if (usersDB[userData.email]) {
        usersDB[userData.email].user_data = mergedUserData;
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
    }
    
    // Update on server via API
    try {
        if (typeof registerUserOnServer === 'function') {
            // Get password hash from usersDB for server update (usersDB already loaded above)
            const existingUser = usersDB[userData.email];
            const passwordHash = existingUser?.password_hash || userData.password_hash || '';
            
            await registerUserOnServer(userData.email, mergedUserData, userType, passwordHash);
            console.log('✅ Profile updated on server');
        }
    } catch (error) {
        console.error('Error updating profile on server:', error);
        // Continue anyway - local update is done
    }
    
    // Update on server via Socket.io (for real-time updates)
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('userOnline', {
            email: userData.email,
            userData: mergedUserData,
            userType: userType
        });
        console.log('✅ Profile update sent via Socket.io');
    }
    
    // Show success message
    if (messageDiv) {
        messageDiv.innerHTML = '<div class="success-message">✅ Profile updated successfully!</div>';
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);
    }
    
    // Reload dashboard to reflect changes
    setTimeout(() => {
        loadDashboard();
    }, 500);
}

// Load settings preferences
function loadSettings() {
    // Load theme settings
    const themeMode = localStorage.getItem('themeMode') || 'light';
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = themeMode;
    }
    
    // Load compact mode
    const compactMode = localStorage.getItem('compactMode') === 'true';
    const compactModeCheck = document.getElementById('compact-mode');
    if (compactModeCheck) {
        compactModeCheck.checked = compactMode;
        document.body.classList.toggle('compact-mode', compactMode);
    }
    
    // Load notification preferences
    const notifyConsultations = localStorage.getItem('notifyConsultations') !== 'false';
    const notifyMessages = localStorage.getItem('notifyMessages') !== 'false';
    const notifyAppointments = localStorage.getItem('notifyAppointments') !== 'false';
    
    const consultationsCheck = document.getElementById('notify-consultations');
    const messagesCheck = document.getElementById('notify-messages');
    const appointmentsCheck = document.getElementById('notify-appointments');
    
    if (consultationsCheck) consultationsCheck.checked = notifyConsultations;
    if (messagesCheck) messagesCheck.checked = notifyMessages;
    if (appointmentsCheck) appointmentsCheck.checked = notifyAppointments;
    
    // Load privacy settings
    const profileVisible = localStorage.getItem('profileVisible') !== 'false';
    const onlineStatus = localStorage.getItem('onlineStatus') !== 'false';
    
    const profileVisibleCheck = document.getElementById('profile-visible');
    const onlineStatusCheck = document.getElementById('online-status');
    
    if (profileVisibleCheck) profileVisibleCheck.checked = profileVisible;
    if (onlineStatusCheck) onlineStatusCheck.checked = onlineStatus;
    
    // Note: Settings are saved via inline onchange handlers in HTML for immediate feedback
    // This ensures settings are saved even if JavaScript errors occur
}

// Toggle compact mode
function toggleCompactMode() {
    const compactCheck = document.getElementById('compact-mode');
    if (!compactCheck) return;
    
    const isCompact = compactCheck.checked;
    document.body.classList.toggle('compact-mode', isCompact);
    localStorage.setItem('compactMode', isCompact);
    console.log('✅ Compact mode:', isCompact ? 'enabled' : 'disabled');
}

// Export user data
function exportData() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `healthcare-portal-data-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// Delete account
function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will permanently delete all your data. Type "DELETE" to confirm.')) {
        return;
    }
    
    // In a real app, this would call a server API to delete the account
    alert('Account deletion feature would be implemented with server-side API call.');
    // For now, just log out
    logout();
}

// ============================================
// MEDICATION SCHEDULE FUNCTIONS
// ============================================

// Parse prescription text into structured medication schedule
function parsePrescriptionToSchedule(prescriptionText) {
    if (!prescriptionText || !prescriptionText.trim()) {
        return [];
    }
    
    const medications = [];
    const lines = prescriptionText.split('\n').map(line => line.trim()).filter(line => line);
    
    for (const line of lines) {
        // Pattern 1: Medicine Name - Dosage - Frequency (Morning/Evening/Night)
        // Example: "Paracetamol 500mg - 1 tablet - Morning"
        let match = line.match(/^([^-]+?)\s*-\s*(.+?)\s*-\s*(Morning|Evening|Night|morning|evening|night|MORNING|EVENING|NIGHT)/i);
        if (match) {
            medications.push({
                name: match[1].trim(),
                dosage: match[2].trim(),
                timeOfDay: match[3].trim().toLowerCase(),
                time: getTimeForPeriod(match[3].trim().toLowerCase())
            });
            continue;
        }
        
        // Pattern 2: Medicine Name - Time: HH:MM (Morning/Evening/Night)
        // Example: "Aspirin - Time: 08:00 (Morning)"
        match = line.match(/^([^-]+?)\s*-\s*[Tt]ime:\s*(\d{1,2}:\d{2})\s*\(?(Morning|Evening|Night|morning|evening|night|MORNING|EVENING|NIGHT)\)?/i);
        if (match) {
            medications.push({
                name: match[1].trim(),
                dosage: '',
                timeOfDay: match[3].trim().toLowerCase(),
                time: match[2].trim()
            });
            continue;
        }
        
        // Pattern 3: Medicine Name - Dosage (with time period)
        // Example: "Ibuprofen 200mg - 1 tablet twice daily (Morning, Evening)"
        match = line.match(/^([^-]+?)\s*-\s*(.+?)\s*(?:\((.+?)\)|(Morning|Evening|Night|morning|evening|night))/i);
        if (match) {
            const timeInfo = match[3] || match[4] || '';
            const times = extractTimes(timeInfo);
            times.forEach(timeOfDay => {
                medications.push({
                    name: match[1].trim(),
                    dosage: match[2].trim(),
                    timeOfDay: timeOfDay.toLowerCase(),
                    time: getTimeForPeriod(timeOfDay.toLowerCase())
                });
            });
            continue;
        }
        
        // Pattern 4: Simple medicine name with time period mentioned
        // Example: "Vitamin D - Morning"
        match = line.match(/^([^-]+?)\s*-\s*(Morning|Evening|Night|morning|evening|night|MORNING|EVENING|NIGHT)/i);
        if (match) {
            medications.push({
                name: match[1].trim(),
                dosage: '',
                timeOfDay: match[2].trim().toLowerCase(),
                time: getTimeForPeriod(match[2].trim().toLowerCase())
            });
            continue;
        }
        
        // Pattern 5: If line contains medicine-like structure, try to extract
        if (line.match(/\b(mg|ml|tablet|capsule|dose|once|twice|thrice|daily)\b/i)) {
            const parts = line.split('-').map(p => p.trim());
            if (parts.length >= 2) {
                medications.push({
                    name: parts[0],
                    dosage: parts.slice(1).join(' - ') || '',
                    timeOfDay: inferTimeOfDay(line),
                    time: inferTime(line)
                });
            }
        }
    }
    
    return medications;
}

// Helper: Extract multiple time periods from text
function extractTimes(text) {
    const times = [];
    const timeKeywords = ['morning', 'evening', 'night'];
    const lowerText = text.toLowerCase();
    
    timeKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
            times.push(keyword);
        }
    });
    
    return times.length > 0 ? times : ['morning'];
}

// Helper: Get default time for time period
function getTimeForPeriod(period) {
    const timeMap = {
        'morning': '08:00',
        'evening': '18:00',
        'night': '20:00'
    };
    return timeMap[period.toLowerCase()] || '08:00';
}

// Helper: Infer time of day from text
function inferTimeOfDay(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('morning')) return 'morning';
    if (lowerText.includes('evening')) return 'evening';
    if (lowerText.includes('night')) return 'night';
    return 'morning';
}

// Helper: Infer time from text
function inferTime(text) {
    const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
        return timeMatch[0];
    }
    return inferTimeOfDay(text) === 'morning' ? '08:00' : 
           inferTimeOfDay(text) === 'evening' ? '18:00' : '20:00';
}

// Convert prescription to medication schedule and save
async function convertPrescriptionToSchedule(consultation) {
    if (!consultation || !consultation.prescription || !consultation.prescription.trim()) {
        console.log('No prescription to convert to schedule');
        return;
    }
    
    const medications = parsePrescriptionToSchedule(consultation.prescription);
    
    if (medications.length === 0) {
        console.log('Could not parse any medications from prescription');
        return;
    }
    
    // Create medication schedule object
    const medicationSchedule = {
        consultationId: consultation.id,
        patientEmail: consultation.patientEmail,
        doctorEmail: consultation.doctorEmail,
        createdAt: new Date().toISOString(),
        medications: medications,
        startDate: new Date().toISOString().split('T')[0]
    };
    
    // Save to localStorage
    const schedules = JSON.parse(localStorage.getItem('medicationSchedules') || '[]');
    const filteredSchedules = schedules.filter(s => s.consultationId !== consultation.id);
    filteredSchedules.push(medicationSchedule);
    localStorage.setItem('medicationSchedules', JSON.stringify(filteredSchedules));
    
    console.log('✅ Medication schedule created:', medicationSchedule);
    
    // Also save to consultation for easy access
    consultation.medicationSchedule = medicationSchedule;
    const allConsultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const index = allConsultations.findIndex(c => c.id === consultation.id);
    if (index !== -1) {
        allConsultations[index] = consultation;
        localStorage.setItem('consultations', JSON.stringify(allConsultations));
    }
    
    // Refresh medicine schedule display for patient
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (userData && consultation.patientEmail === userData.email) {
        setTimeout(() => {
            loadMedicineSchedule();
        }, 500);
    }
    
    return medicationSchedule;
}

// Get medication schedule for a patient
function getMedicationSchedule(patientEmail) {
    const schedules = JSON.parse(localStorage.getItem('medicationSchedules') || '[]');
    return schedules.filter(s => s.patientEmail === patientEmail);
}

// Get medication schedule for a consultation
function getMedicationScheduleByConsultation(consultationId) {
    const schedules = JSON.parse(localStorage.getItem('medicationSchedules') || '[]');
    return schedules.find(s => s.consultationId === consultationId);
}

// Display medication schedule in calendar-like format
function displayMedicationSchedule(patientEmail, containerElement) {
    if (!containerElement) {
        console.error('Container element not provided');
        return;
    }
    
    const schedules = getMedicationSchedule(patientEmail);
    
    if (schedules.length === 0) {
        containerElement.innerHTML = `
            <div class="medication-schedule-empty">
                <p>📅 No medication schedule available for this patient.</p>
            </div>
        `;
        return;
    }
    
    // Group medications by time of day
    const groupedByTime = {};
    
    schedules.forEach(schedule => {
        schedule.medications.forEach(med => {
            const timeKey = med.timeOfDay || 'morning';
            if (!groupedByTime[timeKey]) {
                groupedByTime[timeKey] = [];
            }
            // Check for duplicates (same medicine name and time)
            const exists = groupedByTime[timeKey].some(existing => 
                existing.name.toLowerCase() === med.name.toLowerCase() && 
                existing.time === med.time
            );
            if (!exists) {
                groupedByTime[timeKey].push({
                    ...med,
                    consultationId: schedule.consultationId,
                    createdAt: schedule.createdAt
                });
            }
        });
    });
    
    // Build calendar-like display
    let html = '<div class="medication-schedule-container">';
    
    // Display by time periods (Morning, Evening, Night)
    const timeOrder = ['morning', 'evening', 'night'];
    const hasAnyMeds = timeOrder.some(timeOfDay => groupedByTime[timeOfDay] && groupedByTime[timeOfDay].length > 0);
    
    if (!hasAnyMeds) {
        html += '<div class="medication-schedule-empty"><p>No medications scheduled.</p></div>';
        html += '</div>';
        containerElement.innerHTML = html;
        return;
    }
    
    timeOrder.forEach(timeOfDay => {
        if (groupedByTime[timeOfDay] && groupedByTime[timeOfDay].length > 0) {
            const meds = groupedByTime[timeOfDay];
            const timeLabel = timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1);
            const defaultTime = getTimeForPeriod(timeOfDay);
            
            html += `<div class="medication-time-group">`;
            html += `<div class="medication-time-header">`;
            html += `<span class="time-label">${timeLabel}</span>`;
            html += `<span class="time-value">${meds[0].time || defaultTime}</span>`;
            html += `</div>`;
            
            html += `<div class="medication-list">`;
            meds.forEach(med => {
                html += `<div class="medication-item">`;
                html += `<div class="medication-name">💊 ${med.name}</div>`;
                if (med.dosage && med.dosage.trim()) {
                    html += `<div class="medication-dosage">${med.dosage}</div>`;
                }
                html += `<div class="medication-time">Time: ${med.time || defaultTime} (${timeLabel})</div>`;
                html += `</div>`;
            });
            html += `</div>`;
            html += `</div>`;
        }
    });
    
    html += '</div>';
    containerElement.innerHTML = html;
}

// ============================================
// NEW FEATURES - ADDITIONAL FUNCTIONALITY
// ============================================

// Tab Switching Functions
function switchPatientTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.patient-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.dashboard-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`patient-tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activate tab button
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: find and activate the correct tab button
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            if (tab.textContent.toLowerCase().includes(tabName.toLowerCase().slice(0, 3))) {
                tab.classList.add('active');
            }
        });
    }
    
    // Load data when switching tabs
    if (tabName === 'main') {
        // Main tab - ensure medicine schedule is loaded
        loadMedicineSchedule();
    } else if (tabName === 'appointments') {
        loadAppointments();
    } else if (tabName === 'records') {
        loadMedicalRecords();
    } else if (tabName === 'health') {
        loadVitals();
        loadReminders();
    } else if (tabName === 'prescriptions') {
        loadPrescriptionHistory();
    } else if (tabName === 'reports') {
        loadMedicalReports();
    } else if (tabName === 'emergency') {
        loadEmergencyContacts();
    }
}

function switchDoctorTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.doctor-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.dashboard-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`doctor-tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activate tab button
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: find and activate the correct tab button
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            if (tab.textContent.toLowerCase().includes(tabName.toLowerCase().slice(0, 3))) {
                tab.classList.add('active');
            }
        });
    }
    
    // Load data when switching tabs
    if (tabName === 'main') {
        // Main tab - ensure consultation requests and history are loaded
        loadConsultationRequests();
        loadConsultationHistory();
    } else if (tabName === 'calendar') {
        loadAppointmentCalendar();
    } else if (tabName === 'patients') {
        loadMyPatients();
    } else if (tabName === 'reviews') {
        loadDoctorReviews();
    } else if (tabName === 'analytics') {
        loadDoctorAnalytics();
    }
}

// ============================================
// FEATURE 1: APPOINTMENT SCHEDULING SYSTEM
// ============================================

// Open appointment booking modal
function openAppointmentModal() {
    const modal = document.getElementById('appointment-modal');
    if (!modal) return;
    
    // Set minimum date to today
    const dateInput = document.getElementById('appointment-date');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.value = '';
    }
    
    // Load available doctors
    loadAvailableDoctorsForAppointment();
    
    modal.style.display = 'block';
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointment-modal');
    if (modal) modal.style.display = 'none';
}

// Load doctors for appointment booking
async function loadAvailableDoctorsForAppointment() {
    const select = document.getElementById('appointment-doctor');
    if (!select) return;
    
    select.innerHTML = '<option value="">Choose a doctor...</option>';
    
    try {
        const currentUserData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        const consultations = await getConsultations(currentUserData?.email || '', 'Patient');
        const allUsers = await getAllUsers();
        const consultedDoctors = new Set();
        
        consultations.forEach(c => {
            if (c.doctorEmail) consultedDoctors.add(c.doctorEmail);
        });
        
        // Get all doctors
        const doctors = Object.values(allUsers).filter(u => 
            u.user_type === 'Doctor' || u.user_type?.toLowerCase() === 'doctor'
        );
        
        doctors.forEach(doctor => {
            const email = doctor.email || Object.keys(allUsers).find(k => allUsers[k] === doctor);
            if (!email) return;
            
            const userData = doctor.user_data || {};
            const name = userData.name || email;
            const specialization = userData.specialization || 'General';
            const isConsulted = consultedDoctors.has(email);
            const label = isConsulted ? `Dr. ${name} (${specialization}) - Previously consulted` : `Dr. ${name} (${specialization})`;
            
            const option = document.createElement('option');
            option.value = email;
            option.textContent = label;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading doctors for appointment:', error);
    }
}

// Book appointment
async function bookAppointment(event) {
    event.preventDefault();
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) {
        alert('Please login to book an appointment');
        return;
    }
    
    const doctorEmail = document.getElementById('appointment-doctor').value;
    const date = document.getElementById('appointment-date').value;
    const time = document.getElementById('appointment-time').value;
    const reason = document.getElementById('appointment-reason').value;
    
    if (!doctorEmail || !date || !time) {
        alert('Please fill in all required fields');
        return;
    }
    
    const appointment = {
        id: `appt_${Date.now()}`,
        patientEmail: userData.email,
        patientName: userData.user_data?.name || 'Patient',
        doctorEmail: doctorEmail,
        date: date,
        time: time,
        reason: reason || 'Not specified',
        status: 'upcoming',
        createdAt: new Date().toISOString()
    };
    
    // Save to localStorage
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    appointments.push(appointment);
    localStorage.setItem('appointments', JSON.stringify(appointments));
    
    alert('✅ Appointment booked successfully!');
    closeAppointmentModal();
    document.getElementById('appointment-form').reset();
    
    // Reload appointments if on appointments tab
    if (document.getElementById('patient-tab-appointments')?.classList.contains('active')) {
        loadAppointments();
    }
}

// Load appointments
function loadAppointments() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const appointmentsList = document.getElementById('appointments-list');
    if (!appointmentsList) return;
    
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const userAppointments = appointments.filter(apt => 
        apt.patientEmail === userData.email || apt.doctorEmail === userData.email
    ).sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB - dateA;
    });
    
    if (userAppointments.length === 0) {
        appointmentsList.innerHTML = '<p class="empty-state">No appointments scheduled. Book an appointment to get started.</p>';
        return;
    }
    
    appointmentsList.innerHTML = userAppointments.map(apt => {
        const appointmentDate = new Date(`${apt.date}T${apt.time}`);
        const isPast = appointmentDate < new Date();
        const status = isPast ? 'completed' : apt.status;
        
        const allUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
        const isPatient = apt.patientEmail === userData.email;
        const otherParty = isPatient ? allUsers[apt.doctorEmail] : allUsers[apt.patientEmail];
        const otherPartyName = isPatient 
            ? (otherParty?.user_data?.name ? `Dr. ${otherParty.user_data.name}` : apt.doctorEmail)
            : (apt.patientName || apt.patientEmail);
        
        return `
            <div class="appointment-card">
                <div class="appointment-card-header">
                    <h4>${isPatient ? '👨‍⚕️' : '👤'} Appointment with ${otherPartyName}</h4>
                    <span class="appointment-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>
                <div class="appointment-details">
                    <div class="appointment-detail-item">
                        <span>📅</span>
                        <span>${formatDate(apt.date)}</span>
                    </div>
                    <div class="appointment-detail-item">
                        <span>⏰</span>
                        <span>${apt.time}</span>
                    </div>
                    ${apt.reason ? `
                    <div class="appointment-detail-item">
                        <span>💬</span>
                        <span>${apt.reason}</span>
                    </div>
                    ` : ''}
                </div>
                ${!isPast ? `
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="cancelAppointment('${apt.id}')">❌ Cancel</button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const index = appointments.findIndex(apt => apt.id === appointmentId);
    if (index !== -1) {
        appointments[index].status = 'cancelled';
        localStorage.setItem('appointments', JSON.stringify(appointments));
        loadAppointments();
    }
}

// ============================================
// FEATURE 2: MEDICAL RECORDS VIEWER
// ============================================

function loadMedicalRecords() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const recordsList = document.getElementById('medical-records-list');
    if (!recordsList) return;
    
    // Get all consultations with prescriptions
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const userConsultations = consultations.filter(c => 
        c.patientEmail === userData.email && c.status === 'accepted'
    ).sort((a, b) => new Date(b.requestedDate || b.createdAt) - new Date(a.requestedDate || a.createdAt));
    
    if (userConsultations.length === 0) {
        recordsList.innerHTML = '<p class="empty-state">No medical records available yet.</p>';
        return;
    }
    
    recordsList.innerHTML = userConsultations.map(consultation => {
        const allUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
        const doctor = allUsers[consultation.doctorEmail];
        const doctorName = doctor?.user_data?.name ? `Dr. ${doctor.user_data.name}` : consultation.doctorEmail;
        
        return `
            <div class="history-card">
                <div class="history-header">
                    <h4>Consultation with ${doctorName}</h4>
                    <span class="history-date">${formatDateTime(consultation.requestedDate || consultation.createdAt)}</span>
                </div>
                ${consultation.chatSummary ? `
                <div style="margin-top: 1rem;">
                    <strong>Summary:</strong>
                    <p style="color: #666; margin-top: 0.5rem;">${formatMessage(consultation.chatSummary)}</p>
                </div>
                ` : ''}
                ${consultation.prescription ? `
                <div style="margin-top: 1rem;">
                    <strong>Prescription:</strong>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 0.5rem; white-space: pre-wrap;">${consultation.prescription}</div>
                </div>
                ` : ''}
                ${consultation.medicationSchedule ? `
                <div style="margin-top: 1rem;">
                    <strong>Medication Schedule:</strong>
                    <div id="medication-schedule-${consultation.id}" style="margin-top: 0.5rem;"></div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    // Display medication schedules
    userConsultations.forEach(consultation => {
        if (consultation.medicationSchedule) {
            const container = document.getElementById(`medication-schedule-${consultation.id}`);
            if (container) {
                displayMedicationSchedule(consultation.patientEmail, container);
            }
        }
    });
}

function exportMedicalRecords() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const userConsultations = consultations.filter(c => c.patientEmail === userData.email);
    const reports = JSON.parse(localStorage.getItem('medicalReports') || '[]');
    const userReports = reports.filter(r => r.patientEmail === userData.email);
    
    const records = {
        patient: userData.user_data,
        consultations: userConsultations,
        reports: userReports,
        exportedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(records, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medical-records-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    alert('✅ Medical records exported successfully!');
}

// ============================================
// FEATURE 3: HEALTH DASHBOARD - VITALS
// ============================================

function openVitalsModal() {
    const modal = document.getElementById('vitals-modal');
    if (!modal) return;
    
    const dateInput = document.getElementById('vitals-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
        dateInput.max = new Date().toISOString().split('T')[0];
    }
    
    modal.style.display = 'block';
}

function closeVitalsModal() {
    const modal = document.getElementById('vitals-modal');
    if (modal) modal.style.display = 'none';
}

function saveVitals(event) {
    event.preventDefault();
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const vitals = {
        id: `vitals_${Date.now()}`,
        patientEmail: userData.email,
        date: document.getElementById('vitals-date').value,
        bloodPressure: document.getElementById('vitals-blood-pressure').value,
        heartRate: parseInt(document.getElementById('vitals-heart-rate').value) || null,
        temperature: parseFloat(document.getElementById('vitals-temperature').value) || null,
        weight: parseFloat(document.getElementById('vitals-weight').value) || null,
        notes: document.getElementById('vitals-notes').value,
        createdAt: new Date().toISOString()
    };
    
    const allVitals = JSON.parse(localStorage.getItem('vitals') || '[]');
    allVitals.push(vitals);
    localStorage.setItem('vitals', JSON.stringify(allVitals));
    
    alert('✅ Vital signs saved successfully!');
    closeVitalsModal();
    document.getElementById('vitals-form').reset();
    loadVitals();
}

function loadVitals() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const vitalsDisplay = document.getElementById('vitals-display');
    if (!vitalsDisplay) return;
    
    const allVitals = JSON.parse(localStorage.getItem('vitals') || '[]');
    const userVitals = allVitals.filter(v => v.patientEmail === userData.email)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10); // Show last 10
    
    if (userVitals.length === 0) {
        vitalsDisplay.innerHTML = '<p class="empty-state">No vital signs recorded yet. Add your first reading!</p>';
        return;
    }
    
    // Show latest vitals in grid format
    const latest = userVitals[0];
    vitalsDisplay.innerHTML = `
        <div class="vitals-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0;">Latest Reading - ${formatDate(latest.date)}</h4>
            </div>
            <div class="vitals-grid">
                ${latest.bloodPressure ? `
                <div class="vital-item">
                    <div class="vital-value">${latest.bloodPressure}</div>
                    <div class="vital-label">Blood Pressure</div>
                </div>
                ` : ''}
                ${latest.heartRate ? `
                <div class="vital-item">
                    <div class="vital-value">${latest.heartRate}</div>
                    <div class="vital-label">Heart Rate (BPM)</div>
                </div>
                ` : ''}
                ${latest.temperature ? `
                <div class="vital-item">
                    <div class="vital-value">${latest.temperature}°F</div>
                    <div class="vital-label">Temperature</div>
                </div>
                ` : ''}
                ${latest.weight ? `
                <div class="vital-item">
                    <div class="vital-value">${latest.weight} lbs</div>
                    <div class="vital-label">Weight</div>
                </div>
                ` : ''}
            </div>
            ${latest.notes ? `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                <strong>Notes:</strong>
                <p style="color: #666; margin-top: 0.5rem;">${latest.notes}</p>
            </div>
            ` : ''}
        </div>
        <div style="margin-top: 1rem;">
            <button class="btn-secondary" onclick="showAllVitals()">📊 View All Records (${userVitals.length})</button>
        </div>
    `;
}

function showAllVitals() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const allVitals = JSON.parse(localStorage.getItem('vitals') || '[]');
    const userVitals = allVitals.filter(v => v.patientEmail === userData.email)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const vitalsDisplay = document.getElementById('vitals-display');
    if (!vitalsDisplay) return;
    
    vitalsDisplay.innerHTML = userVitals.map(v => `
        <div class="vitals-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <h4 style="margin: 0;">${formatDate(v.date)}</h4>
                <button class="btn-secondary" onclick="deleteVitals('${v.id}')" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">🗑️</button>
            </div>
            <div class="vitals-grid">
                ${v.bloodPressure ? `<div class="vital-item"><div class="vital-value">${v.bloodPressure}</div><div class="vital-label">BP</div></div>` : ''}
                ${v.heartRate ? `<div class="vital-item"><div class="vital-value">${v.heartRate}</div><div class="vital-label">BPM</div></div>` : ''}
                ${v.temperature ? `<div class="vital-item"><div class="vital-value">${v.temperature}°F</div><div class="vital-label">Temp</div></div>` : ''}
                ${v.weight ? `<div class="vital-item"><div class="vital-value">${v.weight}</div><div class="vital-label">lbs</div></div>` : ''}
            </div>
            ${v.notes ? `<p style="margin-top: 0.5rem; color: #666;">${v.notes}</p>` : ''}
        </div>
    `).join('');
}

function deleteVitals(vitalsId) {
    if (!confirm('Delete this vital reading?')) return;
    
    const allVitals = JSON.parse(localStorage.getItem('vitals') || '[]');
    const filtered = allVitals.filter(v => v.id !== vitalsId);
    localStorage.setItem('vitals', JSON.stringify(filtered));
    showAllVitals();
}

// ============================================
// FEATURE 4: MEDICATION REMINDERS
// ============================================

function openReminderModal() {
    const modal = document.getElementById('reminder-modal');
    if (!modal) return;
    modal.style.display = 'block';
}

function closeReminderModal() {
    const modal = document.getElementById('reminder-modal');
    if (modal) modal.style.display = 'none';
}

function saveReminder(event) {
    event.preventDefault();
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const selectedDays = Array.from(document.querySelectorAll('input[name="reminder-day"]:checked')).map(cb => cb.value);
    if (selectedDays.length === 0) {
        alert('Please select at least one day');
        return;
    }
    
    const reminder = {
        id: `reminder_${Date.now()}`,
        patientEmail: userData.email,
        medication: document.getElementById('reminder-medication').value,
        time: document.getElementById('reminder-time').value,
        days: selectedDays,
        dosage: document.getElementById('reminder-dosage').value,
        enabled: true,
        createdAt: new Date().toISOString()
    };
    
    const reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
    reminders.push(reminder);
    localStorage.setItem('medicationReminders', JSON.stringify(reminders));
    
    alert('✅ Medication reminder set successfully!');
    closeReminderModal();
    document.getElementById('reminder-form').reset();
    loadReminders();
    loadMedicineSchedule(); // Refresh medicine schedule panel
    startReminderCheck();
}

function loadReminders() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const remindersList = document.getElementById('reminders-list');
    if (!remindersList) return;
    
    const reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
    const userReminders = reminders.filter(r => r.patientEmail === userData.email && r.enabled);
    
    if (userReminders.length === 0) {
        remindersList.innerHTML = '<p class="empty-state">No medication reminders set. Add a reminder to never miss a dose!</p>';
        return;
    }
    
    remindersList.innerHTML = userReminders.map(reminder => {
        const daysStr = reminder.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
        return `
            <div class="reminder-card">
                <div class="reminder-info">
                    <h4>💊 ${reminder.medication}</h4>
                    <p style="color: #666; margin: 0.25rem 0;">
                        <span class="reminder-time">⏰ ${reminder.time}</span>
                        <span style="margin-left: 1rem;">📅 ${daysStr}</span>
                    </p>
                    ${reminder.dosage ? `<p style="color: #666; margin-top: 0.25rem;">💉 ${reminder.dosage}</p>` : ''}
                </div>
                <div>
                    <button class="btn-secondary" onclick="toggleReminder('${reminder.id}')" title="Disable reminder">🔕</button>
                    <button class="btn-danger" onclick="deleteReminder('${reminder.id}')" style="margin-left: 0.5rem;" title="Delete reminder">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function toggleReminder(reminderId) {
    const reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) {
        reminder.enabled = !reminder.enabled;
        localStorage.setItem('medicationReminders', JSON.stringify(reminders));
        loadReminders();
        loadMedicineSchedule(); // Refresh medicine schedule panel
    }
}

function deleteReminder(reminderId) {
    if (!confirm('Delete this reminder?')) return;
    
    const reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
    const filtered = reminders.filter(r => r.id !== reminderId);
    localStorage.setItem('medicationReminders', JSON.stringify(filtered));
    loadReminders();
    loadMedicineSchedule(); // Refresh medicine schedule panel
}

// Check for medication reminders
function startReminderCheck() {
    // Clear existing interval
    if (window.reminderCheckInterval) {
        clearInterval(window.reminderCheckInterval);
    }
    
    // Check every minute
    window.reminderCheckInterval = setInterval(() => {
        const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        if (!userData) return;
        
        const reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
        const userReminders = reminders.filter(r => r.patientEmail === userData.email && r.enabled);
        
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
        
        userReminders.forEach(reminder => {
            if (reminder.time === currentTime && reminder.days.includes(currentDay)) {
                // Show notification (don't spam - check if already shown today)
                const lastShown = localStorage.getItem(`reminder_shown_${reminder.id}_${now.toDateString()}`);
                if (!lastShown) {
                    showReminderNotification(reminder);
                    localStorage.setItem(`reminder_shown_${reminder.id}_${now.toDateString()}`, 'true');
                }
            }
        });
    }, 60000); // Check every minute
}

function showReminderNotification(reminder) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'reminder-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
    `;
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <h4 style="margin: 0;">⏰ Medication Reminder</h4>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>
        <p style="margin: 0.5rem 0;"><strong>${reminder.medication}</strong></p>
        ${reminder.dosage ? `<p style="margin: 0.25rem 0; font-size: 0.9rem;">💉 ${reminder.dosage}</p>` : ''}
        <p style="margin: 0.25rem 0; font-size: 0.85rem; opacity: 0.9;">Time: ${reminder.time}</p>
    `;
    document.body.appendChild(notification);
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// ============================================
// FEATURE 5: PRESCRIPTION HISTORY
// ============================================

function loadPrescriptionHistory() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const prescriptionsList = document.getElementById('prescriptions-history-list');
    if (!prescriptionsList) return;
    
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const prescriptions = consultations.filter(c => 
        c.patientEmail === userData.email && c.prescription && c.status === 'accepted'
    ).sort((a, b) => new Date(b.requestedDate || b.createdAt) - new Date(a.requestedDate || a.createdAt));
    
    if (prescriptions.length === 0) {
        prescriptionsList.innerHTML = '<p class="empty-state">No prescription history available.</p>';
        return;
    }
    
    prescriptionsList.innerHTML = prescriptions.map(consultation => {
        const allUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
        const doctor = allUsers[consultation.doctorEmail];
        const doctorName = doctor?.user_data?.name ? `Dr. ${doctor.user_data.name}` : consultation.doctorEmail;
        
        return `
            <div class="history-card">
                <div class="history-header">
                    <h4>💊 Prescription from ${doctorName}</h4>
                    <span class="history-date">${formatDateTime(consultation.requestedDate || consultation.createdAt)}</span>
                </div>
                <div style="margin-top: 1rem; white-space: pre-wrap; background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                    ${consultation.prescription}
                </div>
                ${consultation.medicationSchedule ? `
                <div style="margin-top: 1rem;">
                    <button class="btn-secondary" onclick="viewMedicationSchedule('${consultation.id}')">📅 View Medication Schedule</button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function viewMedicationSchedule(consultationId) {
    const consultation = JSON.parse(localStorage.getItem('consultations') || '[]').find(c => c.id === consultationId);
    if (!consultation || !consultation.medicationSchedule) return;
    
    const scheduleContainer = document.createElement('div');
    scheduleContainer.id = 'schedule-modal-container';
    scheduleContainer.style.cssText = 'margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>📅 Medication Schedule</h2>
            <div id="schedule-display"></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const display = document.getElementById('schedule-display');
    if (display && consultation.patientEmail) {
        displayMedicationSchedule(consultation.patientEmail, display);
    }
}

function exportPrescriptions() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const prescriptions = consultations.filter(c => 
        c.patientEmail === userData.email && c.prescription
    ).map(c => ({
        doctor: c.doctorEmail,
        date: c.requestedDate || c.createdAt,
        prescription: c.prescription,
        medicationSchedule: c.medicationSchedule
    }));
    
    const dataStr = JSON.stringify(prescriptions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prescriptions-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    alert('✅ Prescriptions exported successfully!');
}

// ============================================
// FEATURE 6: MEDICAL REPORTS UPLOAD
// ============================================

function openReportUploadModal() {
    const modal = document.getElementById('report-upload-modal');
    if (!modal) return;
    
    const dateInput = document.getElementById('report-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
        dateInput.max = new Date().toISOString().split('T')[0];
    }
    
    modal.style.display = 'block';
}

function closeReportUploadModal() {
    const modal = document.getElementById('report-upload-modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('report-upload-form').reset();
}

function uploadReport(event) {
    event.preventDefault();
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const fileInput = document.getElementById('report-file');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a file to upload');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const report = {
            id: `report_${Date.now()}`,
            patientEmail: userData.email,
            title: document.getElementById('report-title').value,
            date: document.getElementById('report-date').value,
            type: document.getElementById('report-type').value,
            fileData: e.target.result,
            fileName: file.name,
            fileType: file.type,
            notes: document.getElementById('report-notes').value,
            uploadedAt: new Date().toISOString()
        };
        
        const reports = JSON.parse(localStorage.getItem('medicalReports') || '[]');
        reports.push(report);
        localStorage.setItem('medicalReports', JSON.stringify(reports));
        
        alert('✅ Medical report uploaded successfully!');
        closeReportUploadModal();
        loadMedicalReports();
    };
    
    reader.readAsDataURL(file);
}

function loadMedicalReports() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const reportsList = document.getElementById('reports-list');
    if (!reportsList) return;
    
    const reports = JSON.parse(localStorage.getItem('medicalReports') || '[]');
    const userReports = reports.filter(r => r.patientEmail === userData.email)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (userReports.length === 0) {
        reportsList.innerHTML = '<p class="empty-state">No medical reports uploaded yet. Upload your first report!</p>';
        return;
    }
    
    reportsList.innerHTML = userReports.map(report => {
        return `
            <div class="report-card">
                <div class="report-info">
                    <h4>${report.title}</h4>
                    <p style="color: #666; margin: 0.25rem 0;">
                        <span class="report-type">${report.type}</span>
                        <span style="margin-left: 1rem;">📅 ${formatDate(report.date)}</span>
                    </p>
                    ${report.notes ? `<p style="color: #666; margin-top: 0.25rem; font-size: 0.9rem;">${report.notes}</p>` : ''}
                </div>
                <div>
                    <button class="btn-primary" onclick="viewReport('${report.id}')" title="View report">👁️ View</button>
                    <button class="btn-secondary" onclick="downloadReport('${report.id}')" style="margin-left: 0.5rem;" title="Download report">📥 Download</button>
                    <button class="btn-danger" onclick="deleteReport('${report.id}')" style="margin-left: 0.5rem;" title="Delete report">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function viewReport(reportId) {
    const reports = JSON.parse(localStorage.getItem('medicalReports') || '[]');
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90vw; max-height: 90vh; overflow: auto;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>${report.title}</h2>
            <p style="color: #666; margin-bottom: 1rem;">📅 ${formatDate(report.date)} | 🏥 ${report.type}</p>
            ${report.notes ? `<p style="margin-bottom: 1rem;">${report.notes}</p>` : ''}
            <div style="text-align: center; margin-top: 2rem;">
                ${report.fileType.startsWith('image/') 
                    ? `<img src="${report.fileData}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" alt="${report.title}">`
                    : `<iframe src="${report.fileData}" style="width: 100%; height: 600px; border: none; border-radius: 8px;"></iframe>`
                }
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function downloadReport(reportId) {
    const reports = JSON.parse(localStorage.getItem('medicalReports') || '[]');
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    
    const link = document.createElement('a');
    link.href = report.fileData;
    link.download = report.fileName || `report-${report.id}`;
    link.click();
}

function deleteReport(reportId) {
    if (!confirm('Delete this medical report?')) return;
    
    const reports = JSON.parse(localStorage.getItem('medicalReports') || '[]');
    const filtered = reports.filter(r => r.id !== reportId);
    localStorage.setItem('medicalReports', JSON.stringify(filtered));
    loadMedicalReports();
}

// ============================================
// FEATURE 7: EMERGENCY CONTACTS
// ============================================

function openEmergencyContactModal() {
    const modal = document.getElementById('emergency-contact-modal');
    if (!modal) return;
    modal.style.display = 'block';
}

function closeEmergencyContactModal() {
    const modal = document.getElementById('emergency-contact-modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('emergency-contact-form').reset();
}

function saveEmergencyContact(event) {
    event.preventDefault();
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const contact = {
        id: `emergency_${Date.now()}`,
        patientEmail: userData.email,
        name: document.getElementById('emergency-name').value,
        relationship: document.getElementById('emergency-relationship').value,
        phone: document.getElementById('emergency-phone').value,
        email: document.getElementById('emergency-email').value,
        priority: document.getElementById('emergency-priority').value,
        createdAt: new Date().toISOString()
    };
    
    const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
    contacts.push(contact);
    localStorage.setItem('emergencyContacts', JSON.stringify(contacts));
    
    alert('✅ Emergency contact saved successfully!');
    closeEmergencyContactModal();
    loadEmergencyContacts();
}

function loadEmergencyContacts() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const contactsList = document.getElementById('emergency-contacts-list');
    if (!contactsList) return;
    
    const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
    const userContacts = contacts.filter(c => c.patientEmail === userData.email)
        .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    
    if (userContacts.length === 0) {
        contactsList.innerHTML = '<p class="empty-state">No emergency contacts added. Add a contact for quick access in emergencies!</p>';
        return;
    }
    
    contactsList.innerHTML = userContacts.map(contact => {
        const priorityIcons = { high: '🔴', medium: '🟡', low: '🟢' };
        return `
            <div class="emergency-contact-card ${contact.priority}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h4 style="margin: 0;">${contact.name}</h4>
                        <p style="color: #666; margin: 0.25rem 0;">${contact.relationship}</p>
                        <p style="color: #666; margin: 0.25rem 0;">${priorityIcons[contact.priority]} ${contact.priority.toUpperCase()} Priority</p>
                    </div>
                    <button class="btn-danger" onclick="deleteEmergencyContact('${contact.id}')" title="Delete contact">🗑️</button>
                </div>
                <div class="emergency-quick-call">
                    <p style="margin: 0.5rem 0;"><strong>📱 Phone:</strong> <a href="tel:${contact.phone}" style="color: #667eea;">${contact.phone}</a></p>
                    ${contact.email ? `<p style="margin: 0.5rem 0;"><strong>📧 Email:</strong> <a href="mailto:${contact.email}" style="color: #667eea;">${contact.email}</a></p>` : ''}
                    <button class="btn-primary" onclick="callEmergency('${contact.phone}')" style="margin-top: 1rem;">📞 Call Now</button>
                </div>
            </div>
        `;
    }).join('');
}

function callEmergency(phoneNumber) {
    if (confirm(`Call ${phoneNumber}?`)) {
        window.location.href = `tel:${phoneNumber}`;
    }
}

function deleteEmergencyContact(contactId) {
    if (!confirm('Delete this emergency contact?')) return;
    
    const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
    const filtered = contacts.filter(c => c.id !== contactId);
    localStorage.setItem('emergencyContacts', JSON.stringify(filtered));
    loadEmergencyContacts();
}

// ============================================
// FEATURE 8: DOCTOR FEATURES - APPOINTMENT CALENDAR
// ============================================

function loadAppointmentCalendar() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const calendarView = document.getElementById('appointment-calendar-view');
    if (!calendarView) return;
    
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const doctorAppointments = appointments.filter(apt => apt.doctorEmail === userData.email);
    
    // Get current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Build calendar
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <div>
                <button class="btn-secondary" onclick="changeCalendarMonth(-1)">← Previous</button>
                <button class="btn-secondary" onclick="changeCalendarMonth(1)" style="margin-left: 0.5rem;">Next →</button>
            </div>
        </div>
        <div class="calendar-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<div style="text-align: center; font-weight: 600; color: #667eea;">${day}</div>`).join('')}
        </div>
        <div class="appointment-calendar">
    `;
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day"></div>';
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayAppointments = doctorAppointments.filter(apt => apt.date === dateStr);
        const isToday = now.getDate() === day && now.getMonth() === currentMonth && now.getFullYear() === currentYear;
        const hasAppointment = dayAppointments.length > 0;
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasAppointment ? 'has-appointment' : ''}" 
                 onclick="showDayAppointments('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${hasAppointment ? '<div class="calendar-appointment-dot"></div>' : ''}
            </div>
        `;
    }
    
    html += '</div>';
    calendarView.innerHTML = html;
}

function changeCalendarMonth(direction) {
    // Store current month in a global variable or localStorage
    if (!window.calendarMonth) {
        window.calendarMonth = new Date().getMonth();
        window.calendarYear = new Date().getFullYear();
    }
    
    window.calendarMonth += direction;
    if (window.calendarMonth < 0) {
        window.calendarMonth = 11;
        window.calendarYear--;
    } else if (window.calendarMonth > 11) {
        window.calendarMonth = 0;
        window.calendarYear++;
    }
    
    // Rebuild calendar with new month
    loadAppointmentCalendarForMonth(window.calendarMonth, window.calendarYear);
}

function loadAppointmentCalendarForMonth(month, year) {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const calendarView = document.getElementById('appointment-calendar-view');
    if (!calendarView) return;
    
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const doctorAppointments = appointments.filter(apt => apt.doctorEmail === userData.email);
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>${new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <div>
                <button class="btn-secondary" onclick="changeCalendarMonth(-1)">← Previous</button>
                <button class="btn-secondary" onclick="changeCalendarMonth(1)" style="margin-left: 0.5rem;">Next →</button>
            </div>
        </div>
        <div class="calendar-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<div style="text-align: center; font-weight: 600; color: #667eea;">${day}</div>`).join('')}
        </div>
        <div class="appointment-calendar">
    `;
    
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayAppointments = doctorAppointments.filter(apt => apt.date === dateStr);
        const isToday = now.getDate() === day && now.getMonth() === month && now.getFullYear() === year;
        const hasAppointment = dayAppointments.length > 0;
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasAppointment ? 'has-appointment' : ''}" 
                 onclick="showDayAppointments('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${hasAppointment ? `<div class="calendar-appointment-dot"></div>` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    calendarView.innerHTML = html;
}

function showDayAppointments(dateStr) {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const dayAppointments = appointments.filter(apt => 
        apt.doctorEmail === userData.email && apt.date === dateStr
    ).sort((a, b) => a.time.localeCompare(b.time));
    
    if (dayAppointments.length === 0) {
        alert(`No appointments on ${formatDate(dateStr)}`);
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>📅 Appointments - ${formatDate(dateStr)}</h2>
            <div style="margin-top: 1rem;">
                ${dayAppointments.map(apt => `
                    <div class="appointment-card" style="margin-bottom: 1rem;">
                        <div class="appointment-card-header">
                            <h4>👤 ${apt.patientName || apt.patientEmail}</h4>
                            <span class="appointment-status ${apt.status}">${apt.status}</span>
                        </div>
                        <div class="appointment-details">
                            <div class="appointment-detail-item">
                                <span>⏰</span>
                                <span>${apt.time}</span>
                            </div>
                            ${apt.reason ? `
                            <div class="appointment-detail-item">
                                <span>💬</span>
                                <span>${apt.reason}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ============================================
// FEATURE 9: DOCTOR - MY PATIENTS
// ============================================

function loadMyPatients() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const patientsList = document.getElementById('patients-list');
    if (!patientsList) return;
    
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const patientSet = new Set();
    
    consultations.forEach(c => {
        if (c.doctorEmail === userData.email && c.patientEmail) {
            patientSet.add(c.patientEmail);
        }
    });
    
    appointments.forEach(apt => {
        if (apt.doctorEmail === userData.email && apt.patientEmail) {
            patientSet.add(apt.patientEmail);
        }
    });
    
    const allUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
    const patients = Array.from(patientSet).map(email => {
        const user = allUsers[email];
        const consultationsCount = consultations.filter(c => c.doctorEmail === userData.email && c.patientEmail === email).length;
        const appointmentsCount = appointments.filter(apt => apt.doctorEmail === userData.email && apt.patientEmail === email).length;
        
        return {
            email: email,
            name: user?.user_data?.name || 'Patient',
            contact: user?.user_data?.contact || 'N/A',
            consultationsCount: consultationsCount,
            appointmentsCount: appointmentsCount,
            lastConsultation: consultations.filter(c => c.doctorEmail === userData.email && c.patientEmail === email)
                .sort((a, b) => new Date(b.requestedDate || b.createdAt) - new Date(a.requestedDate || a.createdAt))[0]
        };
    });
    
    if (patients.length === 0) {
        patientsList.innerHTML = '<p class="empty-state">No patients yet. Patients will appear here after consultations or appointments.</p>';
        return;
    }
    
    patientsList.innerHTML = patients.map(patient => {
        return `
            <div class="patient-card" onclick="viewPatientDetails('${patient.email}')">
                <div class="patient-card-header">
                    <h4>👤 ${patient.name}</h4>
                    <button class="btn-secondary" onclick="event.stopPropagation(); viewPatientMedicationSchedule('${patient.email}')" title="View medication schedule">💊</button>
                </div>
                <p style="color: #666; margin: 0.5rem 0;"><strong>📧 Email:</strong> ${patient.email}</p>
                <p style="color: #666; margin: 0.5rem 0;"><strong>📱 Contact:</strong> ${patient.contact}</p>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    <span style="color: #667eea; font-weight: 600;">📋 ${patient.consultationsCount} Consultation(s)</span>
                    <span style="color: #667eea; font-weight: 600;">📅 ${patient.appointmentsCount} Appointment(s)</span>
                </div>
                ${patient.lastConsultation ? `<p style="color: #999; font-size: 0.85rem; margin-top: 0.5rem;">Last: ${formatDateTime(patient.lastConsultation.requestedDate || patient.lastConsultation.createdAt)}</p>` : ''}
            </div>
        `;
    }).join('');
}

function searchPatients(query) {
    if (!query || query.trim() === '') {
        loadMyPatients();
        return;
    }
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const patientsList = document.getElementById('patients-list');
    if (!patientsList) return;
    
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const patientSet = new Set();
    
    consultations.forEach(c => {
        if (c.doctorEmail === userData.email && c.patientEmail) {
            patientSet.add(c.patientEmail);
        }
    });
    
    appointments.forEach(apt => {
        if (apt.doctorEmail === userData.email && apt.patientEmail) {
            patientSet.add(apt.patientEmail);
        }
    });
    
    const allUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
    const searchLower = query.toLowerCase();
    
    const patients = Array.from(patientSet)
        .map(email => {
            const user = allUsers[email];
            return {
                email: email,
                name: user?.user_data?.name || 'Patient',
                user: user
            };
        })
        .filter(p => 
            p.name.toLowerCase().includes(searchLower) || 
            p.email.toLowerCase().includes(searchLower)
        )
        .map(p => {
            const consultationsCount = consultations.filter(c => c.doctorEmail === userData.email && c.patientEmail === p.email).length;
            const appointmentsCount = appointments.filter(apt => apt.doctorEmail === userData.email && apt.patientEmail === p.email).length;
            return {
                ...p,
                consultationsCount: consultationsCount,
                appointmentsCount: appointmentsCount
            };
        });
    
    if (patients.length === 0) {
        patientsList.innerHTML = '<p class="empty-state">No patients found matching your search.</p>';
        return;
    }
    
    patientsList.innerHTML = patients.map(patient => `
        <div class="patient-card" onclick="viewPatientDetails('${patient.email}')">
            <div class="patient-card-header">
                <h4>👤 ${patient.name}</h4>
            </div>
            <p style="color: #666;"><strong>📧 Email:</strong> ${patient.email}</p>
            <div style="margin-top: 1rem;">
                <span style="color: #667eea;">📋 ${patient.consultationsCount} Consultation(s) | 📅 ${patient.appointmentsCount} Appointment(s)</span>
            </div>
        </div>
    `).join('');
}

function viewPatientDetails(patientEmail) {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const allUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
    const patient = allUsers[patientEmail];
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const patientConsultations = consultations.filter(c => 
        c.doctorEmail === userData.email && c.patientEmail === patientEmail
    ).sort((a, b) => new Date(b.requestedDate || b.createdAt) - new Date(a.requestedDate || a.createdAt));
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>👤 Patient Details</h2>
            <div style="margin-top: 1rem;">
                <p><strong>Name:</strong> ${patient?.user_data?.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${patientEmail}</p>
                <p><strong>Contact:</strong> ${patient?.user_data?.contact || 'N/A'}</p>
                <p><strong>Bio:</strong> ${patient?.user_data?.bio || 'N/A'}</p>
            </div>
            <div style="margin-top: 2rem;">
                <h3>📋 Consultation History (${patientConsultations.length})</h3>
                ${patientConsultations.map(c => `
                    <div class="history-card" style="margin-top: 1rem;">
                        <div class="history-header">
                            <h4>${formatDateTime(c.requestedDate || c.createdAt)}</h4>
                            <span class="status-badge status-${c.status}">${c.status}</span>
                        </div>
                        ${c.chatSummary ? `<p style="margin-top: 0.5rem; color: #666;">${formatMessage(c.chatSummary).substring(0, 200)}...</p>` : ''}
                        ${c.prescription ? `<p style="margin-top: 0.5rem;"><strong>Prescription:</strong> Available</p>` : ''}
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 2rem;">
                <button class="btn-primary" onclick="viewPatientMedicationSchedule('${patientEmail}')">💊 View Medication Schedule</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function viewPatientMedicationSchedule(patientEmail) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>💊 Patient Medication Schedule</h2>
            <div id="patient-schedule-display" style="margin-top: 1rem;"></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const display = document.getElementById('patient-schedule-display');
    if (display) {
        displayMedicationSchedule(patientEmail, display);
    }
}

// ============================================
// FEATURE 10: DOCTOR REVIEWS & RATINGS
// ============================================

function loadDoctorReviews() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const reviewsList = document.getElementById('reviews-list');
    if (!reviewsList) return;
    
    const reviews = JSON.parse(localStorage.getItem('doctorReviews') || '[]');
    const doctorReviews = reviews.filter(r => r.doctorEmail === userData.email)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (doctorReviews.length === 0) {
        reviewsList.innerHTML = '<p class="empty-state">No reviews yet. Reviews will appear here after patients rate consultations.</p>';
        return;
    }
    
    // Calculate average rating
    const avgRating = doctorReviews.reduce((sum, r) => sum + r.rating, 0) / doctorReviews.length;
    
    reviewsList.innerHTML = `
        <div class="stat-card" style="margin-bottom: 2rem;">
            <div class="stat-value">${avgRating.toFixed(1)} ⭐</div>
            <div class="stat-label">Average Rating from ${doctorReviews.length} Review(s)</div>
        </div>
        ${doctorReviews.map(review => `
            <div class="review-card">
                <div class="review-header">
                    <div>
                        <div class="review-rating">
                            ${Array.from({ length: 5 }, (_, i) => 
                                `<span class="star ${i < review.rating ? 'filled' : 'empty'}">⭐</span>`
                            ).join('')}
                        </div>
                        <div class="review-patient" style="margin-top: 0.5rem;">${review.patientName || review.patientEmail}</div>
                    </div>
                    <div class="review-date">${formatDateTime(review.createdAt)}</div>
                </div>
                ${review.comment ? `<p style="margin-top: 1rem; color: #666;">${review.comment}</p>` : ''}
                ${review.consultationId ? `<p style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">Consultation ID: ${review.consultationId}</p>` : ''}
            </div>
        `).join('')}
    `;
}

// Function to submit review (called after consultation ends)
function submitReview(consultationId, doctorEmail, rating, comment) {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const review = {
        id: `review_${Date.now()}`,
        consultationId: consultationId,
        doctorEmail: doctorEmail,
        patientEmail: userData.email,
        patientName: userData.user_data?.name || 'Patient',
        rating: rating,
        comment: comment || '',
        createdAt: new Date().toISOString()
    };
    
    const reviews = JSON.parse(localStorage.getItem('doctorReviews') || '[]');
    // Remove existing review for this consultation if any
    const filtered = reviews.filter(r => r.consultationId !== consultationId);
    filtered.push(review);
    localStorage.setItem('doctorReviews', JSON.stringify(filtered));
}

// ============================================
// FEATURE 11: DOCTOR ANALYTICS
// ============================================

function loadDoctorAnalytics() {
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!userData) return;
    
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const reviews = JSON.parse(localStorage.getItem('doctorReviews') || '[]');
    
    const doctorConsultations = consultations.filter(c => c.doctorEmail === userData.email);
    const doctorAppointments = appointments.filter(apt => apt.doctorEmail === userData.email);
    const doctorReviews = reviews.filter(r => r.doctorEmail === userData.email);
    
    const totalConsultations = doctorConsultations.length;
    const acceptedConsultations = doctorConsultations.filter(c => c.status === 'accepted').length;
    const totalAppointments = doctorAppointments.length;
    const upcomingAppointments = doctorAppointments.filter(apt => {
        const aptDate = new Date(`${apt.date}T${apt.time}`);
        return aptDate > new Date() && apt.status !== 'cancelled';
    }).length;
    
    const avgRating = doctorReviews.length > 0 
        ? (doctorReviews.reduce((sum, r) => sum + r.rating, 0) / doctorReviews.length).toFixed(1)
        : 'N/A';
    
    const statsHtml = `
        <div class="analytics-grid">
            <div class="stat-card">
                <div class="stat-value">${totalConsultations}</div>
                <div class="stat-label">Total Consultations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${acceptedConsultations}</div>
                <div class="stat-label">Accepted Consultations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalAppointments}</div>
                <div class="stat-label">Total Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${upcomingAppointments}</div>
                <div class="stat-label">Upcoming Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${avgRating} ⭐</div>
                <div class="stat-label">Average Rating</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${doctorReviews.length}</div>
                <div class="stat-label">Total Reviews</div>
            </div>
        </div>
    `;
    
    const consultationStatsEl = document.getElementById('consultation-stats');
    if (consultationStatsEl) {
        consultationStatsEl.innerHTML = statsHtml;
    }
    
    // Performance overview
    const performanceHtml = `
        <div style="margin-top: 1rem;">
            <h4>📈 Recent Activity</h4>
            <p>Last 30 days:</p>
            <ul style="list-style: none; padding: 0;">
                <li style="padding: 0.5rem 0; border-bottom: 1px solid #e0e0e0;">📋 ${doctorConsultations.filter(c => {
                    const date = new Date(c.requestedDate || c.createdAt);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return date > thirtyDaysAgo;
                }).length} Consultations</li>
                <li style="padding: 0.5rem 0; border-bottom: 1px solid #e0e0e0;">📅 ${doctorAppointments.filter(apt => {
                    const date = new Date(apt.date);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return date > thirtyDaysAgo;
                }).length} Appointments</li>
                <li style="padding: 0.5rem 0;">⭐ ${doctorReviews.filter(r => {
                    const date = new Date(r.createdAt);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return date > thirtyDaysAgo;
                }).length} New Reviews</li>
            </ul>
        </div>
    `;
    
    const performanceEl = document.getElementById('performance-overview');
    if (performanceEl) {
        performanceEl.innerHTML = performanceHtml;
    }
}

// ============================================
// FEATURE 12: REVIEW & RATING SYSTEM
// ============================================

function showReviewModal(consultationId, doctorEmail) {
    const modal = document.getElementById('review-modal');
    if (!modal) return;
    
    // Check if already reviewed
    const reviews = JSON.parse(localStorage.getItem('doctorReviews') || '[]');
    const existingReview = reviews.find(r => r.consultationId === consultationId);
    if (existingReview) {
        return; // Already reviewed
    }
    
    document.getElementById('review-consultation-id').value = consultationId;
    document.getElementById('review-doctor-email').value = doctorEmail;
    document.getElementById('review-rating').value = '';
    document.getElementById('review-comment').value = '';
    
    // Reset stars
    document.querySelectorAll('.star-rating').forEach(star => {
        star.style.opacity = '0.3';
    });
    
    modal.style.display = 'block';
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'none';
}

function setRating(rating) {
    document.getElementById('review-rating').value = rating;
    
    // Update star display
    document.querySelectorAll('.star-rating').forEach((star, index) => {
        if (index < rating) {
            star.style.opacity = '1';
        } else {
            star.style.opacity = '0.3';
        }
    });
}

function submitReviewForm(event) {
    event.preventDefault();
    
    const consultationId = document.getElementById('review-consultation-id').value;
    const doctorEmail = document.getElementById('review-doctor-email').value;
    const rating = parseInt(document.getElementById('review-rating').value);
    const comment = document.getElementById('review-comment').value;
    
    if (!rating || rating < 1 || rating > 5) {
        alert('Please select a rating');
        return;
    }
    
    submitReview(consultationId, doctorEmail, rating, comment);
    closeReviewModal();
    alert('✅ Thank you for your review!');
    
    // Reload reviews if doctor is viewing
    if (document.getElementById('doctor-tab-reviews')?.classList.contains('active')) {
        loadDoctorReviews();
    }
}

function skipReview() {
    closeReviewModal();
}

// ============================================
// FEATURE 13: EXPORT CONSULTATION TRANSCRIPT
// ============================================

function exportConsultationTranscript(consultationId) {
    const consultations = JSON.parse(localStorage.getItem('consultations') || '[]');
    const consultation = consultations.find(c => c.id === consultationId);
    if (!consultation) {
        alert('Consultation not found');
        return;
    }
    
    const chats = JSON.parse(localStorage.getItem('chats') || '{}');
    const chatHistory = chats[consultation.chatId] || { messages: [] };
    
    const allUsers = JSON.parse(localStorage.getItem('usersDB') || '{}');
    const doctor = allUsers[consultation.doctorEmail];
    const doctorName = doctor?.user_data?.name ? `Dr. ${doctor.user_data.name}` : consultation.doctorEmail;
    
    const userData = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const patientName = userData?.user_data?.name || consultation.patientEmail;
    
    let transcript = `CONSULTATION TRANSCRIPT\n`;
    transcript += `================================\n\n`;
    transcript += `Patient: ${patientName}\n`;
    transcript += `Doctor: ${doctorName}\n`;
    transcript += `Date: ${formatDateTime(consultation.requestedDate || consultation.createdAt)}\n`;
    transcript += `Status: ${consultation.status}\n\n`;
    
    if (consultation.chatSummary) {
        transcript += `SUMMARY:\n${consultation.chatSummary}\n\n`;
        transcript += `================================\n\n`;
    }
    
    transcript += `CHAT MESSAGES:\n`;
    transcript += `================================\n\n`;
    
    chatHistory.messages.forEach(msg => {
        const sender = msg.role === 'user' ? patientName : 'AI Assistant';
        const timestamp = msg.timestamp ? formatDateTime(msg.timestamp) : '';
        transcript += `[${timestamp}] ${sender}:\n${msg.content}\n\n`;
    });
    
    if (consultation.prescription) {
        transcript += `\n================================\n`;
        transcript += `PRESCRIPTION:\n`;
        transcript += `================================\n\n`;
        transcript += `${consultation.prescription}\n\n`;
    }
    
    if (consultation.medicationSchedule) {
        transcript += `\n================================\n`;
        transcript += `MEDICATION SCHEDULE:\n`;
        transcript += `================================\n\n`;
        // You can format medication schedule here
        transcript += `See medication schedule in the app.\n\n`;
    }
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `consultation-transcript-${consultationId}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    alert('✅ Consultation transcript exported successfully!');
}

// Add export button to consultation history
function addExportButtonToConsultations() {
    // This will be called when loading consultation history
    setTimeout(() => {
        document.querySelectorAll('.history-card').forEach(card => {
            const consultationId = card.getAttribute('data-consultation-id');
            if (consultationId && !card.querySelector('.export-btn')) {
                const exportBtn = document.createElement('button');
                exportBtn.className = 'btn-secondary export-btn';
                exportBtn.style.cssText = 'margin-top: 0.5rem; padding: 0.5rem 1rem; font-size: 0.85rem;';
                exportBtn.textContent = '📥 Export Transcript';
                exportBtn.onclick = () => exportConsultationTranscript(consultationId);
                card.appendChild(exportBtn);
            }
        });
    }, 500);
}

// ============================================
// FEATURE 14: NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info', duration = 5000) {
    // Check if notifications are enabled
    const notifyConsultations = localStorage.getItem('notifyConsultations') !== 'false';
    const notifyMessages = localStorage.getItem('notifyMessages') !== 'false';
    const notifyAppointments = localStorage.getItem('notifyAppointments') !== 'false';
    
    if (type === 'consultation' && !notifyConsultations) return;
    if (type === 'message' && !notifyMessages) return;
    if (type === 'appointment' && !notifyAppointments) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 
                      type === 'error' ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)' : 
                      type === 'warning' ? 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)' :
                      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
        cursor: pointer;
    `;
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 600;">${message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; margin-left: 1rem;">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
    
    // Remove on click
    notification.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
}

// Add CSS animations for notifications
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}

// Initialize reminder checking on page load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // Start reminder checking after a short delay
        setTimeout(() => {
            startReminderCheck();
        }, 2000);
        
        // Initialize calendar month if needed
        window.calendarMonth = new Date().getMonth();
        window.calendarYear = new Date().getFullYear();
    });
}

