// Initialize users database in localStorage
function initUsersDB() {
    try {
        if (!localStorage.getItem('usersDB')) {
            localStorage.setItem('usersDB', JSON.stringify({}));
        }
    } catch (error) {
        console.error('Error initializing users database:', error);
        // Continue even if localStorage fails
    }
}

// Hash password (simple SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Get users database
function getUsersDB() {
    return JSON.parse(localStorage.getItem('usersDB') || '{}');
}

// Save users database
function saveUsersDB(users) {
    localStorage.setItem('usersDB', JSON.stringify(users));
}

// Register a new user (local storage)
async function localRegisterUser(email, password, userType, userData) {
    try {
        const users = getUsersDB();
        
        if (users[email]) {
            return { success: false, message: 'Email already registered. Please login instead.' };
        }
        
        const hashedPassword = await hashPassword(password);
        
        // Debug logging (remove in production)
        console.log('Registration:', {
            email: email,
            passwordLength: password.length,
            hashedPasswordLength: hashedPassword.length,
            userType: userType
        });
        
        users[email] = {
            password: hashedPassword,
            user_type: userType,
            user_data: userData,
            registered_date: new Date().toISOString()
        };
        
        saveUsersDB(users);
        
        // Verify the user was saved with password
        const savedUsers = getUsersDB();
        const savedUser = savedUsers[email];
        if (!savedUser) {
            console.error('User was not saved to localStorage!');
            return { success: false, message: 'Registration failed. Please try again.' };
        }
        
        // Verify password was saved
        if (!savedUser.password || savedUser.password.length === 0) {
            console.error('Password was not saved! Password length:', savedUser.password ? savedUser.password.length : 0);
            return { success: false, message: 'Registration failed: password not saved. Please try again.' };
        }
        
        console.log('✅ User registered successfully. Password length:', savedUser.password.length);
        return { success: true, message: 'Registration successful!' };
    } catch (error) {
        console.error('Error in localRegisterUser:', error);
        return { success: false, message: 'An error occurred during registration. Please try again.' };
    }
}

// Login user (checks local storage first, then server for cross-device login)
async function localLoginUser(email, password) {
    try {
        const hashedPassword = await hashPassword(password);
        const users = getUsersDB();
        
        // First, check local storage
        if (users[email]) {
            const storedPassword = users[email].password;
            
            if (storedPassword && storedPassword.length > 0) {
                if (storedPassword === hashedPassword) {
                    // Local login successful
                    sessionStorage.setItem('currentUser', JSON.stringify({
                        email: email,
                        user_type: users[email].user_type,
                        user_data: users[email].user_data
                    }));
                    return { success: true, message: 'Login successful!' };
                } else {
                    // Password doesn't match locally - try server
                    console.log('Password mismatch locally, trying server login...');
                }
            }
        }
        
        // User not found locally or password mismatch - try server login (cross-device)
        console.log('User not found locally, attempting server login for cross-device access...');
        console.log(`🔑 Login attempt - Email: ${email}, Hash length: ${hashedPassword.length}`);
        
        // Check if loginUserOnServer function is available (from api-client.js)
        if (typeof loginUserOnServer === 'function') {
            const serverResult = await loginUserOnServer(email, hashedPassword);
            
            if (serverResult && serverResult.success && serverResult.user) {
                console.log(`✅ Cross-device login successful for ${email}`);
                // Server login successful - user downloaded to local storage
                sessionStorage.setItem('currentUser', JSON.stringify({
                    email: email,
                    user_type: serverResult.user.user_type,
                    user_data: serverResult.user.user_data
                }));
                return { success: true, message: 'Login successful!' };
            } else {
                // Server login failed
                const errorMsg = serverResult?.message || 'Email not found. Please register first.';
                console.error(`❌ Server login failed for ${email}:`, errorMsg);
                return serverResult || { success: false, message: errorMsg };
            }
        } else {
            // loginUserOnServer not available (api-client.js not loaded)
            if (!users[email]) {
                return { success: false, message: 'Email not found. Please register first.' };
            } else {
                return { success: false, message: 'Incorrect password. Please try again.' };
            }
        }
    } catch (error) {
        console.error('Error in localLoginUser:', error);
        return { success: false, message: 'An error occurred during login. Please try again.' };
    }
}

// Show message
function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// Clear stuck redirect flags on page load (before DOM ready)
(function() {
    try {
        const redirectFlag = sessionStorage.getItem('redirecting');
        const redirectTimestamp = sessionStorage.getItem('redirectTimestamp');
        
        if (redirectFlag === 'true') {
            if (redirectTimestamp) {
                const elapsed = Date.now() - parseInt(redirectTimestamp);
                // Clear if flag is older than 3 seconds (stuck)
                if (elapsed > 3000) {
                    console.log('Clearing stuck redirect flag (older than 3s)');
                    sessionStorage.removeItem('redirecting');
                    sessionStorage.removeItem('redirectTimestamp');
                }
            } else {
                // No timestamp means it's an old flag format, clear it
                console.log('Clearing old redirect flag (no timestamp)');
                sessionStorage.removeItem('redirecting');
            }
        }
    } catch (e) {
        console.error('Error clearing redirect flag on load:', e);
    }
})();

// Tab switching
document.addEventListener('DOMContentLoaded', function() {
    // Additional cleanup on DOM ready
    try {
        const redirectFlag = sessionStorage.getItem('redirecting');
        if (redirectFlag === 'true') {
            // If we're still on index.html and redirect flag exists, might be stuck
            const currentUrl = window.location.href.toLowerCase();
            if (currentUrl.includes('index.html') && !currentUrl.includes('dashboard')) {
                const timestamp = sessionStorage.getItem('redirectTimestamp');
                if (!timestamp || (Date.now() - parseInt(timestamp) > 2000)) {
                    console.log('Clearing potentially stuck redirect flag');
                    sessionStorage.removeItem('redirecting');
                    sessionStorage.removeItem('redirectTimestamp');
                }
            }
        }
    } catch (e) {
        console.error('Error in redirect cleanup:', e);
    }
    
    // Initialize with error handling - wrap everything to prevent blocking
    try {
        initUsersDB();
    } catch (error) {
        console.error('Error during initialization:', error);
        // Don't block if initialization fails
        return;
    }
    
    // Check if elements exist before proceeding
    const tabButtons = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (!loginForm || !signupForm) {
        console.error('Required form elements not found');
        return;
    }
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (tab === 'login') {
                loginForm.classList.add('active');
                signupForm.classList.remove('active');
            } else {
                loginForm.classList.remove('active');
                signupForm.classList.add('active');
            }
        });
    });
    
    // Role selection
    const roleButtons = document.querySelectorAll('.role-btn');
    const patientForm = document.getElementById('patient-signup-form');
    const doctorForm = document.getElementById('doctor-signup-form');
    
    roleButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const role = this.dataset.role;
            
            roleButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (role === 'patient') {
                patientForm.style.display = 'block';
                doctorForm.style.display = 'none';
            } else {
                patientForm.style.display = 'none';
                doctorForm.style.display = 'block';
            }
        });
    });
    
    // File upload handler
    const fileInput = document.getElementById('doctor-proof');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const fileName = this.files[0]?.name || '';
            const fileNameSpan = this.nextElementSibling.querySelector('.file-name');
            if (fileNameSpan) {
                fileNameSpan.textContent = fileName ? `Selected: ${fileName}` : '';
            }
        });
    }
    
    // Login form submission
    const loginFormEl = document.getElementById('loginForm');
    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Mark form as submitting to prevent redirect check interference
            loginFormEl.classList.add('submitting');
            
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                showMessage('login-message', '⚠️ Please enter both email and password.', 'error');
                loginFormEl.classList.remove('submitting');
                return;
            }
            
            const result = await localLoginUser(email, password);
            
            if (result.success) {
                // Notify backend that this user is online (optional - fails gracefully if server unavailable)
                try {
                    if (typeof socket !== 'undefined' && socket && socket.connected) {
                        const users = getUsersDB();
                        const userType = users[email]?.user_type || 'Patient';
                        socket.emit('userOnline', { email, userType });
                    }
                } catch (err) {
                    // Silently fail - not critical for local login
                    console.log('Socket connection unavailable (local mode):', err.message);
                }

                showMessage('login-message', `✅ ${result.message} Redirecting...`, 'success');
                // Clear any redirect flags to prevent interference
                sessionStorage.removeItem('redirecting');
                sessionStorage.removeItem('redirectTimestamp');
                // Redirect immediately
                setTimeout(() => {
                    loginFormEl.classList.remove('submitting');
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                showMessage('login-message', `❌ ${result.message}`, 'error');
                loginFormEl.classList.remove('submitting');
            }
        });
    }
    
    // Patient signup form submission
    const patientSignupForm = document.getElementById('patient-signup-form');
    if (patientSignupForm) {
        patientSignupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Mark form as submitting to prevent redirect check interference
            patientSignupForm.classList.add('submitting');
            
            const email = document.getElementById('patient-email').value.trim();
            const password = document.getElementById('patient-password').value;
            const confirmPassword = document.getElementById('patient-confirm-password').value;
            const name = document.getElementById('patient-name').value.trim();
            const contact = document.getElementById('patient-contact').value.trim();
            const bio = document.getElementById('patient-bio').value.trim();
            
            // Validation
            if (!email || !password || !name || !contact || !bio) {
                showMessage('signup-message', '⚠️ Please fill in all required fields.', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage('signup-message', '⚠️ Passwords do not match. Please try again.', 'error');
                return;
            }
            
            if (password.length < 6) {
                showMessage('signup-message', '⚠️ Password must be at least 6 characters long.', 'error');
                return;
            }
            
            const userData = {
                name: name,
                contact: contact,
                bio_data: bio
            };
            
            // CRITICAL: Hash password ONCE and use the SAME hash for both local and server registration
            const hashedPassword = await hashPassword(password);
            console.log(`🔐 Password hashed - length: ${hashedPassword.length}`);
            
            // First, register locally (for login) - use the hashed password
            const result = await localRegisterUser(email, password, 'Patient', userData);
            
            if (result.success) {
                // CRITICAL: Register on server FIRST before showing success
                // This ensures cross-device login will work
                let serverRegSuccess = false;
                try {
                    console.log(`📝 Registering patient on server: ${email} (passwordHash length: ${hashedPassword.length})`);
                    const serverRegResult = await registerUserOnServer(email, userData, 'Patient', hashedPassword);
                    if (serverRegResult) {
                        console.log(`✅ Patient registered successfully on server: ${email}`);
                        serverRegSuccess = true;
                        
                        // Update local storage with the same password hash used on server
                        const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
                        if (usersDB[email]) {
                            usersDB[email].password = hashedPassword;
                            localStorage.setItem('usersDB', JSON.stringify(usersDB));
                            console.log(`✅ Local password hash synchronized with server`);
                        }
                    } else {
                        console.warn(`⚠️ Server registration returned null for ${email}`);
                    }
                } catch (e) {
                    console.error('❌ Server registration failed:', e);
                    console.warn(`⚠️ Cross-device login may not work for ${email}`);
                    // Still show success but with warning
                    if (e.message && !e.message.includes('SERVER_UNAVAILABLE')) {
                        showMessage('signup-message', `✅ ${result.message} (Note: Server registration failed - cross-device login may not work)`, 'success');
                    }
                }
                
                if (serverRegSuccess || typeof registerUserOnServer !== 'function') {
                    showMessage('signup-message', `✅ ${result.message} Redirecting...`, 'success');
                }
                
                // Auto login after registration (local)
                const loginResult = await localLoginUser(email, password);
                
                if (!loginResult.success) {
                    showMessage('signup-message', `⚠️ Registration successful but auto-login failed. Please login manually.`, 'error');
                    patientSignupForm.classList.remove('submitting');
                    return;
                }

                // Let backend know this user is online (optional - fails gracefully if server unavailable)
                try {
                    if (typeof socket !== 'undefined' && socket && socket.connected) {
                        socket.emit('userOnline', { email, userType: 'Patient' });
                    }
                } catch (err) {
                    // Silently fail - not critical for local login
                    console.log('Socket connection unavailable (local mode):', err.message);
                }

                // Clear any redirect flags to prevent interference
                sessionStorage.removeItem('redirecting');
                sessionStorage.removeItem('redirectTimestamp');
                // Redirect immediately
                setTimeout(() => {
                    patientSignupForm.classList.remove('submitting');
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                showMessage('signup-message', `❌ ${result.message}`, 'error');
                patientSignupForm.classList.remove('submitting');
            }
        });
    }
    
    // Doctor signup form submission
    const doctorSignupForm = document.getElementById('doctor-signup-form');
    if (doctorSignupForm) {
        doctorSignupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Mark form as submitting to prevent redirect check interference
            doctorSignupForm.classList.add('submitting');
            
            const email = document.getElementById('doctor-email').value.trim();
            const password = document.getElementById('doctor-password').value;
            const confirmPassword = document.getElementById('doctor-confirm-password').value;
            const name = document.getElementById('doctor-name').value.trim();
            const contact = document.getElementById('doctor-contact').value.trim();
            const specialization = document.getElementById('doctor-specialization').value.trim();
            const license = document.getElementById('doctor-license').value.trim();
            const experience = parseInt(document.getElementById('doctor-experience').value);
            const bio = document.getElementById('doctor-bio').value.trim();
            const proofFile = document.getElementById('doctor-proof').files[0];
            
            // Validation
            if (!email || !password || !name || !contact || !specialization || !license || !bio) {
                showMessage('signup-message', '⚠️ Please fill in all required fields.', 'error');
                return;
            }
            
            if (!proofFile) {
                showMessage('signup-message', '⚠️ Please upload your proof of education.', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage('signup-message', '⚠️ Passwords do not match. Please try again.', 'error');
                return;
            }
            
            if (password.length < 6) {
                showMessage('signup-message', '⚠️ Password must be at least 6 characters long.', 'error');
                return;
            }
            
            const userData = {
                name: name,
                contact: contact,
                specialization: specialization,
                license_number: license,
                experience: experience,
                bio: bio,
                proof_of_education_filename: proofFile.name
            };
            
            // CRITICAL: Hash password ONCE and use the SAME hash for both local and server registration
            const hashedPassword = await hashPassword(password);
            console.log(`🔐 Password hashed - length: ${hashedPassword.length}`);
            
            // First, register locally (for login) - use the hashed password
            const result = await localRegisterUser(email, password, 'Doctor', userData);
            
            if (result.success) {
                // CRITICAL: Register on server FIRST before showing success
                // This ensures cross-device login will work
                let serverRegSuccess = false;
                try {
                    console.log(`📝 Registering doctor on server: ${email} (passwordHash length: ${hashedPassword.length})`);
                    const serverRegResult = await registerUserOnServer(email, userData, 'Doctor', hashedPassword);
                    if (serverRegResult) {
                        console.log(`✅ Doctor registered successfully on server: ${email}`);
                        serverRegSuccess = true;
                        
                        // Update local storage with the same password hash used on server
                        const usersDB = JSON.parse(localStorage.getItem('usersDB') || '{}');
                        if (usersDB[email]) {
                            usersDB[email].password = hashedPassword;
                            localStorage.setItem('usersDB', JSON.stringify(usersDB));
                            console.log(`✅ Local password hash synchronized with server`);
                        }
                    } else {
                        console.warn(`⚠️ Server registration returned null for ${email}`);
                    }
                } catch (e) {
                    console.error('❌ Server registration failed:', e);
                    console.warn(`⚠️ Cross-device login may not work for ${email}`);
                    // Still show success but with warning
                    if (e.message && !e.message.includes('SERVER_UNAVAILABLE')) {
                        showMessage('signup-message', `✅ ${result.message} (Note: Server registration failed - cross-device login may not work)`, 'success');
                    }
                }
                
                if (serverRegSuccess || typeof registerUserOnServer !== 'function') {
                    showMessage('signup-message', `✅ ${result.message} Redirecting...`, 'success');
                }
                
                // Auto login after registration (local)
                const loginResult = await localLoginUser(email, password);
                
                if (!loginResult.success) {
                    showMessage('signup-message', `⚠️ Registration successful but auto-login failed. Please login manually.`, 'error');
                    doctorSignupForm.classList.remove('submitting');
                    return;
                }

                // Let backend know this user is online (optional - fails gracefully if server unavailable)
                try {
                    if (typeof socket !== 'undefined' && socket && socket.connected) {
                        socket.emit('userOnline', { email, userType: 'Doctor' });
                    }
                } catch (err) {
                    // Silently fail - not critical for local login
                    console.log('Socket connection unavailable (local mode):', err.message);
                }

                // Clear any redirect flags to prevent interference
                sessionStorage.removeItem('redirecting');
                sessionStorage.removeItem('redirectTimestamp');
                // Redirect immediately
                setTimeout(() => {
                    doctorSignupForm.classList.remove('submitting');
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                showMessage('signup-message', `❌ ${result.message}`, 'error');
                doctorSignupForm.classList.remove('submitting');
            }
        });
    }
    
    // Check if user is already logged in - moved to end to prevent blocking
    // Wrapped in try-catch and delayed to prevent unresponsiveness
    // Also add timeout to prevent infinite loops
    let redirectCheckAttempts = 0;
    const maxRedirectAttempts = 1;
    
    setTimeout(() => {
        try {
            // Only check if we're on index.html and user is logged in
            // Don't interfere with active login/signup flows
            const currentUrl = window.location.href.toLowerCase();
            const currentFile = window.location.pathname.split('/').pop().toLowerCase() || '';
            const isOnIndex = currentUrl.includes('index.html') || 
                             currentFile === '' || 
                             currentFile === 'index.html';
            const isOnDashboard = currentUrl.includes('dashboard.html');
            
            // Only run redirect check if we're on index page and not already redirecting
            if (!isOnIndex || isOnDashboard) {
                return;
            }
            
            // Check if there's an active form submission (don't interfere)
            const loginForm = document.getElementById('loginForm');
            const signupForm = document.getElementById('patient-signup-form') || document.getElementById('doctor-signup-form');
            if (loginForm && loginForm.classList.contains('submitting')) {
                return; // Don't interfere with active login
            }
            if (signupForm && signupForm.classList.contains('submitting')) {
                return; // Don't interfere with active signup
            }
            
            const redirectFlag = sessionStorage.getItem('redirecting');
            if (redirectFlag === 'true') {
                // Already redirecting, don't interfere
                return;
            }
            
            const currentUser = sessionStorage.getItem('currentUser');
            if (currentUser) {
                // User is logged in, redirect to dashboard
                redirectCheckAttempts++;
                console.log('User already logged in, redirecting to dashboard...');
                sessionStorage.setItem('redirecting', 'true');
                sessionStorage.setItem('redirectTimestamp', Date.now().toString());
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 100);
            } else {
                // Clear redirect flags if no user is logged in
                sessionStorage.removeItem('redirecting');
                sessionStorage.removeItem('redirectTimestamp');
            }
        } catch (error) {
            console.error('Error in redirect check:', error);
            // Always clear flags on error to prevent stuck states
            sessionStorage.removeItem('redirecting');
            sessionStorage.removeItem('redirectTimestamp');
        }
    }, 1500); // Longer delay to ensure login/signup completes first
    
    // Safety timeout - clear redirect flag after 5 seconds if page is still here
    setTimeout(() => {
        try {
            if (sessionStorage.getItem('redirecting') === 'true') {
                const timestamp = parseInt(sessionStorage.getItem('redirectTimestamp') || '0');
                const elapsed = Date.now() - timestamp;
                
                // If redirect flag is older than 3 seconds, clear it
                if (elapsed > 3000) {
                    console.warn('Clearing stuck redirect flag (timeout)');
                    sessionStorage.removeItem('redirecting');
                    sessionStorage.removeItem('redirectTimestamp');
                }
            }
        } catch (e) {
            console.error('Error in safety timeout:', e);
        }
    }, 5000);
});

