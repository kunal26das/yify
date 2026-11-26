export function formatRuntime(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const remainder = whole % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatRating(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function yearSpan(first: number | null, last: number | null): string | null {
  if (first === null) return null;
  if (last === null || last === first) return String(first);
  return `${first}–${last}`;
}
