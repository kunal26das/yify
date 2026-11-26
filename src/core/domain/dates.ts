const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_DATE = '1900-01-01';

export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value) || value < EARLIEST_DATE) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function localToday(now: number = Date.now()): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isWatchDate(value: unknown, now: number = Date.now()): value is string {
  return isLocalDate(value) && value <= localToday(now);
}
