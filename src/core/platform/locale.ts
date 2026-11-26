import type {RegionCode} from '@/core/domain/providers';
import {getLocales} from 'expo-localization';
import {DEFAULT_REGION, regionCode, regionFromLanguageTag, regionFromTimeZone, resolvedLocale, resolvedTimeZone} from './regionHints';

function localeRegion(): RegionCode | null {
  try {
    return regionCode(getLocales()[0]?.regionCode);
  } catch {
    return null;
  }
}

export function deviceRegion(): RegionCode {
  return localeRegion() ?? regionFromLanguageTag(resolvedLocale()) ?? regionFromTimeZone(resolvedTimeZone()) ?? DEFAULT_REGION;
}
