import type {ColorRoles} from './tokens';
import {tokens} from './tokens';

const VARIABLES = Object.fromEntries(Object.keys(tokens.colors.dark).map((role) => [role, `var(--c-${role})`])) as ColorRoles;

export function themeColors(): ColorRoles {
  return VARIABLES;
}
