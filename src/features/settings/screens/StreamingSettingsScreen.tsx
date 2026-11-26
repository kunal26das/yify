import {STATIC_PAGE_NAMES, staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function StreamingSettingsScreen() {
  const title = STATIC_PAGE_NAMES.streaming;
  return (
    <ScreenScaffold title={title} documentTitle={staticPageTitle('streaming')} width="reading" topBar={<TopAppBar variant="small" title={title} back/>}>
      <EmptyState icon="info" title="Region and services is being rebuilt"/>
    </ScreenScaffold>
  );
}
