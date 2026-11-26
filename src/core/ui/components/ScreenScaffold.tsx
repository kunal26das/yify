import {pageTitle} from '@/core/config/seo';
import {useFocusEffect} from 'expo-router';
import Head from 'expo-router/head';
import type {ReactNode} from 'react';
import {useCallback, useRef} from 'react';
import type {HostInstance} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import type {FocusTarget} from '../layout/mainContent';
import {setMainContent} from '../layout/mainContent';
import {useHydrated} from '../layout/useWindowClass';
import {useTheme} from '../theme/useTheme';
import {OfflineBanner} from './OfflineBanner';
import {PageTitle} from './PageTitle';

export interface ScreenScaffoldProps {
  topBar?: ReactNode;
  title: string;
  documentTitle?: string;
  width?: 'grid' | 'reading' | 'full';
  heading?: 'scaffold' | 'screen';
  children: ReactNode;
}

export const MAIN_ID = 'main';

let focusedScreens = 0;

export function ScreenScaffold({topBar, title, documentTitle, width = 'grid', heading = 'scaffold', children}: ScreenScaffoldProps) {
  const theme = useTheme();
  const hydrated = useHydrated();
  const main = useRef<HostInstance>(null);

  useFocusEffect(useCallback(() => {
    if (!IS_WEB) return undefined;
    const node = main.current as unknown as FocusTarget | null;
    setMainContent(node);
    if (focusedScreens > 0) node?.focus({preventScroll: true});
    focusedScreens += 1;
    return () => setMainContent(null);
  }, []));

  const webMain = (IS_WEB ? {tabIndex: -1 as const} : {});
  const maxWidth = width === 'full' ? undefined : theme.layout.maxContentWidth[width];

  return (
    <View
      ref={main}
      {...webMain}
      role="main"
      nativeID={MAIN_ID}
      dataSet={{screen: ''}}
      style={[styles.root, {backgroundColor: theme.colors.surface}]}
    >
      {hydrated ? <Head><title>{documentTitle ?? pageTitle(title)}</title></Head> : null}
      {topBar ? <View dataSet={{topAppBar: ''}}>{topBar}</View> : null}
      <OfflineBanner/>
      <View style={[styles.content, {maxWidth}]}>
        {heading === 'scaffold' ? (
          <View style={{paddingHorizontal: theme.layout.gutter.expanded}}>
            <PageTitle title={title}/>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {flex: 1, width: '100%', alignSelf: 'center'},
});
