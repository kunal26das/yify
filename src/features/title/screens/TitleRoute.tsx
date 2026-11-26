import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useLocalSearchParams, useSegments} from 'expo-router';
import {Text, View} from 'react-native';
import {titleDocumentTitle} from '@/core/config/seo';
import type {MediaType, TitleKey} from '@/core/domain/keys';
import type {TitleDetails, TitleSummary} from '@/core/domain/title';
import {ScreenScaffold} from '@/core/ui/ScreenScaffold';
import {JsonLdScript} from '@/core/ui/seo/JsonLdScript';
import {titleQueryOptions, titleSummaryKey} from '../public/titleQuery';

const ID = /^(\d{1,9})(?:-[a-z0-9-]*)?$/;

function parseId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = ID.exec(value ?? '');
  return match ? Number(match[1]) : 0;
}

interface TitleRouteProps {
  type: MediaType;
  initialData?: TitleDetails | null;
  jsonLd?: string | null;
}

export function TitleRoute({type, initialData, jsonLd}: TitleRouteProps) {
  const params = useLocalSearchParams<{id: string}>();
  const segments = useSegments();
  const id = parseId(params.id);
  const key = `${type}:${id}` as TitleKey;
  const queryClient = useQueryClient();
  const summary = queryClient.getQueryData<TitleSummary>(titleSummaryKey(key));
  const query = useQuery({...titleQueryOptions(type, id), initialData: initialData ?? undefined, enabled: id > 0});
  const header = query.data ?? summary ?? null;
  const documentTitle = header ? titleDocumentTitle({type, title: header.title, year: header.year}) : undefined;
  return (
    <ScreenScaffold title={header?.title ?? 'Title'} documentTitle={documentTitle} heading={false}>
      {jsonLd ? <JsonLdScript json={jsonLd}/> : null}
      <View testID="title-screen">
        <Text role="heading" aria-level={1} testID="title-heading">{header ? header.title : 'Loading title'}</Text>
        {header?.year ? <Text testID="title-year">{String(header.year)}</Text> : null}
        {query.data ? <Text testID="title-overview">{query.data.overview}</Text> : null}
        {query.data ? <Text testID="title-cast">{query.data.cast.slice(0, 5).map((credit) => credit.name).join(', ')}</Text> : null}
        <Text testID="title-segments">{segments.join('/')}</Text>
      </View>
    </ScreenScaffold>
  );
}
