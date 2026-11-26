import {useQuery} from '@tanstack/react-query';
import {useLocalSearchParams} from 'expo-router';
import {personDocumentTitle} from '@/core/config/seo';
import type {PersonKey} from '@/core/domain/keys';
import {MAX_TMDB_ID, personKey} from '@/core/domain/keys';
import type {PersonDetails} from '@/core/domain/person';
import {personQueryOptions} from '@/core/query/options';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';

const ROUTE_ID = /^(\d{1,10})(?:-[a-z0-9-]*)?$/;

function routeKey(raw: string | string[] | undefined): PersonKey | null {
  const match = ROUTE_ID.exec((Array.isArray(raw) ? raw[0] : raw) ?? '');
  const id = match ? Number(match[1]) : 0;
  return id > 0 && id <= MAX_TMDB_ID ? personKey(id) : null;
}

function PersonPlaceholder({name}: {name: string | null}) {
  const title = name ?? 'Person';
  return (
    <ScreenScaffold title={title} documentTitle={name === null ? undefined : personDocumentTitle(name)} width="reading" topBar={<TopAppBar variant="small" title={title} back/>}>
      <EmptyState icon="info" title="The person page is being rebuilt"/>
    </ScreenScaffold>
  );
}

function KnownPerson({personKey: key, initialData}: {personKey: PersonKey; initialData: PersonDetails | null}) {
  const query = useQuery({...personQueryOptions(key), initialData: initialData ?? undefined});
  return <PersonPlaceholder name={query.data?.name ?? null}/>;
}

export function PersonRoute(props: {initialData?: PersonDetails | null}) {
  const params = useLocalSearchParams<{id?: string}>();
  const key = routeKey(params.id);
  if (key === null) return <PersonPlaceholder name={null}/>;
  return <KnownPerson personKey={key} initialData={props.initialData ?? null}/>;
}
