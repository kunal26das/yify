export const POSTER_MIN_WIDTH = 140;
export const POSTER_ASPECT_RATIO = 2 / 3; // width : height
export const POSTER_GAP = 8;

export function getPosterContainerStyle() {
  return {
    flexBasis: POSTER_MIN_WIDTH,
    flexGrow: 1,
    aspectRatio: POSTER_ASPECT_RATIO,
    margin: POSTER_GAP / 2,
  } as const;
}

