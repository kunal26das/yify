import type {Consent} from '@/core/domain/preferences';
import {DEFAULT_CONSENT} from '@/core/domain/preferences';
import {applyTelemetryConsent} from '@/core/platform/telemetry/consent';
import {createStore, useStore} from '@/core/store/createStore';

const consentStore = createStore<Consent>({load: () => DEFAULT_CONSENT, serverState: DEFAULT_CONSENT});

function selectConsent(consent: Consent): Consent {
  return consent;
}

export function useConsent(): Consent {
  return useStore(consentStore, selectConsent);
}

export function getConsent(): Consent {
  return consentStore.get();
}

export function setConsent(patch: Partial<Pick<Consent, 'analytics' | 'youtube'>>): void {
  consentStore.set((consent) => ({...consent, ...patch}));
  if (patch.analytics !== undefined) applyTelemetryConsent(patch.analytics);
}

export function isConsentPromptResolved(): boolean {
  return true;
}

export function subscribeConsent(listener: () => void): () => void {
  return consentStore.subscribe(listener);
}

export function startConsent(): void {
  applyTelemetryConsent(false);
}
