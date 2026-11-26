import type {TextStyle} from 'react-native';
import {fontStack} from './fontStack';
import type {TypeStyle} from './tokens';

export function textStyle(type: TypeStyle): TextStyle {
  return {
    fontFamily: fontStack(type.fontFamily),
    fontSize: type.fontSize,
    lineHeight: type.lineHeight,
    letterSpacing: type.letterSpacing,
  };
}

export function glyphStyle(size: number): TextStyle {
  return {fontSize: size, lineHeight: size, width: size, height: size, textAlign: 'center'};
}
