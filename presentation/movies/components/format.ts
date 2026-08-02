import type {Movie} from '@/domain';

export function thumbCandidates(movie: Movie): string[] {
    const posters = movie.posterUrls ?? [];
    return [
        ...(movie.thumbnailUrls ?? []),
        movie.backgroundImageUrl,
        posters[posters.length - 1],
    ].filter((url): url is string => !!url);
}

export function thumbFor(movie: Movie): string | undefined {
    return thumbCandidates(movie)[0];
}

export function thumbPlaceholder(movie: Movie): string | undefined {
    if (movie.ytTrailerCode) {
        return `https://img.youtube.com/vi/${movie.ytTrailerCode}/mqdefault.jpg`;
    }
    return (movie.posterUrls ?? [])[0];
}

export function formatRuntime(minutes: number): string | null {
    if (!minutes || minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours === 0) return `${remainder}m`;
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

export function metaParts(movie: Movie): string[] {
    return [
        movie.year ? String(movie.year) : null,
        formatRuntime(movie.runtimeMinutes),
        movie.mpaRating || null,
    ].filter((part): part is string => !!part);
}

export function ytThumb(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
