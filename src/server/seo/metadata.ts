import type {Metadata} from 'expo-router/server';
import {APP_NAME, SITE_ORIGIN} from '@/core/config/app';
import {OG_IMAGE_URL, isIndexableHost, personDocumentTitle, titleDocumentTitle} from '@/core/config/seo';
import type {PersonDetails} from '@/core/domain/person';
import type {TitleDetails} from '@/core/domain/title';

const DESCRIPTION_LIMIT = 155;

export function cutDescription(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_LIMIT) return clean;
  const slice = clean.slice(0, DESCRIPTION_LIMIT);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : DESCRIPTION_LIMIT).replace(/[\s,.;:]+$/, '')}…`;
}

export function titlePath(title: TitleDetails): string {
  return `/title/${title.type}/${title.id}${title.slug ? `-${title.slug}` : ''}`;
}

export function personPath(person: PersonDetails): string {
  return `/person/${person.id}${person.slug ? `-${person.slug}` : ''}`;
}

export function titleImage(title: TitleDetails): string {
  if (title.backdropPath) return `https://image.tmdb.org/t/p/w1280${title.backdropPath}`;
  if (title.posterPath) return `https://image.tmdb.org/t/p/w780${title.posterPath}`;
  return OG_IMAGE_URL;
}

function robotsFor(host: string | null): Pick<Metadata, 'robots'> {
  return isIndexableHost(host) ? {} : {robots: {index: false, follow: false}};
}

export function buildTitleMetadata(title: TitleDetails, host: string | null): Metadata {
  const documentTitle = titleDocumentTitle({type: title.type, title: title.title, year: title.year});
  const description = title.overview
    ? cutDescription(title.overview)
    : `Watch the ${title.title} trailer, see the cast and find where to stream it.`;
  const canonical = `${SITE_ORIGIN}${titlePath(title)}`;
  const image = titleImage(title);
  return {
    title: documentTitle,
    description,
    ...robotsFor(host),
    alternates: {canonical},
    openGraph: {
      title: documentTitle,
      description,
      url: canonical,
      siteName: APP_NAME,
      type: title.type === 'tv' ? 'video.tv_show' : 'video.movie',
      images: [{url: image}],
    },
    twitter: {card: 'summary_large_image', title: documentTitle, description, images: [image]},
  };
}

export function buildPersonMetadata(person: PersonDetails, host: string | null): Metadata {
  const documentTitle = personDocumentTitle(person.name);
  const description = person.biography
    ? cutDescription(person.biography)
    : `See ${person.name}'s movies and TV shows, with trailers and where to watch.`;
  const canonical = `${SITE_ORIGIN}${personPath(person)}`;
  const image = person.profilePath ? `https://image.tmdb.org/t/p/w780${person.profilePath}` : OG_IMAGE_URL;
  return {
    title: documentTitle,
    description,
    ...robotsFor(host),
    alternates: {canonical},
    openGraph: {title: documentTitle, description, url: canonical, siteName: APP_NAME, type: 'profile', images: [{url: image}]},
    twitter: {card: 'summary_large_image', title: documentTitle, description, images: [image]},
  };
}
