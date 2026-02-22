/**
 * Build Google Maps URLs for directions and day route.
 * Used by PlanCard (full-day route) and EventTile (single leg).
 */

function encodeAddress(addr: string): string {
    return encodeURIComponent(addr.trim());
}

/** Single leg: origin → destination. Opens Google Maps directions. */
export function buildDirectionsUrl(origin: string, destination: string): string {
    if (!destination?.trim()) return '';
    const o = origin?.trim() ? encodeAddress(origin) : '';
    const d = encodeAddress(destination);
    if (o) return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`;
    return `https://www.google.com/maps/dir/?api=1&destination=${d}&travelmode=driving`;
}

/** Full-day route: waypoints in order (optionally with first leg from home). */
export function buildDayRouteUrl(locations: string[], homeAddress?: string): string {
    const waypoints = [...locations].filter((a) => a?.trim());
    if (waypoints.length === 0) return '';
    const origin = homeAddress?.trim() || waypoints[0];
    const dest = waypoints[waypoints.length - 1];
    const mid = waypoints.length > 2 ? waypoints.slice(1, -1) : [];
    const params = new URLSearchParams({
        api: '1',
        origin: origin,
        destination: dest,
        travelmode: 'driving',
    });
    if (mid.length > 0) params.set('waypoints', mid.join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
}
