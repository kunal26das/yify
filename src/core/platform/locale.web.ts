import type {RegionCode} from '@/core/domain/providers';
import {DEFAULT_REGION, regionFromLanguageTag, regionFromTimeZone, resolvedLocale, resolvedTimeZone} from './regionHints';

function browserRegion(): RegionCode | null {
  if (typeof navigator === 'undefined') return null;
  const tags = [...(navigator.languages ?? []), navigator.language];
  for (const tag of tags) {
    const region = regionFromLanguageTag(tag);
    if (region !== null) return region;
  }
  return null;
}

export function deviceRegion(): RegionCode {
  return browserRegion() ?? regionFromLanguageTag(resolvedLocale()) ?? regionFromTimeZone(resolvedTimeZone()) ?? DEFAULT_REGION;
}
