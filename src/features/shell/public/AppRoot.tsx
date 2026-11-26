import type {ReactNode} from 'react';
import {StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {QueryProvider} from '@/core/query/QueryProvider';

export function AppRoot({children}: {children: ReactNode}) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryProvider>{children}</QueryProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({root: {flex: 1}});
