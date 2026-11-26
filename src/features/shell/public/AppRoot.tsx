import type {JSX, ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ReduceMotion, ReducedMotionConfig} from 'react-native-reanimated';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {Preferences} from '@/core/domain/preferences';
import {QueryProvider} from '@/core/query/QueryProvider';
import {ConfirmProvider} from '@/core/ui/components/ConfirmDialog';
import {SnackbarHost} from '@/core/ui/components/SnackbarHost';
import {ThemeProvider} from '@/core/ui/theme/ThemeProvider';
import {AdTransitionHost} from '@/features/monetization/public/AdTransitionHost';
import {effectiveAccent, usePlus} from '@/features/monetization/public/plus';
import {PlusSheetHost} from '@/features/monetization/public/PlusSheetHost';
import {ConsentPrompt} from '@/features/settings/public/ConsentPrompt';
import {usePreferences} from '@/features/settings/public/preferences';
import {prepareLocalState, startApp} from '../start';

function selectTheme(preferences: Preferences): Preferences['theme'] {
  return preferences.theme;
}

function selectAccent(preferences: Preferences): Preferences['accent'] {
  return preferences.accent;
}

function ThemedApp({children}: {children: ReactNode}) {
  const preference = usePreferences(selectTheme);
  const stored = usePreferences(selectAccent);
  const {status} = usePlus();
  return (
    <ThemeProvider preference={preference} accent={effectiveAccent({stored, status, fallback: 'default'})}>
      <SnackbarHost>
        <ConfirmProvider>
          <ReducedMotionConfig mode={ReduceMotion.System}/>
          {children}
          <PlusSheetHost/>
          <ConsentPrompt/>
          <AdTransitionHost/>
        </ConfirmProvider>
      </SnackbarHost>
    </ThemeProvider>
  );
}

export function AppRoot(props: {children: ReactNode}): JSX.Element {
  useState(prepareLocalState);
  useEffect(() => {
    startApp();
  }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryProvider>
          <ThemedApp>{props.children}</ThemedApp>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({root: {flex: 1}});
