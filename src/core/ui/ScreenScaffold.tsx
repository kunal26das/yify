import Head from 'expo-router/head';
import {type ReactNode, useSyncExternalStore} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {pageTitle} from '@/core/config/seo';

interface ScreenScaffoldProps {
  title: string;
  documentTitle?: string;
  heading?: boolean;
  children?: ReactNode;
}

const subscribeNothing = () => () => {};

export function ScreenScaffold({title, documentTitle, heading = true, children}: ScreenScaffoldProps) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return (
    <View role="main" nativeID="main" testID="screen" style={styles.root}>
      {mounted ? <Head><title>{documentTitle ?? pageTitle(title)}</title></Head> : null}
      {heading ? <Text role="heading" aria-level={1} style={styles.heading}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, padding: 16, gap: 12},
  heading: {},
});
