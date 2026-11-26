import type {ViewStyle} from 'react-native';

export interface WebOnlyStyle {
  display?: 'grid' | 'flex' | 'none' | 'contents';
  gridTemplateColumns?: string;
  gap?: number | string;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  paddingLeft?: number | string;
  paddingRight?: number | string;
  scrollSnapType?: string;
}

export const WEB_GUTTER = 'clamp(16px, 2.5vw, 32px)';

export function webStyle(style: WebOnlyStyle): ViewStyle {
  return style as unknown as ViewStyle;
}
