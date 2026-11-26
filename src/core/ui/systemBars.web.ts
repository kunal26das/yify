import {useEffect} from 'react';
import type {ColorScheme} from './theme/tokens';
import {tokens} from './theme/tokens';

export function applySystemBars(scheme: ColorScheme): void {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', tokens.colors[scheme].surface);
  }
}

export function useSystemBars(scheme: ColorScheme): void {
  useEffect(() => {
    applySystemBars(scheme);
  }, [scheme]);
}
