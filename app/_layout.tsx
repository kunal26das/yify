import {Stack} from 'expo-router';
import {AppRoot} from '@/features/shell/public/AppRoot';

export {RootErrorBoundary as ErrorBoundary} from '@/features/shell/public/RootErrorBoundary';

export default function RootLayout() {
  return (
    <AppRoot>
      <Stack screenOptions={{headerShown: false}}>
        <Stack.Screen name="(tabs)"/>
        <Stack.Screen name="movie/[id]"/>
        <Stack.Screen name="show/[imdbId]"/>
        <Stack.Screen name="+not-found"/>
      </Stack>
    </AppRoot>
  );
}
