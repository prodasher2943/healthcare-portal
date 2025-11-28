# Multi-Tab Login Fix

## Problem
localStorage is **shared across all tabs** in the same browser. This meant:
- If you login as a doctor in Tab 1, it overwrites the currentUser for ALL tabs
- If you login as a patient in Tab 2, it overwrites for ALL tabs
- Both tabs end up showing the same user (last one to login)

## Solution
Changed to use **sessionStorage** for `currentUser`:
- ✅ **sessionStorage** = isolated per tab (each tab has its own login)
- ✅ **localStorage** = shared across tabs (for consultations and users database)

## How It Works Now

### Current User (sessionStorage - Tab-Specific)
- Each tab has its own logged-in user
- Tab 1: Can login as Patient
- Tab 2: Can login as Doctor  
- They don't interfere with each other!

### Consultations (localStorage - Shared)
- Consultation requests are stored in localStorage
- This means:
  - Patient in Tab 1 sends request → saved in localStorage
  - Doctor in Tab 2 can see the request (reads from same localStorage)
  - Works perfectly for cross-tab communication!

### Users Database (localStorage - Shared)
- All user accounts are in localStorage
- Both tabs can access the same user database

## Testing
1. Open Tab 1 → Login as Patient
2. Open Tab 2 → Login as Doctor
3. Patient sends consultation request in Tab 1
4. Doctor sees request appear in Tab 2 automatically!

## Technical Details
- Changed all `localStorage.getItem('currentUser')` → `sessionStorage.getItem('currentUser')`
- Changed all `localStorage.setItem('currentUser', ...)` → `sessionStorage.setItem('currentUser', ...)`
- Consultations remain in localStorage for cross-tab sharing

