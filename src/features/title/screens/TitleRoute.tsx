import {useQuery} from '@tanstack/react-query';
import {useLocalSearchParams} from 'expo-router';
import {getSummary} from '@/core/api/summaryCache';
import {titleDocumentTitle} from '@/core/config/seo';
import type {MediaType, TitleKey} from '@/core/domain/keys';
import {parseTitleKey} from '@/core/domain/keys';
import type {TitleDetails, TitleSummary} from '@/core/domain/title';
import {EmptyState} from '@/core/ui/components/EmptyState';
import {ScreenScaffold} from '@/core/ui/components/ScreenScaffold';
import {TopAppBar} from '@/core/ui/components/TopAppBar';
import {useEffectiveRegion} from '@/features/settings/public/region';
import {titleQueryOptions} from '../public/titleQuery';

const ROUTE_ID = /^(\d{1,10})(?:-[a-z0-9-]*)?$/;

function routeKey(type: MediaType, raw: string | string[] | undefined): TitleKey | null {
  const match = ROUTE_ID.exec((Array.isArray(raw) ? raw[0] : raw) ?? '');
  return match ? parseTitleKey(`${type}:${Number(match[1])}`)?.key ?? null : null;
}

function TitlePlaceholder({type, header}: {type: MediaType; header: TitleSummary | null}) {
  const name = header?.title ?? 'Title';
  const documentTitle = header === null ? undefined : titleDocumentTitle({type, title: header.title, year: header.year});
  return (
    <ScreenScaffold title={name} documentTitle={documentTitle} topBar={<TopAppBar variant="small" title={name} back/>}>
      <EmptyState icon="info" title="The title page is being rebuilt"/>
    </ScreenScaffold>
  );
}

function KnownTitle({type, titleKey, initialData}: {type: MediaType; titleKey: TitleKey; initialData: TitleDetails | null}) {
  const region = useEffectiveRegion();
  const query = useQuery({...titleQueryOptions(titleKey, region), initialData: initialData ?? undefined});
  return <TitlePlaceholder type={type} header={query.data ?? getSummary(titleKey)}/>;
}

export function TitleRoute(props: {type: MediaType; initialData?: TitleDetails | null}) {
  const params = useLocalSearchParams<{id?: string}>();
  const key = routeKey(props.type, params.id);
  if (key === null) return <TitlePlaceholder type={props.type} header={null}/>;
  return <KnownTitle type={props.type} titleKey={key} initialData={props.initialData ?? null}/>;
}
