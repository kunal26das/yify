import {withAlpha} from './color';
import {stateLayer} from './tokens';

export type StateLayer = keyof typeof stateLayer;

export function rippleColor(content: string): string {
  return withAlpha(content, stateLayer.pressed);
}

export function layerOpacity(state: {hovered: boolean; focused: boolean; dragged?: boolean}): number {
  if (state.dragged) return stateLayer.dragged;
  if (state.focused) return stateLayer.focus;
  if (state.hovered) return stateLayer.hover;
  return 0;
}
