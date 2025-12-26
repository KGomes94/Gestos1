
export const timeOverlap = {
    /**
     * Converts "HH:MM" to minutes from start of day
     */
    toMinutes: (time: string): number => {
        if (!time) return 0;
        const parts = time.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
    },

    /**
     * Checks if two intervals overlap
     * Interval A: [startA, endA]
     * Interval B: [startB, endB]
     * (Strict inequality means touching is not overlapping, assuming end time is exclusive or minimal gap required)
     * Using StartA < EndB && EndA > StartB standard logic
     */
    hasOverlap: (startA: number, endA: number, startB: number, endB: number): boolean => {
        return Math.max(startA, startB) < Math.min(endA, endB);
    }
};
