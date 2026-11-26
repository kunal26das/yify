import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function SeasonRoute() {
  return (
    <ScreenScaffold title="Season" width="reading" topBar={<TopAppBar variant="small" title="Season" back/>}>
      <EmptyState icon="info" title="The season page is being rebuilt"/>
    </ScreenScaffold>
  );
}
