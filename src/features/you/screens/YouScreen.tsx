import {ScrollView} from 'react-native';
import {PLUS_NAME} from '@/core/config/app';
import {staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ListItem} from '@/core/ui/components/ListItem';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function YouScreen() {
  return (
    <ScreenScaffold title="You" documentTitle={staticPageTitle('you')} width="reading" topBar={<TopAppBar variant="small" title="You"/>}>
      <ScrollView>
        <EmptyState icon="info" title="The You tab is being rebuilt"/>
        <ListItem headline={PLUS_NAME} leading={{kind: 'icon', icon: 'workspace_premium'}} trailing={{kind: 'chevron'}} href="/plus"/>
        <ListItem headline="Settings" leading={{kind: 'icon', icon: 'tune'}} trailing={{kind: 'chevron'}} href="/settings"/>
      </ScrollView>
    </ScreenScaffold>
  );
}
