import type {ImageHostMode} from './imageHost';
import {getImageHostMode} from './imageHost';
import {IMAGE_PROXY_ORIGIN} from './media/imageOrigin';

export type ImageSize = 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'h632';

export const TMDB_IMAGE_ORIGIN = 'https://image.tmdb.org';

const RASTER_PATH = /^\/[A-Za-z0-9_-]{6,80}\.(?:jpg|jpeg|png)$/;
const SVG_PATH = /^\/[A-Za-z0-9_-]{6,80}\.svg$/;

export function imageUrl(path: string | null, size: ImageSize, mode: ImageHostMode = getImageHostMode()): string | null {
  if (path === null) return null;
  if (SVG_PATH.test(path)) return `${TMDB_IMAGE_ORIGIN}/t/p/original${path}`;
  if (!RASTER_PATH.test(path)) return null;
  if (mode === 'proxy') return `${IMAGE_PROXY_ORIGIN}/api/v2/img/${size}${path}`;
  return `${TMDB_IMAGE_ORIGIN}/t/p/${size}${path}`;
}
