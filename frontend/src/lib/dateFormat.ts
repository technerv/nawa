/**
 * Safely formats a date string or Date object to a localized string.
 * Returns a fallback string if the date is invalid or missing.
 */
export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '-'
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date
        
        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            return '-'
        }
        
        return dateObj.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
    } catch (error) {
        return '-'
    }
}

/**
 * Formats a date to a short date string (without time)
 */
export function formatDateShort(date: string | Date | null | undefined): string {
    if (!date) return '-'
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date
        
        if (isNaN(dateObj.getTime())) {
            return '-'
        }
        
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    } catch (error) {
        return '-'
    }
}

/**
 * Formats a date to include time only
 */
export function formatTime(date: string | Date | null | undefined): string {
    if (!date) return '-'
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date
        
        if (isNaN(dateObj.getTime())) {
            return '-'
        }
        
        return dateObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
    } catch (error) {
        return '-'
    }
}

