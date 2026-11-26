import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';
import {NotFoundHeader} from '../platform/NotFoundHeader';

export const NOT_FOUND_COPY = {
  title: 'Page not found',
  body: "The page you're looking for doesn't exist or has moved.",
  home: 'Go to Home',
  search: 'Search',
} as const;

export function NotFoundScreen() {
  return (
    <>
      <NotFoundHeader/>
      <ScreenScaffold title={NOT_FOUND_COPY.title} topBar={<TopAppBar variant="small" wordmark/>}>
        <EmptyState
          icon="search"
          title={NOT_FOUND_COPY.title}
          body={NOT_FOUND_COPY.body}
          primary={{label: NOT_FOUND_COPY.home, href: '/'}}
          secondary={{label: NOT_FOUND_COPY.search, href: '/search'}}
        />
      </ScreenScaffold>
    </>
  );
}
