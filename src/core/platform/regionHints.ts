import type {RegionCode} from '@/core/domain/providers';

export const DEFAULT_REGION: RegionCode = 'US';

const ZONE_REGIONS: Readonly<Record<string, RegionCode>> = {
  Kolkata: 'IN', Calcutta: 'IN', Colombo: 'LK', Karachi: 'PK', Dhaka: 'BD', Kathmandu: 'NP',
  London: 'GB', Dublin: 'IE', Paris: 'FR', Berlin: 'DE', Madrid: 'ES', Rome: 'IT',
  Amsterdam: 'NL', Brussels: 'BE', Lisbon: 'PT', Zurich: 'CH', Vienna: 'AT', Stockholm: 'SE',
  Oslo: 'NO', Copenhagen: 'DK', Helsinki: 'FI', Warsaw: 'PL', Prague: 'CZ', Moscow: 'RU',
  Istanbul: 'TR', Athens: 'GR', Dubai: 'AE', Riyadh: 'SA', Doha: 'QA', Jerusalem: 'IL',
  Tokyo: 'JP', Seoul: 'KR', Shanghai: 'CN', Hong_Kong: 'HK', Taipei: 'TW', Singapore: 'SG',
  Bangkok: 'TH', Jakarta: 'ID', Manila: 'PH', Kuala_Lumpur: 'MY', Ho_Chi_Minh: 'VN',
  Sydney: 'AU', Melbourne: 'AU', Brisbane: 'AU', Perth: 'AU', Auckland: 'NZ',
  Toronto: 'CA', Vancouver: 'CA', Montreal: 'CA', Mexico_City: 'MX',
  Sao_Paulo: 'BR', Buenos_Aires: 'AR', Santiago: 'CL', Bogota: 'CO', Lima: 'PE',
  Johannesburg: 'ZA', Lagos: 'NG', Nairobi: 'KE', Cairo: 'EG', Casablanca: 'MA',
};

export function regionCode(value: string | null | undefined): RegionCode | null {
  const upper = value?.trim().toUpperCase();
  return upper && /^[A-Z]{2}$/.test(upper) ? upper : null;
}

export function regionFromLanguageTag(tag: string | null | undefined): RegionCode | null {
  if (!tag) return null;
  for (const part of tag.split(/[-_]/).slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return null;
}

export function regionFromTimeZone(zone: string | null | undefined): RegionCode | null {
  if (!zone) return null;
  const city = zone.split('/').pop();
  if (city && Object.hasOwn(ZONE_REGIONS, city)) return ZONE_REGIONS[city];
  if (zone.startsWith('America/')) return 'US';
  if (zone.startsWith('Europe/')) return 'GB';
  return null;
}

export function resolvedTimeZone(): string | null {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function resolvedLocale(): string | null {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    return null;
  }
}
