import {useEffect} from 'react';
import {DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname} from 'expo-router';
import * as Notifications from 'expo-notifications';
import {StatusBar} from 'expo-status-bar';
import {ReduceMotion, ReducedMotionConfig} from 'react-native-reanimated';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {Platform, StyleSheet} from 'react-native';
import {SafeAreaInsetsContext, SafeAreaProvider} from 'react-native-safe-area-context';
import {
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import {Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_900Black} from '@expo-google-fonts/fraunces';

import {
    Colors,
    DependenciesProvider,
    PlayerHost,
    PlayerProvider,
    UpdateSnackbar,
    useColorScheme,
    useIsFrostedDesktop,
    useIsMacDesktop,
} from '@/presentation';
import {bootstrap, createDependencies} from '@/data';
import {Analytics, installAnalyticsSink} from '@/presentation/analytics/events';

const dependencies = createDependencies();
installAnalyticsSink(dependencies.analytics);
bootstrap(dependencies);

function handleNotificationData(data: unknown) {
    const movieId = (data as { movieId?: number } | null)?.movieId;
    if (typeof movieId === 'number') {
        Analytics.notificationOpen(movieId);
        router.push(`/movie/${movieId}`);
    }
}

const DESKTOP_TOP_INSET = 44;

function RootLayout() {
    return (
        <DependenciesProvider dependencies={dependencies}>
            <AppShell/>
        </DependenciesProvider>
    );
}

function AppShell() {
    const [fontsLoaded, fontError] = useFonts({
        HankenGrotesk_400Regular,
        HankenGrotesk_500Medium,
        HankenGrotesk_600SemiBold,
        HankenGrotesk_700Bold,
        HankenGrotesk_800ExtraBold,
        Fraunces_600SemiBold,
        Fraunces_700Bold,
        Fraunces_900Black,
    });
    const lastResponse =
        Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();
    const navReady = fontsLoaded || !!fontError;
    useEffect(() => {
        if (!lastResponse || !navReady) return;
        handleNotificationData(lastResponse.notification.request.content.data);
    }, [lastResponse, navReady]);

    const pathname = usePathname();
    useEffect(() => {
        Analytics.screenView(pathname);
    }, [pathname]);

    const colorScheme = useColorScheme();
    const isMacDesktop = useIsMacDesktop();
    const isFrosted = useIsFrostedDesktop();

    const scheme = colorScheme === 'dark' ? 'dark' : 'light';
    const palette = Colors[scheme];
    const navBase = scheme === 'dark' ? DarkTheme : DefaultTheme;
    const baseTheme = {
        ...navBase,
        colors: {
            ...navBase.colors,
            background: palette.background,
            card: palette.surface,
            text: palette.text,
            border: palette.border,
            primary: palette.accent,
        },
    };
    const theme = isFrosted
        ? {...baseTheme, colors: {...baseTheme.colors, background: 'transparent', card: 'transparent'}}
        : baseTheme;

    if (!fontsLoaded && !fontError) {
        return null;
    }

    const content = (
        <ThemeProvider value={theme}>
            <ReducedMotionConfig mode={ReduceMotion.System}/>
            <PlayerProvider>
                <Stack>
                    <Stack.Screen name="index" options={{headerShown: false}}/>
                    <Stack.Screen name="movies" options={{headerShown: false}}/>
                    <Stack.Screen name="watchlist" options={{headerShown: false}}/>
                    <Stack.Screen name="shows" options={{headerShown: false}}/>
                    <Stack.Screen name="show/[imdbId]" options={{headerShown: false}}/>
                    <Stack.Screen name="preferences" options={{headerShown: false}}/>
                    <Stack.Screen name="movie/[id]" options={{headerShown: false}}/>
                </Stack>
                <PlayerHost/>
            </PlayerProvider>
            <UpdateSnackbar/>
            <StatusBar style="auto"/>
        </ThemeProvider>
    );

    return (
        <GestureHandlerRootView style={styles.flex}>
            <SafeAreaProvider>
                <BottomSheetModalProvider>
                {isMacDesktop ? (
                    <SafeAreaInsetsContext.Provider
                        value={{top: DESKTOP_TOP_INSET, left: 0, right: 0, bottom: 0}}
                    >
                        {content}
                    </SafeAreaInsetsContext.Provider>
                ) : (
                    content
                )}
                </BottomSheetModalProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});

export default RootLayout;
