import {
  getAnalytics,
  getAppInstanceId,
  logEvent,
  logScreenView,
  resetAnalyticsData,
  setAnalyticsCollectionEnabled,
  setConsent,
  setUserProperties,
} from '@react-native-firebase/analytics';

export type AnalyticsParams = Record<string, string | number>;

let enabled = false;
let revision = 0;
let applying: Promise<void> = Promise.resolve();

function ignore(work: () => unknown): void {
  try {
    void Promise.resolve(work()).catch(() => undefined);
  } catch {
    return;
  }
}

export function applyAnalyticsConsent(allowed: boolean): void {
  const current = ++revision;
  enabled = false;
  applying = applying.catch(() => undefined).then(async () => {
    if (current !== revision) return;
    const analytics = getAnalytics();
    await setAnalyticsCollectionEnabled(analytics, false);
    if (current !== revision) return;
    await setConsent(analytics, {analytics_storage: allowed, ad_storage: false, ad_user_data: false, ad_personalization: false});
    if (!allowed) {
      await resetAnalyticsData(analytics);
      return;
    }
    if (current !== revision) return;
    await setAnalyticsCollectionEnabled(analytics, true);
    enabled = current === revision;
  }).catch(() => {
    enabled = false;
  });
}

export function analyticsEnabled(): boolean {
  return enabled;
}

export function logAnalyticsEvent(name: string, params: AnalyticsParams): void {
  if (!enabled) return;
  ignore(() => logEvent(getAnalytics(), name, params));
}

export function logAnalyticsScreen(screen: string): void {
  if (!enabled) return;
  ignore(() => logScreenView(getAnalytics(), {screen_name: screen, screen_class: screen}));
}

export function setAnalyticsUserProperties(properties: Record<string, string>): void {
  if (!enabled) return;
  ignore(() => setUserProperties(getAnalytics(), properties));
}

export async function analyticsInstanceId(): Promise<string | null> {
  const current = revision;
  try {
    await applying;
    if (!enabled || current !== revision) return null;
    const id = await getAppInstanceId(getAnalytics());
    return enabled && current === revision ? id : null;
  } catch {
    return null;
  }
}
