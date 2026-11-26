import type {AccentName, ColorRoles, ColorScheme} from './tokens';
import {resolveColors} from './tokens';

export function themeColors(scheme: ColorScheme, accent: AccentName): ColorRoles {
  return resolveColors(scheme, accent);
}
