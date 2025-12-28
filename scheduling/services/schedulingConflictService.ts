
import { Appointment } from '../../types';
import { timeOverlap } from '../utils/timeOverlap';

export interface ConflictInfo {
    date: string;
    technicians: string[]; // Names of technicians with conflicts
    count: number;
}

export const schedulingConflictService = {
    /**
     * Detecta conflitos de agendamento em toda a base de dados.
     * Regra de Conflito: Mesmo Técnico, Mesmo Dia, Intervalos de Tempo Sobrepostos.
     * Ignora agendamentos com estado 'Cancelado'.
     * 
     * @returns Um objeto mapeado por data (YYYY-MM-DD) contendo detalhes do conflito.
     */
    detectConflicts: (appointments: Appointment[]): Record<string, ConflictInfo> => {
        const conflicts: Record<string, ConflictInfo> = {};
        const byDate: Record<string, Appointment[]> = {};

        // 1. Agrupar por Data & Filtrar agendamentos válidos
        appointments.forEach(appt => {
            if (appt.status === 'Cancelado') return;
            if (!appt.date || !appt.time) return;
            
            // Normalizar string de data (YYYY-MM-DD)
            let d = appt.date;
            // Garantir formato caso objeto Date seja passado acidentalmente
            if (typeof d !== 'string') {
                try { d = new Date(d).toISOString().split('T')[0]; } catch(e) { return; }
            }
            
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(appt);
        });

        // 2. Verificar sobreposição por dia por técnico
        Object.entries(byDate).forEach(([date, dayAppts]) => {
            const byTech: Record<string, Appointment[]> = {};
            
            // Agrupar por Técnico dentro do dia
            dayAppts.forEach(a => {
                const tech = a.technician ? a.technician.trim() : null;
                if (!tech) return; 
                
                if (!byTech[tech]) byTech[tech] = [];
                byTech[tech].push(a);
            });

            const conflictingTechs = new Set<string>();

            // Para cada técnico, verificar sobreposições par-a-par
            Object.entries(byTech).forEach(([tech, techAppts]) => {
                if (techAppts.length < 2) return; // Sem conflito possível com apenas 1 agendamento

                // Ordenar por hora de início para otimizar verificações
                techAppts.sort((a, b) => a.time.localeCompare(b.time));

                for (let i = 0; i < techAppts.length; i++) {
                    for (let j = i + 1; j < techAppts.length; j++) {
                        const a1 = techAppts[i];
                        const a2 = techAppts[j];

                        const start1 = timeOverlap.toMinutes(a1.time);
                        const end1 = start1 + (a1.duration * 60);
                        
                        const start2 = timeOverlap.toMinutes(a2.time);
                        // Default duration to 1h if missing or 0
                        const duration2 = a2.duration || 1; 
                        const end2 = start2 + (duration2 * 60);

                        if (timeOverlap.hasOverlap(start1, end1, start2, end2)) {
                            conflictingTechs.add(tech);
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
