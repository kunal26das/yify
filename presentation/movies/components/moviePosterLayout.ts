import {PixelRatio} from 'react-native';
import {POSTER_WIDTHS} from '@/domain';

export const POSTER_MIN_WIDTH = 152;
export const POSTER_ASPECT_RATIO = 2 / 3;
export const POSTER_GAP = 16;

export function getPosterContainerStyle(width?: number, height?: number) {
    if (width != null) {
        return {
            width,
            height: height ?? width / POSTER_ASPECT_RATIO,
            margin: POSTER_GAP / 2,
        } as const;
    }
  return {
    flexBasis: POSTER_MIN_WIDTH,
    flexGrow: 1,
    aspectRatio: POSTER_ASPECT_RATIO,
    margin: POSTER_GAP / 2,
  } as const;
}


export function posterRung(posterUrls: string[], width?: number): number {
    const last = posterUrls.length - 1;
    if (last <= 0) return Math.max(0, last);
    const drawn = (width ?? POSTER_MIN_WIDTH) * PixelRatio.get();
    const wanted = POSTER_WIDTHS.findIndex((rung) => rung >= drawn);
    return Math.min(wanted === -1 ? last : wanted, last);
}
