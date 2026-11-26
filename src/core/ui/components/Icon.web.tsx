import {GLYPH_PATHS} from '../icons/glyphPaths.web';
import type {IconName} from '../icons/glyphs';
import type {ColorRoles} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';

export type IconSize = 18 | 20 | 24 | 48;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  filled?: boolean;
  color?: keyof ColorRoles;
}

export function Icon({name, size = 24, filled = false, color = 'onSurfaceVariant'}: IconProps) {
  const theme = useTheme();
  const glyph = GLYPH_PATHS[name];
  const path = filled && glyph.filled !== undefined ? glyph.filled : glyph.outline;
  return (
    <svg
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{color: theme.colors[color], display: 'block', flexShrink: 0}}
    >
      <path d={path} fill="currentColor"/>
    </svg>
  );
}
