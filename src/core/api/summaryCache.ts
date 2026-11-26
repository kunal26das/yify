import type {TitleKey} from '@/core/domain/keys';
import type {TitleSummary} from '@/core/domain/title';

export const SUMMARY_CACHE_SIZE = 500;

const entries = new Map<TitleKey, TitleSummary>();

export function rememberSummary(summary: TitleSummary): void {
  entries.delete(summary.key);
  entries.set(summary.key, summary);
  while (entries.size > SUMMARY_CACHE_SIZE) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export function getSummary(key: TitleKey): TitleSummary | null {
  const summary = entries.get(key);
  if (summary === undefined) return null;
  entries.delete(key);
  entries.set(key, summary);
  return summary;
}

export function clearSummaries(): void {
  entries.clear();
}
