export interface MovieNotificationTarget {
    movieId?: number;
    count?: number;
    kind: 'daily-pick' | 'new-release';
}

export function movieNotificationTarget(data: unknown): MovieNotificationTarget | null {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) return null;
    const value = data as Record<string, unknown>;
    const kind = value.kind === 'daily-pick' ? 'daily-pick' : 'new-release';
    if (typeof value.movieId === 'number' && Number.isSafeInteger(value.movieId) && value.movieId > 0 && value.movieId <= 2_147_483_647) {
        return {movieId: value.movieId, kind};
    }
    if (kind === 'new-release' && typeof value.count === 'number' && Number.isSafeInteger(value.count) && value.count > 0) {
        return {count: value.count, kind};
    }
    return null;
}
