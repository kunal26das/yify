import {STATIC_PAGE_NAMES, staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function AccountSettingsScreen() {
  const title = STATIC_PAGE_NAMES.account;
  return (
    <ScreenScaffold title={title} documentTitle={staticPageTitle('account')} width="reading" topBar={<TopAppBar variant="small" title={title} back/>}>
      <EmptyState icon="info" title="Account settings is being rebuilt"/>
    </ScreenScaffold>
  );
}
