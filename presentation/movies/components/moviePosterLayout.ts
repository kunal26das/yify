export const POSTER_MIN_WIDTH = 150;
export const POSTER_ASPECT_RATIO = 2 / 3; // width : height
export const POSTER_GAP = 12;

/**
 * Layout for a single grid cell.
 *
 * When `width` is provided the cell is fixed-size so a partial final row stays
 * left-aligned at the normal card size instead of stretching to fill the row.
 * Without a width it falls back to a flexible cell (used before the column math
 * is known).
 */
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

