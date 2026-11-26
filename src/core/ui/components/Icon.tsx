import createIconSet from '@expo/vector-icons/createIconSet';
import glyphMap from '../icons/glyphMap.json';
import type {IconName} from '../icons/glyphs';
import {hasFilledGlyph} from '../icons/glyphs';
import type {ColorRoles} from '../theme/tokens';
import {glyphStyle} from '../theme/typography';
import {useTheme} from '../theme/useTheme';

export type IconSize = 18 | 20 | 24 | 48;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  filled?: boolean;
  color?: keyof ColorRoles;
}

const OutlineGlyphs = createIconSet(glyphMap, 'YifyIcons', require('../icons/YifyIcons.ttf'));
const FilledGlyphs = createIconSet(glyphMap, 'YifyIconsFilled', require('../icons/YifyIconsFilled.ttf'));

export function Icon({name, size = 24, filled = false, color = 'onSurfaceVariant'}: IconProps) {
  const theme = useTheme();
  const Glyphs = filled && hasFilledGlyph(name) ? FilledGlyphs : OutlineGlyphs;
  return (
    <Glyphs
      name={name}
      size={size}
      color={theme.colors[color]}
      style={glyphStyle(size)}
      aria-hidden
      allowFontScaling={false}
    />
  );
}
