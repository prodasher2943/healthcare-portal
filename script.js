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
    const users = getUsersDB();
    
    if (users[email]) {
        return { success: false, message: 'Email already registered. Please login instead.' };
    }
    
    const hashedPassword = await hashPassword(password);
    users[email] = {
        password: hashedPassword,
        user_type: userType,
        user_data: userData,
        registered_date: new Date().toISOString()
    };
    
    saveUsersDB(users);
    return { success: true, message: 'Registration successful!' };
}

// Login user (local storage)
async function localLoginUser(email, password) {
    const users = getUsersDB();
    
    if (!users[email]) {
        return { success: false, message: 'Email not found. Please register first.' };
    }
    
    const hashedPassword = await hashPassword(password);
    if (users[email].password !== hashedPassword) {
        return { success: false, message: 'Incorrect password. Please try again.' };
    }
    
    // Store current user in sessionStorage (tab-specific, so each tab can have different user)
    sessionStorage.setItem('currentUser', JSON.stringify({
        email: email,
        user_type: users[email].user_type,
        user_data: users[email].user_data
    }));
    
    return { success: true, message: 'Login successful!' };
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
            
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                showMessage('login-message', '⚠️ Please enter both email and password.', 'error');
                return;
            }
            
            const result = await localLoginUser(email, password);
            
            if (result.success) {
                showMessage('login-message', `✅ ${result.message} Redirecting...`, 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showMessage('login-message', `❌ ${result.message}`, 'error');
            }
        });
    }
    
    // Patient signup form submission
    const patientSignupForm = document.getElementById('patient-signup-form');
    if (patientSignupForm) {
        patientSignupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
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
            
            // First, register locally (for login)
            const result = await localRegisterUser(email, password, 'Patient', userData);
            
            if (result.success) {
                showMessage('signup-message', `✅ ${result.message} Redirecting...`, 'success');
                // Also register on server for global availability (no password)
                try {
                    await registerUserOnServer(email, userData, 'Patient');
                } catch (e) {
                    console.error('Error registering patient on server (fallback to local only):', e);
                }
                
                // Auto login after registration (local)
                await localLoginUser(email, password);
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showMessage('signup-message', `❌ ${result.message}`, 'error');
            }
        });
    }
    
    // Doctor signup form submission
    const doctorSignupForm = document.getElementById('doctor-signup-form');
    if (doctorSignupForm) {
        doctorSignupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
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
            
            // First, register locally (for login)
            const result = await localRegisterUser(email, password, 'Doctor', userData);
            
            if (result.success) {
                showMessage('signup-message', `✅ ${result.message} Redirecting...`, 'success');
                // Also register on server for global availability (no password)
                try {
                    await registerUserOnServer(email, userData, 'Doctor');
                } catch (e) {
                    console.error('Error registering doctor on server (fallback to local only):', e);
                }
                
                // Auto login after registration (local)
                await localLoginUser(email, password);
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showMessage('signup-message', `❌ ${result.message}`, 'error');
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
            // Clear redirect flag if it's been stuck (safety measure)
            const redirectFlag = sessionStorage.getItem('redirecting');
            if (redirectFlag === 'true' && redirectCheckAttempts === 0) {
                console.warn('Found stuck redirect flag, clearing it');
                sessionStorage.removeItem('redirecting');
                return; // Don't redirect if flag was stuck
            }
            
            // Only check if not already redirecting and haven't exceeded attempts
            if (redirectFlag === 'true' || redirectCheckAttempts >= maxRedirectAttempts) {
                console.log('Skipping redirect check - already redirecting or max attempts reached');
                return;
            }
            
            const currentUser = sessionStorage.getItem('currentUser');
            if (currentUser) {
                const currentUrl = window.location.href.toLowerCase();
                const currentFile = window.location.pathname.split('/').pop().toLowerCase() || '';
                
                // Only redirect if on index.html, not on dashboard, and URL confirms we're on index
                const isOnIndex = currentUrl.includes('index.html') || 
                                 currentFile === '' || 
                                 currentFile === 'index.html';
                const isOnDashboard = currentUrl.includes('dashboard.html');
                
                if (isOnIndex && !isOnDashboard) {
                    redirectCheckAttempts++;
                    console.log('Redirecting to dashboard...');
                    // Prevent redirect loops - set flag with timestamp
                    sessionStorage.setItem('redirecting', 'true');
                    sessionStorage.setItem('redirectTimestamp', Date.now().toString());
                    
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 100);
                }
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
    }, 1000); // Longer delay to ensure everything is loaded
    
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

