import type {ReactNode} from 'react';
import {useWindowDimensions} from 'react-native';
import {windowClassFor} from '../layout/windowClass';
import {NavigationBar} from './NavigationBar';
import {NavigationRail} from './NavigationRail';
import type {NavigationChromeProps} from './tabItems';
import type {HeaderAccount} from './WebHeader';

export interface AdaptiveNavigationProps extends NavigationChromeProps {
  headerSearch: ReactNode;
  account: HeaderAccount | null;
}

export function AdaptiveNavigation({headerSearch, account, ...chrome}: AdaptiveNavigationProps) {
  const {width} = useWindowDimensions();
  if (windowClassFor(width) === 'compact') return <NavigationBar {...chrome}/>;
  return <NavigationRail {...chrome}/>;
}
