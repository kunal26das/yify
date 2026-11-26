import {useSyncExternalStore} from 'react';
import {useWindowDimensions} from 'react-native';
import type {WindowClass} from './windowClass';
import {windowClassFor} from './windowClass';

function subscribe(): () => void {
  return () => undefined;
}

function hydrated(): boolean {
  return true;
}

function serverRender(): boolean {
  return false;
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, hydrated, serverRender);
}

export function useWindowClass(): WindowClass | null {
  const {width} = useWindowDimensions();
  return useHydrated() ? windowClassFor(width) : null;
}
