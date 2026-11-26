import {ScrollViewStyleReset, useServerDocumentContext} from 'expo-router/html';
import type {ReactNode} from 'react';

export function WebDocument({children}: {children: ReactNode}) {
  const {htmlAttributes, headNodes, bodyAttributes, bodyNodes} = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8"/>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"/>
        <link rel="manifest" href="/manifest.json"/>
        <ScrollViewStyleReset/>
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
