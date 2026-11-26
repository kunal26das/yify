import type {AvailabilityResponse} from '@/core/domain/api';
import type {TitleKey} from '@/core/domain/keys';
import type {RegionAvailability, RegionCode} from '@/core/domain/providers';
import availabilityIN from './v2/availability.IN.json';
import availabilityUS from './v2/availability.US.json';

const AVAILABILITY: Readonly<Record<string, AvailabilityResponse>> = {
  IN: availabilityIN as unknown as AvailabilityResponse,
  US: availabilityUS as unknown as AvailabilityResponse,
};

const KNOWN: ReadonlySet<string> = new Set(Object.values(AVAILABILITY).flatMap((response) => Object.keys(response.items)));

export function emptyAvailability(region: RegionCode | null): RegionAvailability {
  return {region: region ?? '', offers: {stream: [], free: [], ads: [], rent: [], buy: []}, link: null, attribution: 'JustWatch'};
}

export function knownAvailabilityKey(key: TitleKey): boolean {
  return KNOWN.has(key);
}

export function fixtureAvailability(region: RegionCode | null, key: TitleKey): RegionAvailability | null {
  if (region === null) return null;
  return AVAILABILITY[region]?.items[key] ?? null;
}
