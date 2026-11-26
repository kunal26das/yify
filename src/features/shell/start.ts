import {subscribeOnline} from '@/core/platform/network';
import {startTelemetry} from '@/core/platform/telemetry/start';
import {startStoreUpdates} from '@/core/platform/updates/storeUpdates';
import {startQueryLifecycle} from '@/core/query/lifecycle';
import {setConnectivity} from '@/core/ui/connectivity';
import {settleImageHost} from '@/core/ui/imageHost';
import {startSession} from '@/features/account/public/session';
import {migrateLocalV1, startLegacyResolution} from '@/features/library/public/migration';
import {startAds} from '@/features/monetization/public/ads';
import {startPlus} from '@/features/monetization/public/plus';
import {startConsent} from '@/features/settings/public/consent';
import {startRegionDetection} from '@/features/settings/public/region';
import {startSync} from '@/features/sync/public/sync';

let started = false;

export function prepareLocalState(): true {
  migrateLocalV1();
  settleImageHost();
  return true;
}

export function startApp(): void {
  if (started) return;
  started = true;
  startQueryLifecycle();
  subscribeOnline(setConnectivity);
  startTelemetry();
  startConsent();
  startSession();
  startSync();
  startLegacyResolution();
  startRegionDetection();
  startPlus();
  startAds();
  startStoreUpdates();
}
