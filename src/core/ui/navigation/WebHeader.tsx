import {APP_NAME} from '@/core/config/app';
import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {currentPageProps} from '../a11y';
import {Avatar} from '../components/Avatar';
import {Badge} from '../components/Badge';
import {Icon} from '../components/Icon';
import {Text} from '../components/Text';
import {Touchable} from '../components/Touchable';
import {useTheme} from '../theme/useTheme';
import {MAIN_NAVIGATION_LABEL} from './NavigationBar';
import type {NavigationChromeProps, TabItem} from './tabItems';
import {BILLING_SUFFIX, tabItems} from './tabItems';

export interface HeaderAccount {
  name: string;
  photoUrl: string | null;
}

export interface WebHeaderProps extends NavigationChromeProps {
  headerSearch: ReactNode;
  account: HeaderAccount | null;
}

export const YOU_LINK_LABEL = 'You: account and settings';
export const WORDMARK_LABEL = `${APP_NAME} home`;

const LINK_HEIGHT = 40;
const SEARCH_MAX_WIDTH = 560;
const AVATAR_SIZE = 32;
const SCROLLED_AFTER = 4;

function useDocumentScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onScroll = (event: Event) => {
      const target = event.target as {scrollTop?: number; scrollingElement?: {scrollTop: number}} | null;
      const top = target?.scrollingElement?.scrollTop ?? target?.scrollTop ?? 0;
      setScrolled(top > SCROLLED_AFTER);
    };
    document.addEventListener('scroll', onScroll, {capture: true, passive: true});
    return () => document.removeEventListener('scroll', onScroll, {capture: true});
  }, []);
  return scrolled;
}

function HeaderLink({item}: {item: TabItem}) {
  const theme = useTheme();
  return (
    <Touchable
      {...currentPageProps(item.focused)}
      href={item.destination.href}
      onPress={item.onPress}
      shape="full"
      style={[styles.link, {minHeight: LINK_HEIGHT, paddingHorizontal: theme.space.md, backgroundColor: item.focused ? theme.colors.secondaryContainer : undefined}]}
    >
      <Text variant="labelLarge" color={item.focused ? 'onSecondaryContainer' : 'onSurfaceVariant'}>{item.destination.label}</Text>
    </Touchable>
  );
}

export function WebHeader({headerSearch, account, youBadge, ...tabs}: WebHeaderProps) {
  const theme = useTheme();
  const scrolled = useDocumentScrolled();
  const items = tabItems(tabs, youBadge);
  const find = (route: TabItem['destination']['route']) => items.find((item) => item.destination.route === route);
  const home = find('(home)');
  const library = find('(library)');
  const you = find('(you)');
  const youLabel = you?.billing ? `${YOU_LINK_LABEL}, ${BILLING_SUFFIX}` : YOU_LINK_LABEL;

  return (
    <View
      role="banner"
      dataSet={{nav: 'header'}}
      style={[
        styles.header,
        {
          minHeight: theme.layout.webHeaderHeight,
          paddingHorizontal: theme.layout.gutter.expanded,
          gap: theme.space.xl,
          backgroundColor: scrolled ? theme.colors.surfaceContainer : theme.colors.surface,
          borderBottomColor: scrolled ? theme.colors.outlineVariant : 'transparent',
        },
      ]}
    >
      <Touchable href="/" onPress={home?.onPress} aria-label={WORDMARK_LABEL} shape="small" style={{paddingHorizontal: theme.space.xs}}>
        <Text variant="headlineSmall" aria-hidden>{APP_NAME}</Text>
      </Touchable>
      <View role="navigation" aria-label={MAIN_NAVIGATION_LABEL} style={[styles.row, {gap: theme.space.xs}]}>
        {home ? <HeaderLink item={home}/> : null}
        {library ? <HeaderLink item={library}/> : null}
      </View>
      <View style={styles.spacer}/>
      <View style={[styles.search, {maxWidth: SEARCH_MAX_WIDTH}]}>{headerSearch}</View>
      <View style={styles.spacer}/>
      <Touchable
        {...currentPageProps(you?.focused ?? false)}
        href="/you"
        onPress={you?.onPress}
        aria-label={youLabel}
        shape="full"
        style={[styles.you, {width: LINK_HEIGHT, height: LINK_HEIGHT}]}
      >
        {account ? <Avatar name={account.name} photoUrl={account.photoUrl} size={AVATAR_SIZE} decorative/> : <Icon name="person" size={24} color="onSurfaceVariant"/>}
        {you?.billing ? <View style={styles.badge}><Badge size="dot" tone="error"/></View> : null}
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1},
  row: {flexDirection: 'row', alignItems: 'center'},
  link: {alignItems: 'center', justifyContent: 'center'},
  spacer: {flexGrow: 1, flexShrink: 1, minWidth: 0},
  search: {flexGrow: 3, flexShrink: 1, flexBasis: 320, flexDirection: 'row'},
  you: {alignItems: 'center', justifyContent: 'center'},
  badge: {position: 'absolute', top: 6, right: 6},
});
