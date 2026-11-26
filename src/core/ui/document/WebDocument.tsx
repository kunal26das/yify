import {ScrollViewStyleReset, useServerDocumentContext} from 'expo-router/html';
import type {ReactNode} from 'react';
import {themeColorFor, WEB_FONT_PRELOADS, webDocumentCss} from '../theme/webCss';

export function WebDocument({children}: {children: ReactNode}) {
  const {htmlAttributes, headNodes, bodyAttributes, bodyNodes} = useServerDocumentContext();
  return (
    <html lang="en" data-theme="dark" data-accent="default" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8"/>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"/>
        <meta name="theme-color" content={themeColorFor('dark')}/>
        <link rel="manifest" href="/manifest.json"/>
        {WEB_FONT_PRELOADS.map((font) => <link key={font.href} rel="preload" as="font" type={font.type} href={font.href} crossOrigin="anonymous"/>)}
        <ScrollViewStyleReset/>
        <style dangerouslySetInnerHTML={{__html: webDocumentCss()}}/>
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
