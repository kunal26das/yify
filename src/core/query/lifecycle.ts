import {focusManager, onlineManager} from '@tanstack/react-query';
import {subscribeForeground} from '@/core/platform/appState';
import {subscribeOnline} from '@/core/platform/network';

export function startQueryLifecycle(): void {
  focusManager.setEventListener((setFocused) => subscribeForeground((active) => setFocused(active)));
  onlineManager.setEventListener((setOnline) => subscribeOnline(setOnline));
}
