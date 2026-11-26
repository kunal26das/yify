import {useLoaderData} from 'expo-router';
import type {ImmutableRequest, LoaderFunction} from 'expo-router/server';
import {Suspense} from 'react';
import type {TitleLoaderData} from '@/features/title/public/titleQuery';
import {TitleRoute} from '@/features/title/screens/TitleRoute';

type Params = Record<string, string | string[]>;

export async function loader(request: ImmutableRequest | undefined, params: Params) {
  const {titleLoader} = await import('@/server/seo/titlePage');
  return titleLoader('movie', request, params);
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Params) {
  const {titleMetadata} = await import('@/server/seo/titlePage');
  return titleMetadata('movie', request, params);
}

function MovieWithLoaderData() {
  const data = useLoaderData<LoaderFunction<TitleLoaderData | null>>();
  return <TitleRoute type="movie" initialData={data?.title ?? null} jsonLd={data?.jsonLd ?? null}/>;
}

export default function MovieRoute() {
  return <Suspense fallback={<TitleRoute type="movie"/>}><MovieWithLoaderData/></Suspense>;
}
