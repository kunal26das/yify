import type {ImmutableRequest, Metadata} from 'expo-router/server';
import type {PersonDetails} from '@/core/domain/person';
import type {TitleDetails} from '@/core/domain/title';
import {getServerState} from '@/server/http/state';
import {getMovie, getPerson, getTv} from '@/server/tmdb/titles';
import {personJsonLd, titleJsonLd} from './jsonLd';
import {buildPersonMetadata, buildTitleMetadata, personPath, titlePath} from './metadata';
import {isLoaderDataRequest, notFoundResponse, parseIdParam, publicHost, redirectResponse, trace} from './page';
import {ENFORCED_CSP} from './securityHeaders';

const HTML_CACHE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=600';
const SHELL_HEADER = 'x-yify-shell';
const TITLE_PATH = /^\/title\/(movie|tv)\/([^/]+)\/?$/;
const PERSON_PATH = /^\/person\/([^/]+)\/?$/;

interface Page {
  kind: 'title' | 'person';
  template: string;
  metadata: Metadata;
  jsonLd: string;
  summary: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imageUrl(image: unknown): string | null {
  if (typeof image === 'string') return image;
  if (image && typeof image === 'object' && 'url' in image && typeof image.url === 'string') return image.url;
  return null;
}

function metadataTags(metadata: Metadata): string {
  const tags: string[] = [];
  if (typeof metadata.title === 'string') tags.push(`<title>${escapeHtml(metadata.title)}</title>`);
  if (metadata.description) tags.push(`<meta name="description" content="${escapeHtml(metadata.description)}"/>`);
  if (metadata.robots && typeof metadata.robots === 'object') {
    const robots = `${metadata.robots.index === false ? 'noindex' : 'index'}, ${metadata.robots.follow === false ? 'nofollow' : 'follow'}`;
    tags.push(`<meta name="robots" content="${robots}"/>`);
  }
  if (metadata.alternates?.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(metadata.alternates.canonical)}"/>`);
  const og = metadata.openGraph;
  if (og) {
    for (const [key, value] of [['title', og.title], ['description', og.description], ['url', og.url], ['site_name', og.siteName], ['type', og.type]] as const) {
      if (value) tags.push(`<meta property="og:${key}" content="${escapeHtml(value)}"/>`);
    }
    const images = Array.isArray(og.images) ? og.images : og.images ? [og.images] : [];
    for (const image of images) {
      const url = imageUrl(image);
      if (url) tags.push(`<meta property="og:image" content="${escapeHtml(url)}"/>`);
    }
  }
  const twitter = metadata.twitter;
  if (twitter) {
    for (const [key, value] of [['card', twitter.card], ['title', twitter.title], ['description', twitter.description]] as const) {
      if (value) tags.push(`<meta name="twitter:${key}" content="${escapeHtml(value)}"/>`);
    }
    const images = Array.isArray(twitter.images) ? twitter.images : twitter.images ? [twitter.images] : [];
    for (const image of images) {
      const url = imageUrl(image);
      if (url) tags.push(`<meta name="twitter:image" content="${escapeHtml(url)}"/>`);
    }
  }
  return tags.join('');
}

function titleSummary(title: TitleDetails): string {
  const poster = title.posterPath
    ? `<img src="https://image.tmdb.org/t/p/w342${title.posterPath}" alt="${escapeHtml(title.title)} poster" width="171" height="256"/>`
    : '';
  const cast = title.cast.slice(0, 5).map((credit) => escapeHtml(credit.name)).join(', ');
  return [
    '<main data-ssr-fallback="title">',
    poster,
    `<h1>${escapeHtml(title.title)}</h1>`,
    title.year ? `<p>${title.year}</p>` : '',
    title.overview ? `<p>${escapeHtml(title.overview)}</p>` : '',
    cast ? `<p>Cast: ${cast}</p>` : '',
    '</main>',
  ].join('');
}

function personSummary(person: PersonDetails): string {
  return [
    '<main data-ssr-fallback="person">',
    `<h1>${escapeHtml(person.name)}</h1>`,
    person.biography ? `<p>${escapeHtml(person.biography)}</p>` : '',
    '</main>',
  ].join('');
}

async function resolvePage(request: ImmutableRequest, pathname: string): Promise<Page | Response | undefined> {
  const signal = request.signal;
  const titleMatch = TITLE_PATH.exec(pathname);
  if (titleMatch) {
    const type = titleMatch[1] === 'tv' ? 'tv' : 'movie';
    const parsed = parseIdParam({id: decodeURIComponent(titleMatch[2])});
    if (!parsed) return notFoundResponse('title');
    const title = type === 'movie' ? await getMovie(parsed.id, null, signal) : await getTv(parsed.id, null, signal);
    if (!title) return notFoundResponse('title');
    const canonical = titlePath(title);
    if (pathname.replace(/\/$/, '') !== canonical) return redirectResponse(canonical);
    return {
      kind: 'title',
      template: type === 'movie' ? '/title/movie/[id]' : '/title/tv/[id]',
      metadata: buildTitleMetadata(title, publicHost(request)),
      jsonLd: titleJsonLd(title),
      summary: titleSummary(title),
    };
  }
  const personMatch = PERSON_PATH.exec(pathname);
  if (personMatch) {
    const parsed = parseIdParam({id: decodeURIComponent(personMatch[1])});
    if (!parsed) return notFoundResponse('person');
    const person = await getPerson(parsed.id, signal);
    if (!person) return notFoundResponse('person');
    const canonical = personPath(person);
    if (pathname.replace(/\/$/, '') !== canonical) return redirectResponse(canonical);
    return {
      kind: 'person',
      template: '/person/[id]',
      metadata: buildPersonMetadata(person, publicHost(request)),
      jsonLd: personJsonLd(person),
      summary: personSummary(person),
    };
  }
  return undefined;
}

async function shellFor(request: ImmutableRequest, template: string): Promise<string> {
  const state = getServerState();
  const key = `s1:shell:${template}`;
  const cached = state.cache.get(key);
  if (typeof cached === 'string') return cached;
  const url = new URL(template.replace(/\[/g, '%5B').replace(/\]/g, '%5D'), request.url);
  const response = await fetch(url, {headers: {[SHELL_HEADER]: '1', accept: 'text/html'}});
  if (!response.ok) throw new Error(`SPA shell ${template} answered ${response.status}`);
  const html = await response.text();
  state.cache.set(key, html);
  return html;
}

function renderShell(shell: string, page: Page): string {
  const withoutHydration = shell.replace(/<script id="_R_">globalThis\.__EXPO_ROUTER_HYDRATE__=true;<\/script>/, '');
  const withHead = withoutHydration.replace(/<meta charSet="utf-8"\/>/, (match) => `${match}${metadataTags(page.metadata)}`);
  const rootStart = withHead.indexOf('<div id="root">');
  const rootEnd = withHead.indexOf('<script', rootStart);
  if (rootStart < 0 || rootEnd < 0) throw new Error('SPA shell has no #root');
  const root = `<div id="root">${page.summary}</div><script type="application/ld+json">${page.jsonLd}</script>`;
  return withHead.slice(0, rootStart) + root + withHead.slice(rootEnd);
}

export async function ssrFallback(request: ImmutableRequest): Promise<Response | undefined> {
  if (request.headers.get(SHELL_HEADER) === '1' || isLoaderDataRequest(request)) return undefined;
  const pathname = new URL(request.url).pathname;
  const page = await resolvePage(request, pathname);
  trace('ssrFallback', request, {kind: page instanceof Response ? page.status : page?.kind ?? null});
  if (page === undefined || page instanceof Response) return page;
  const html = renderShell(await shellFor(request, page.template), page);
  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': HTML_CACHE,
      'Content-Security-Policy': ENFORCED_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}
