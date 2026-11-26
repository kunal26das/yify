import type {Accent} from '@/core/domain/preferences';
import data from '../../../config/brand.json';

export type BrandColorRole =
  | 'surface' | 'surfaceContainerLowest' | 'surfaceContainerLow' | 'surfaceContainer' | 'surfaceContainerHigh'
  | 'surfaceContainerHighest' | 'onSurface' | 'onSurfaceVariant' | 'outline' | 'outlineVariant' | 'primary'
  | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer' | 'secondaryContainer' | 'onSecondaryContainer'
  | 'error' | 'onError' | 'errorContainer' | 'onErrorContainer' | 'inverseSurface' | 'inverseOnSurface'
  | 'inversePrimary' | 'ratingStar' | 'scrim' | 'mediaScrim' | 'onMedia' | 'focusRing';
export type BrandAccentRole = 'primary' | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer' | 'inversePrimary' | 'focusRing';

export interface BrandAccent {
  id: Accent;
  name: string;
  light: Record<BrandAccentRole, string>;
  dark: Record<BrandAccentRole, string>;
}

export interface BrandFont {
  family: string;
  file: string;
  web: string;
  weight: 400 | 500 | 600 | 700 | 800;
}

export interface BrandConfig {
  status: 'placeholder' | 'final';
  appName: string;
  colors: {light: Record<BrandColorRole, string>; dark: Record<BrandColorRole, string>};
  accents: readonly BrandAccent[];
  fonts: {display: BrandFont; body: BrandFont; bodyStrong: BrandFont};
  androidIconBackground: string;
}

export const brand: BrandConfig = data as BrandConfig;
