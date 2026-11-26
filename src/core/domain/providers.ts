import type {MediaType} from './keys';

export type RegionCode = string;
export type OfferType = 'stream' | 'free' | 'ads' | 'rent' | 'buy';
export const OFFER_TYPES: readonly OfferType[] = ['stream', 'free', 'ads', 'rent', 'buy'];

export interface Provider {
  id: number;
  name: string;
  logoPath: string | null;
  priority: number;
}

export interface RegionAvailability {
  region: RegionCode;
  offers: Record<OfferType, Provider[]>;
  link: string | null;
  attribution: 'JustWatch';
}

export interface Region {
  code: RegionCode;
  name: string;
}

export interface CatalogProvider extends Provider {
  types: MediaType[];
}

export type MyServices = Record<RegionCode, number[]>;
