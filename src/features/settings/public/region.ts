import type {RegionCode} from '@/core/domain/providers';
import {deviceRegion} from '@/core/platform/locale';
import {getPreferences, usePreferences} from './preferences';

let detected: RegionCode | null = null;

function localeRegion(): RegionCode {
  detected ??= deviceRegion();
  return detected;
}

function selectRegion(preferences: {region: RegionCode | null}): RegionCode | null {
  return preferences.region;
}

export function useEffectiveRegion(): RegionCode {
  return usePreferences(selectRegion) ?? localeRegion();
}

export function getEffectiveRegion(): RegionCode {
  return getPreferences().region ?? localeRegion();
}

export function useRegionSource(): 'manual' | 'locale' | 'geo' | 'default' {
  return usePreferences(selectRegion) === null ? 'locale' : 'manual';
}

export function startRegionDetection(): void {
  return;
}
