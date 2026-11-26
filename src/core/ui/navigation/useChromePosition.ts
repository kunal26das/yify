import {useWindowDimensions} from 'react-native';
import {windowClassFor} from '../layout/windowClass';

export type ChromePosition = 'bottom' | 'left' | 'top';

export function useChromePosition(): ChromePosition {
  const {width} = useWindowDimensions();
  return windowClassFor(width) === 'compact' ? 'bottom' : 'left';
}
