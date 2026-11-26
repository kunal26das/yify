const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const RGBA = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

function clampAlpha(alpha: number): number {
  return Math.min(1, Math.max(0, alpha));
}

export function withAlpha(color: string, alpha: number): string {
  const hex = HEX.exec(color);
  if (hex) {
    const value = Number.parseInt(hex[1], 16);
    const base = hex[2] === undefined ? 1 : Number.parseInt(hex[2], 16) / 255;
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${Number((base * clampAlpha(alpha)).toFixed(3))})`;
  }
  const rgba = RGBA.exec(color);
  if (rgba) {
    const base = rgba[4] === undefined ? 1 : Number(rgba[4]);
    return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${Number((base * clampAlpha(alpha)).toFixed(3))})`;
  }
  return color;
}
