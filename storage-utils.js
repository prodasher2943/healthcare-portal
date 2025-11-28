// Storage utility functions to handle currentUser in sessionStorage
// This allows each tab to have its own logged-in user

// Get current user (tab-specific)
function getCurrentUser() {
    try {
        const userStr = sessionStorage.getItem('currentUser');
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error('Error getting current user:', e);
        return null;
    }
}

// Set current user (tab-specific)
function setCurrentUser(userData) {
    try {
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        return true;
    } catch (e) {
        console.error('Error setting current user:', e);
        return false;
    }
}

// Clear current user (tab-specific)
function clearCurrentUser() {
    try {
        sessionStorage.removeItem('currentUser');
        return true;
    } catch (e) {
        console.error('Error clearing current user:', e);
        return false;
    }
}

// Get consultations (shared across tabs)
function getConsultations() {
    try {
        return JSON.parse(localStorage.getItem('consultations') || '[]');
    } catch (e) {
        console.error('Error getting consultations:', e);
        return [];
    }
}

// Save consultations (shared across tabs)
function saveConsultations(consultations) {
    try {
        localStorage.setItem('consultations', JSON.stringify(consultations));
        return true;
    } catch (e) {
        console.error('Error saving consultations:', e);
        return false;
    }
}

