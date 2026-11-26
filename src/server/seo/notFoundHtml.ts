import {APP_NAME} from '@/core/config/app';

export function notFoundHtml(kind: 'title' | 'person'): string {
  const heading = kind === 'person' ? 'We could not find this person' : 'We could not find this title';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>Not found · ${APP_NAME}</title></head>`,
    `<body><main><h1>${heading}</h1><p><a href="/">Go to ${APP_NAME} home</a></p></main></body></html>`,
  ].join('');
}
