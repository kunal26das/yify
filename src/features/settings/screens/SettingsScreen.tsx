import {ScrollView} from 'react-native';
import {STATIC_PAGE_NAMES, staticPageTitle} from '@/core/config/seo';
import type {IconName} from '@/core/ui/icons/glyphs';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ListItem} from '@/core/ui/components/ListItem';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

const PAGES: readonly {href: string; headline: string; icon: IconName}[] = [
  {href: '/settings/appearance', headline: STATIC_PAGE_NAMES.appearance, icon: 'palette'},
  {href: '/settings/streaming', headline: STATIC_PAGE_NAMES.streaming, icon: 'public'},
  {href: '/settings/privacy', headline: STATIC_PAGE_NAMES.privacy, icon: 'policy'},
  {href: '/settings/account', headline: STATIC_PAGE_NAMES.account, icon: 'account_circle'},
  {href: '/settings/about', headline: STATIC_PAGE_NAMES.about, icon: 'info'},
];

export function SettingsScreen() {
  return (
    <ScreenScaffold title="Settings" documentTitle={staticPageTitle('settings')} width="reading" topBar={<TopAppBar variant="small" title="Settings" back/>}>
      <ScrollView>
        <EmptyState icon="info" title="The settings page is being rebuilt"/>
        {PAGES.map((page) => (
          <ListItem key={page.href} headline={page.headline} leading={{kind: 'icon', icon: page.icon}} trailing={{kind: 'chevron'}} href={page.href}/>
        ))}
      </ScrollView>
    </ScreenScaffold>
  );
}
