const NO_AD_PRIVACY_OPTIONS = {required: false, show: async (): Promise<void> => undefined};

export function startAds(): void {
  return;
}

export function reportTrailerState(state: 'requested' | 'playing' | 'stopped'): void {
  return;
}

export function useAdPrivacyOptions(): {required: boolean; show(): Promise<void>} {
  return NO_AD_PRIVACY_OPTIONS;
}
