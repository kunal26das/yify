import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function LegacyMoviesRedirect() {
  return (
    <ScreenScaffold title="Older link" width="reading" topBar={<TopAppBar variant="small" title="Older link" back/>}>
      <EmptyState icon="info" title="Support for older links is being rebuilt"/>
    </ScreenScaffold>
  );
}
