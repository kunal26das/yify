import {STATIC_PAGE_NAMES, staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function PrivacySettingsScreen() {
  const title = STATIC_PAGE_NAMES.privacy;
  return (
    <ScreenScaffold title={title} documentTitle={staticPageTitle('privacy')} width="reading" topBar={<TopAppBar variant="small" title={title} back/>}>
      <EmptyState icon="info" title="Privacy settings is being rebuilt"/>
    </ScreenScaffold>
  );
}
