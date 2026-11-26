const heights = new Map<string, number>();

export function setOverlayHeight(source: string, height: number | null): void {
  if (height === null || height <= 0) heights.delete(source);
  else heights.set(source, Math.ceil(height));
  const total = Math.max(0, ...heights.values());
  const style = document.documentElement.style;
  if (total === 0) style.removeProperty('--overlay-height');
  else style.setProperty('--overlay-height', `${total}px`);
}
