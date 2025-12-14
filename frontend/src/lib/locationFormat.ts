/**
 * Formats location information for display.
 * Returns a user-friendly location string.
 */
export function formatLocation(
    locationName: string | null | undefined,
    county: string | null | undefined,
    subCounty?: string | null | undefined,
    latitude?: number | null,
    longitude?: number | null
): string {
    // If location_name exists and doesn't start with "Map ", use it
    if (locationName && !locationName.trim().startsWith('Map ')) {
        return locationName.trim()
    }
    
    // If location_name starts with "Map ", try to extract coordinates
    // and use county/subCounty instead
    if (locationName && locationName.trim().startsWith('Map ')) {
        // Extract coordinates from "Map lat, lng" format
        const match = locationName.match(/Map\s+(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/)
        if (match) {
            // Use the extracted coordinates if latitude/longitude not provided
            const extractedLat = latitude ?? parseFloat(match[1])
            const extractedLng = longitude ?? parseFloat(match[2])
            
            // Build location from available parts
            const parts: string[] = []
            
            if (subCounty) {
                parts.push(subCounty)
            }
            
            if (county) {
                parts.push(county)
            }
            
            // If we have parts, join them
            if (parts.length > 0) {
                return parts.join(', ')
            }
            
            // Fallback to formatted coordinates
            if (!isNaN(extractedLat) && !isNaN(extractedLng)) {
                return `${extractedLat.toFixed(6)}, ${extractedLng.toFixed(6)}`
            }
        }
    }
    
    // Build location from available parts
    const parts: string[] = []
    
    if (subCounty) {
        parts.push(subCounty)
    }
    
    if (county) {
        parts.push(county)
    }
    
    // If we have parts, join them
    if (parts.length > 0) {
        return parts.join(', ')
    }
    
    // If we have coordinates, format them nicely
    if (latitude != null && longitude != null) {
        return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    }
    
    // Fallback
    return 'Location not specified'
}

/**
 * Formats location for SOS payload - ensures we don't use "Map" prefix
 */
export function formatLocationForSOS(
    locationName: string | null | undefined,
    county: string | null | undefined,
    latitude?: number | null,
    longitude?: number | null
): string {
    // If location_name exists and doesn't start with "Map ", use it
    if (locationName && !locationName.trim().startsWith('Map ')) {
        return locationName.trim()
    }
    
    // Build from county if available
    if (county) {
        return county
    }
    
    // Use coordinates as last resort
    if (latitude != null && longitude != null) {
        return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    }
    
    return 'Location not specified'
}

/**
 * Checks if a location name is just coordinates with "Map" prefix
 */
export function isMapCoordinates(locationName: string | null | undefined): boolean {
    if (!locationName) return false
    return locationName.trim().startsWith('Map ') && /Map -?\d+\.\d+, -?\d+\.\d+/.test(locationName)
}

