import {staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function SearchScreen() {
  return (
    <ScreenScaffold title="Search" documentTitle={staticPageTitle('search')} topBar={<TopAppBar variant="small" title="Search"/>}>
      <EmptyState icon="info" title="Search is being rebuilt"/>
    </ScreenScaffold>
  );
}
