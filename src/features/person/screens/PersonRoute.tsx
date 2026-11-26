import {useLocalSearchParams, useSegments} from 'expo-router';
import {Text, View} from 'react-native';
import {personDocumentTitle} from '@/core/config/seo';
import type {PersonDetails} from '@/core/domain/person';
import {ScreenScaffold} from '@/core/ui/ScreenScaffold';
import {JsonLdScript} from '@/core/ui/seo/JsonLdScript';

export interface PersonLoaderData {
  person: PersonDetails;
  jsonLd: string;
}

export function PersonRoute({initialData, jsonLd}: {initialData?: PersonDetails | null; jsonLd?: string | null}) {
  const params = useLocalSearchParams<{id: string}>();
  const segments = useSegments();
  const name = initialData?.name ?? `Person ${String(params.id ?? '')}`;
  return (
    <ScreenScaffold title={name} documentTitle={personDocumentTitle(name)} heading={false}>
      {jsonLd ? <JsonLdScript json={jsonLd}/> : null}
      <View testID="person-screen">
        <Text role="heading" aria-level={1} testID="person-heading">{name}</Text>
        {initialData ? <Text testID="person-bio">{initialData.biography}</Text> : null}
        <Text testID="person-segments">{segments.join('/')}</Text>
      </View>
    </ScreenScaffold>
  );
}
