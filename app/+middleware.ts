import type {MiddlewareFunction} from 'expo-router/server';
import {legacyRedirect} from '@/server/middleware/legacyRedirects';

export const unstable_settings = {
  matcher: {methods: ['GET', 'HEAD'], patterns: ['/movies', '/shows', '/movie/[id]', '/show/[imdbId]']},
};

const middleware: MiddlewareFunction = (request) => legacyRedirect(request);

export default middleware;
