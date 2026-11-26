import {SITE_ORIGIN} from '@/core/config/app';
import type {PersonDetails} from '@/core/domain/person';
import type {TitleDetails} from '@/core/domain/title';
import {personPath, titleImage, titlePath} from './metadata';

const ACTOR_LIMIT = 5;

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function isoDuration(minutes: number | null): string | undefined {
  if (!minutes) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours > 0 ? `${hours}H` : ''}${rest > 0 ? `${rest}M` : ''}`;
}

export function titleJsonLd(title: TitleDetails): string {
  const trailer = title.trailer && title.trailer.publishedAt ? {
    '@type': 'VideoObject',
    name: title.trailer.name,
    embedUrl: `https://www.youtube-nocookie.com/embed/${title.trailer.key}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${title.trailer.key}/hqdefault.jpg`,
    uploadDate: title.trailer.publishedAt,
  } : undefined;
  const actor = title.cast.slice(0, ACTOR_LIMIT).map((credit) => ({
    '@type': 'Person',
    name: credit.name,
    url: `${SITE_ORIGIN}/person/${credit.personId}${credit.slug ? `-${credit.slug}` : ''}`,
  }));
  const common = {
    '@context': 'https://schema.org',
    name: title.title,
    url: `${SITE_ORIGIN}${titlePath(title)}`,
    image: titleImage(title),
    description: title.overview || undefined,
    genre: title.genres.map((genre) => genre.name),
    actor,
    trailer,
  };
  if (title.type === 'tv') {
    return serializeJsonLd({...common, '@type': 'TVSeries', startDate: title.releaseDate ?? undefined, numberOfSeasons: title.numberOfSeasons});
  }
  return serializeJsonLd({
    ...common,
    '@type': 'Movie',
    datePublished: title.releaseDate ?? undefined,
    duration: isoDuration(title.runtimeMinutes),
    director: title.crew.filter((credit) => credit.job === 'Director').map((credit) => ({'@type': 'Person', name: credit.name})),
  });
}

export function personJsonLd(person: PersonDetails): string {
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    url: `${SITE_ORIGIN}${personPath(person)}`,
    image: person.profilePath ? `https://image.tmdb.org/t/p/w780${person.profilePath}` : undefined,
    birthDate: person.birthday ?? undefined,
    birthPlace: person.placeOfBirth ?? undefined,
    sameAs: person.imdbId ? [`https://www.imdb.com/name/${person.imdbId}/`] : undefined,
  });
}
