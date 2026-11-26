import {useQuery} from '@tanstack/react-query';
import {ScrollView} from 'react-native';
import {HOME_TITLE} from '@/core/config/seo';
import type {Rail} from '@/core/domain/api';
import {homeQueryOptions} from '@/core/query/options';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ErrorState} from '@/core/ui/components/ErrorState';
import {ListItem} from '@/core/ui/components/ListItem';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';
import {useHydrated} from '@/core/ui/layout/useWindowClass';
import {useEffectiveRegion} from '@/features/settings/public/region';
import {useOpenMedia} from '@/features/title/public/useOpenMedia';

const NO_RAILS: readonly Rail[] = [];

export function HomeScreen() {
  const region = useEffectiveRegion();
  const hydrated = useHydrated();
  const home = useQuery(homeQueryOptions(region));
  const open = useOpenMedia('home');
  const rails = hydrated ? home.data?.rails ?? NO_RAILS : NO_RAILS;
  return (
    <ScreenScaffold title="Home" documentTitle={HOME_TITLE} topBar={<TopAppBar variant="small" wordmark/>}>
      <ScrollView>
        <EmptyState icon="info" title="Home is being rebuilt"/>
        {rails.map((rail) => {
          const item = rail.items[0];
          if (item === undefined) return null;
          return (
            <ListItem
              key={rail.id}
              overline={rail.id}
              headline={item.title}
              supporting={item.year === null ? undefined : String(item.year)}
              onPress={() => open({kind: 'title', title: item})}
            />
          );
        })}
        {hydrated && home.isError && home.data === undefined ? <ErrorState size="inline" onRetry={() => void home.refetch()}/> : null}
      </ScrollView>
    </ScreenScaffold>
  );
}
