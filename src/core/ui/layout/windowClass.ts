export type WindowClass = 'compact' | 'medium' | 'expanded';

export const BREAKPOINTS = {medium: 600, expanded: 840, large: 1200, extraLarge: 1600} as const;

export function windowClassFor(width: number): WindowClass {
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}
