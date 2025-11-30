// Medication Schedule Functions
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
        // Look for common medicine patterns
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
    
    return times.length > 0 ? times : ['morning']; // Default to morning
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
    return 'morning'; // Default
}

// Helper: Infer time from text
function inferTime(text) {
    // Try to extract time pattern HH:MM
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
        startDate: new Date().toISOString().split('T')[0] // Today's date
    };
    
    // Save to localStorage
    const schedules = JSON.parse(localStorage.getItem('medicationSchedules') || '[]');
    // Remove existing schedule for this consultation if any
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
