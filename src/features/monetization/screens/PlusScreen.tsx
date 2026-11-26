import {PLUS_NAME} from '@/core/config/app';
import {staticPageTitle} from '@/core/config/seo';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

export function PlusScreen() {
  return (
    <ScreenScaffold title={PLUS_NAME} documentTitle={staticPageTitle('plus')} width="reading" topBar={<TopAppBar variant="small" title={PLUS_NAME} back/>}>
      <EmptyState icon="info" title={`The ${PLUS_NAME} page is being rebuilt`}/>
    </ScreenScaffold>
  );
}
