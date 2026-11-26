import {STATIC_PAGE_NAMES, staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function AboutScreen() {
  const title = STATIC_PAGE_NAMES.about;
  return (
    <ScreenScaffold title={title} documentTitle={staticPageTitle('about')} width="reading" topBar={<TopAppBar variant="small" title={title} back/>}>
      <EmptyState icon="info" title="The about page is being rebuilt"/>
    </ScreenScaffold>
  );
}
