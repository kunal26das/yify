import {usePathname, useSegments} from 'expo-router';
import type {BottomTabBarProps} from 'expo-router/js-tabs';
import type {JSX} from 'react';
import {useEffect} from 'react';
import {trackScreen} from '@/core/platform/telemetry/events';
import {AdaptiveNavigation} from '@/core/ui/navigation/AdaptiveNavigation';
import {useSession} from '@/features/account/public/session';
import {usePlus} from '@/features/monetization/public/plus';
import {HeaderSearch} from '@/features/search/public/HeaderSearch';
import {headerAccount} from '../headerAccount';
import {screenNameForSegments} from '../screenNames';

export function AppTabBar(props: BottomTabBarProps): JSX.Element {
  const session = useSession();
  const {entitlement} = usePlus();
  const screen = screenNameForSegments(useSegments());
  const pathname = usePathname();
  useEffect(() => {
    if (screen !== null) trackScreen(screen);
  }, [screen, pathname]);
  return (
    <AdaptiveNavigation
      {...props}
      headerSearch={<HeaderSearch/>}
      account={headerAccount(session)}
      youBadge={entitlement.billingIssue ? 'billing' : 'none'}
    />
  );
}
