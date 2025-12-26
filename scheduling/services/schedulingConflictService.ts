
import { Appointment } from '../../types';
import { timeOverlap } from '../utils/timeOverlap';

export interface ConflictInfo {
    date: string;
    technicians: string[]; // Names of technicians with conflicts
    count: number;
}

export const schedulingConflictService = {
    /**
     * Detects scheduling conflicts across all appointments.
     * Conflict Rule: Same Technician, Same Date, Overlapping Time.
     * Ignores 'Cancelado' status.
     */
    detectConflicts: (appointments: Appointment[]): Record<string, ConflictInfo> => {
        const conflicts: Record<string, ConflictInfo> = {};
        const byDate: Record<string, Appointment[]> = {};

        // 1. Group by Date & Filter valid appointments
        appointments.forEach(appt => {
            if (appt.status === 'Cancelado') return;
            if (!appt.date || !appt.time) return;
            
            // Normalize date string (YYYY-MM-DD)
            let d = appt.date;
            // Ensure format if Date object passed accidentally
            if (typeof d !== 'string') {
                try { d = new Date(d).toISOString().split('T')[0]; } catch(e) { return; }
            }
            
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(appt);
        });

        // 2. Check overlap per day per technician
        Object.entries(byDate).forEach(([date, dayAppts]) => {
            const byTech: Record<string, Appointment[]> = {};
            
            // Group by Technician within the day
            dayAppts.forEach(a => {
                // Ensure we have a valid technician identifier
                const tech = a.technician ? a.technician.trim() : null;
                if (!tech) return; 
                
                if (!byTech[tech]) byTech[tech] = [];
                byTech[tech].push(a);
            });

            const conflictingTechs = new Set<string>();

            // For each technician, check overlaps
            Object.entries(byTech).forEach(([tech, techAppts]) => {
                if (techAppts.length < 2) return; // No conflict possible with 1 appt

                // Sort by start time to optimize checks
                techAppts.sort((a, b) => a.time.localeCompare(b.time));

                // Pairwise check
                for (let i = 0; i < techAppts.length; i++) {
                    for (let j = i + 1; j < techAppts.length; j++) {
                        const a1 = techAppts[i];
                        const a2 = techAppts[j];

                        const start1 = timeOverlap.toMinutes(a1.time);
                        const end1 = start1 + (a1.duration * 60);
                        
                        const start2 = timeOverlap.toMinutes(a2.time);
                        // Default duration to 1h if missing or 0 to avoid zero-length interval issues
                        const duration2 = a2.duration || 1; 
                        const end2 = start2 + (duration2 * 60);

                        if (timeOverlap.hasOverlap(start1, end1, start2, end2)) {
                            conflictingTechs.add(tech);
                            // Optimization: Once a tech is flagged for this day, no need to check their other pairs
                            break; 
                        }
                    }
                    if (conflictingTechs.has(tech)) break;
                }
            });

            if (conflictingTechs.size > 0) {
                conflicts[date] = {
                    date,
                    technicians: Array.from(conflictingTechs),
                    count: conflictingTechs.size
                };
            }
        });

        return conflicts;
    }
};
