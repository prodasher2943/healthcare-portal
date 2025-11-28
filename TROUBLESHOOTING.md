# Troubleshooting Consultation Requests

## Issue: Doctor Not Seeing Consultation Requests

### The Problem
If a patient sends a consultation request but the doctor doesn't see it, this is likely because **localStorage is browser/tab-specific**.

### Why This Happens
- localStorage is isolated per browser/tab
- Different browsers = different localStorage
- Incognito mode = separate localStorage
- Different tabs in normal mode = same localStorage ✅

### Solution

#### Option 1: Use Same Browser (Recommended for Testing)
1. **Patient**: Open dashboard in normal browser window
2. **Doctor**: Open dashboard in a **different tab** of the same browser
3. Both must be in normal mode (not incognito)

#### Option 2: Check Console Logs
1. Open browser console (F12)
2. Check for logs when patient sends request:
   - Should see: "=== CONSULTATION REQUEST ==="
   - Should see doctor email and request details
3. Check doctor's console:
   - Should see: "Loading consultation requests for doctor: [email]"
   - Should see all consultations

#### Option 3: Verify Email Match
1. Patient sends request to: `doctor@example.com`
2. Doctor logs in with: `doctor@example.com` (must match exactly)
3. Check console to verify emails match

### Testing Steps

1. **Patient Side:**
   - Login as patient
   - Request consultation
   - Check console (F12) for request details
   - Note the doctor email you're sending to

2. **Doctor Side:**
   - Login as doctor with the SAME EMAIL that was requested
   - Open console (F12)
   - Should see "Loading consultation requests for doctor: [email]"
   - Should see all consultations in storage

3. **Verify Storage:**
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Check localStorage → key: "consultations"
   - Should see the pending request

### Expected Console Output

**When Patient Sends Request:**
```
=== CONSULTATION REQUEST ===
Sending consultation request: {doctorEmail: "doctor@example.com", ...}
Doctor email (target): doctor@example.com
✅ Consultation saved to localStorage
Total consultations: 1
All consultations: [...]
=== END REQUEST ===
```

**When Doctor Checks Requests:**
```
Loading consultation requests for doctor: doctor@example.com
All consultations: [...]
Pending requests for this doctor: [...]
```

### If Still Not Working

1. Clear localStorage:
   - Open clear-cache.html
   - Click "Full Cleanup"

2. Restart both patient and doctor:
   - Logout both
   - Login again
   - Try request again

3. Check email exact match:
   - Patient requested: doctor@example.com
   - Doctor logged in as: doctor@example.com
   - Must be exactly the same (case-sensitive)

### Future Solution
For production, this would require a backend server/database to share consultation requests across different browsers.

