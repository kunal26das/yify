export const POSTER_MIN_WIDTH = 150;
export const POSTER_ASPECT_RATIO = 2 / 3;
export const POSTER_GAP = 12;

export function getPosterContainerStyle(width?: number) {
    if (width != null) {
        return {
            width,
            height: width / POSTER_ASPECT_RATIO,
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

