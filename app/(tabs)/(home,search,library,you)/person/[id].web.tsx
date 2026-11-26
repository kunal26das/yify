import {useLoaderData} from 'expo-router';
import type {ImmutableRequest, LoaderFunction} from 'expo-router/server';
import {type PersonLoaderData, PersonRoute} from '@/features/person/screens/PersonRoute';

type Params = Record<string, string | string[]>;

export async function loader(request: ImmutableRequest | undefined, params: Params) {
  const {personLoader} = await import('@/server/seo/personPage');
  return personLoader(request, params);
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Params) {
  const {personMetadata} = await import('@/server/seo/personPage');
  return personMetadata(request, params);
}

export default function PersonPage() {
  const data = useLoaderData<LoaderFunction<PersonLoaderData | null>>();
  return <PersonRoute initialData={data?.person ?? null} jsonLd={data?.jsonLd ?? null}/>;
}
