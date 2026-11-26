import type {ReactNode} from 'react';
import {NavigationBar} from './NavigationBar';
import {NavigationRail} from './NavigationRail';
import {SkipLink} from './SkipLink';
import type {NavigationChromeProps} from './tabItems';
import type {HeaderAccount} from './WebHeader';
import {WebHeader} from './WebHeader';

export interface AdaptiveNavigationProps extends NavigationChromeProps {
  headerSearch: ReactNode;
  account: HeaderAccount | null;
}

export function AdaptiveNavigation({headerSearch, account, ...chrome}: AdaptiveNavigationProps) {
  return (
    <>
      <SkipLink/>
      <WebHeader {...chrome} headerSearch={headerSearch} account={account}/>
      <NavigationRail {...chrome}/>
      <NavigationBar {...chrome}/>
    </>
  );
}
