import type {ScreenName} from '@/core/platform/telemetry/events';

function isGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

export function screenNameForSegments(segments: readonly string[]): ScreenName | null {
  const path = segments.filter((segment) => !isGroup(segment) && segment !== 'index');
  const [first, second] = path;
  if (first === undefined) return segments.includes('(home)') ? 'home' : null;
  if (first === 'title') {
    if (second === 'movie') return 'title_movie';
    if (second === 'tv') return 'title_tv';
    return null;
  }
  if (first === 'person') return 'person';
  if (first === 'library' || first === 'list') return 'library';
  if (first === 'search' || first === 'you' || first === 'plus' || first === 'settings') return first;
  return null;
}
