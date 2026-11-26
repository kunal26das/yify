import {staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function ListScreen() {
  return (
    <ScreenScaffold title="List" documentTitle={staticPageTitle('list')} topBar={<TopAppBar variant="small" title="List" back/>}>
      <EmptyState icon="info" title="The list page is being rebuilt"/>
    </ScreenScaffold>
  );
}
