import {usePathname, useRouter} from 'expo-router';
import {TabList, TabSlot, TabTrigger, Tabs} from 'expo-router/ui';
import {StyleSheet} from 'react-native';
import type {StaticPage} from '@/core/config/seo';
import {staticPageTitle} from '@/core/config/seo';
import {currentPageProps} from '@/core/ui/a11y';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {Text} from '@/core/ui/components/Text';
import {TopAppBar} from '@/core/ui/components/TopAppBar';
import {Touchable} from '@/core/ui/components/Touchable';
import {useTheme} from '@/core/ui/theme/useTheme';

interface Section {
  name: string;
  href: '/library' | '/library/watched' | '/library/lists' | '/library/recent';
  label: string;
  page: StaticPage;
}

const SECTIONS: readonly Section[] = [
  {name: 'watchlist', href: '/library', label: 'Watchlist', page: 'watchlist'},
  {name: 'watched', href: '/library/watched', label: 'Watched', page: 'watched'},
  {name: 'lists', href: '/library/lists', label: 'Lists', page: 'lists'},
  {name: 'recent', href: '/library/recent', label: 'Recent', page: 'recent'},
];

function SectionTab({label, isFocused = false, href}: {label: string; isFocused?: boolean; href?: string}) {
  const router = useRouter();
  const theme = useTheme();
  const go = () => {
    if (href !== undefined) router.navigate(href);
  };
  return (
    <Touchable
      {...currentPageProps(isFocused)}
      href={href}
      onPress={go}
      shape="full"
      style={[styles.tab, {minHeight: theme.layout.minTouchTarget, paddingHorizontal: theme.space.lg, backgroundColor: isFocused ? theme.colors.secondaryContainer : undefined}]}
    >
      <Text variant="labelLarge" color={isFocused ? 'onSecondaryContainer' : 'onSurfaceVariant'}>{label}</Text>
    </Touchable>
  );
}

export function LibraryLayout() {
  const theme = useTheme();
  const pathname = usePathname();
  const section = SECTIONS.find((item) => item.href === pathname) ?? SECTIONS[0];
  return (
    <Tabs asChild>
      <ScreenScaffold title="Library" documentTitle={staticPageTitle(section.page)} topBar={<TopAppBar variant="small" title="Library"/>}>
        <TabList style={[styles.tabs, {gap: theme.space.xs, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm}]}>
          {SECTIONS.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <SectionTab label={item.label}/>
            </TabTrigger>
          ))}
        </TabList>
        <TabSlot/>
      </ScreenScaffold>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabs: {justifyContent: 'flex-start', flexWrap: 'wrap'},
  tab: {alignItems: 'center', justifyContent: 'center'},
});
