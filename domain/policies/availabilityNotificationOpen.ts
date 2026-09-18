/** Validate notification attribution independently of the URL used to navigate. */
export function availabilityNotificationOpen(pathname: string, kind: unknown, event: unknown):
    {eventId: string; movieId?: number} | null {
    if (kind !== 'availability' || typeof event !== 'string' || !/^[A-Za-z\d_:.-]{1,128}$/.test(event)) return null;
    if (pathname === '/watchlist') return {eventId: event};
    const match = /^\/movie\/([1-9]\d{0,9})$/.exec(pathname);
    const movieId = match ? Number(match[1]) : 0;
    return movieId > 0 && movieId <= 2_147_483_647 ? {eventId: event, movieId} : null;
}
