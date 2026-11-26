export interface FocusTarget {
  focus(options?: {preventScroll?: boolean}): void;
}

let active: FocusTarget | null = null;

export function setMainContent(target: FocusTarget | null): void {
  active = target;
}

export function focusMainContent(): boolean {
  if (active === null) return false;
  active.focus({preventScroll: false});
  return true;
}
