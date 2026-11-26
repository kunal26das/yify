import type {PaywallPlacement, PlusEntitlement, PlusStatus} from './types';
import {FREE_CUSTOM_LIST_LIMIT} from './types';

export const FREE_ENTITLEMENT: PlusEntitlement = {
  active: false,
  productId: null,
  store: null,
  expiresAt: null,
  willRenew: false,
  billingIssue: false,
  managementUrl: null,
  status: 'free',
  source: 'none',
  appUserId: null,
  checkedAt: null,
};

export function getPlusStatus(): PlusStatus {
  return 'free';
}

export function openPaywall(placement: PaywallPlacement): void {
  return;
}

async function ensureKnown(): Promise<'free' | 'plus'> {
  return 'free';
}

const PLUS = {status: getPlusStatus(), entitlement: FREE_ENTITLEMENT, ensureKnown, openPaywall};

export function usePlus(): {status: PlusStatus; entitlement: PlusEntitlement; ensureKnown(): Promise<'free' | 'plus'>; openPaywall(placement: PaywallPlacement): void} {
  return PLUS;
}

export function canCreateCustomList(input: {customListCount: number; status: PlusStatus}): {allowed: true} | {allowed: false; reason: 'limit'} {
  if (input.status === 'plus' || input.customListCount < FREE_CUSTOM_LIST_LIMIT) return {allowed: true};
  return {allowed: false, reason: 'limit'};
}

export function effectiveAccent<T extends string>(input: {stored: T; status: PlusStatus; fallback: T}): T {
  return input.status === 'plus' ? input.stored : input.fallback;
}

export function insightsAccess(status: PlusStatus): 'full' | 'teaser' {
  return status === 'plus' ? 'full' : 'teaser';
}

export function startPlus(): void {
  return;
}
