import type {MiddlewareFunction} from 'expo-router/server';
import {legacyRedirect} from '@/server/middleware/legacyRedirects';
import {ssrFallback} from '@/server/seo/ssrFallback';

export const unstable_settings = {
  matcher: {
    methods: ['GET', 'HEAD'],
    patterns: ['/movies', '/shows', '/movie/[id]', '/show/[imdbId]', '/title/movie/[id]', '/title/tv/[id]', '/person/[id]'],
  },
};

const middleware: MiddlewareFunction = async (request) => legacyRedirect(request) ?? ssrFallback(request);

export default middleware;
