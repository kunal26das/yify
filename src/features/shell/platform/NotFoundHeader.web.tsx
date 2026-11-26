import {useRouter} from 'expo-router';
import type {BottomTabBarProps} from 'expo-router/js-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {DESTINATIONS} from '@/core/ui/navigation/destinations';
import {WebHeader} from '@/core/ui/navigation/WebHeader';
import {useSession} from '@/features/account/public/session';
import {HeaderSearch} from '@/features/search/public/HeaderSearch';
import {headerAccount} from '../headerAccount';

const STATE: BottomTabBarProps['state'] = {index: -1, routes: DESTINATIONS.map((destination) => ({key: destination.route, name: destination.route}))};

const EMITTER = {emit: () => ({defaultPrevented: false, preventDefault: () => undefined})} as unknown as BottomTabBarProps['emitter'];

export function NotFoundHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const navigateToTab = (routeKey: string) => {
    const destination = DESTINATIONS.find((item) => item.route === routeKey);
    if (destination !== undefined) router.navigate(destination.href);
  };
  return (
    <WebHeader
      state={STATE}
      descriptors={{}}
      emitter={EMITTER}
      navigateToTab={navigateToTab}
      insets={insets}
      youBadge="none"
      headerSearch={<HeaderSearch/>}
      account={headerAccount(session)}
    />
  );
}
