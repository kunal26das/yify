import {useEffect, useRef} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {DarkTheme, DefaultTheme, ErrorBoundary as ExpoErrorBoundary, router, Stack, ThemeProvider, usePathname} from 'expo-router';
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import {StatusBar} from 'expo-status-bar';
import {ReduceMotion, ReducedMotionConfig} from 'react-native-reanimated';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {Platform, StyleSheet, View} from 'react-native';
import {SafeAreaInsetsContext, SafeAreaProvider} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {HankenGrotesk_400Regular} from '@expo-google-fonts/hanken-grotesk/400Regular';
import {HankenGrotesk_500Medium} from '@expo-google-fonts/hanken-grotesk/500Medium';
import {HankenGrotesk_600SemiBold} from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import {HankenGrotesk_700Bold} from '@expo-google-fonts/hanken-grotesk/700Bold';
import {HankenGrotesk_800ExtraBold} from '@expo-google-fonts/hanken-grotesk/800ExtraBold';
import {Lora_600SemiBold} from '@expo-google-fonts/lora/600SemiBold';
import {Lora_700Bold} from '@expo-google-fonts/lora/700Bold';

import {
    BlurTargetProvider,
    BlurTargetSurface,
    Colors,
    DependenciesProvider,
    OfflineBanner,
    OverlayProvider,
    PlayerHost,
    PlayerProvider,
    SystemBars,
    SupporterProvider,
    TopBar,
    UpdateSnackbar,
    useColorScheme,
    useIsFrostedDesktop,
    useIsMacDesktop,
} from '@/presentation';
import {bootstrap, createDependencies} from '@/data';
import {Analytics, installAnalyticsSink} from '@/presentation/analytics/events';
import {movieNotificationTarget} from '@/domain';

const dependencies = createDependencies();
installAnalyticsSink(dependencies.analytics);
bootstrap(dependencies);

function handleNotificationData(data: unknown) {
    const target = movieNotificationTarget(data);
    if (!target) return;
    Analytics.notificationOpen(target.movieId, target.kind);
    if (target.movieId) router.push(`/movie/${target.movieId}`);
    else router.push('/movies');
}

const DESKTOP_TOP_INSET = 48;

function RootLayout() {
    return (
        <DependenciesProvider dependencies={dependencies}>
            <AppShell/>
        </DependenciesProvider>
    );
}

function AppShell() {
    const [fontsLoaded, fontError] = useFonts({
        ...(Platform.OS === 'web' ? Ionicons.font : {}),
        HankenGrotesk_400Regular,
        HankenGrotesk_500Medium,
        HankenGrotesk_600SemiBold,
        HankenGrotesk_700Bold,
        HankenGrotesk_800ExtraBold,
        Lora_600SemiBold,
        Lora_700Bold,
    });
    const lastResponse =
        Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();
    const navReady = fontsLoaded || !!fontError;
    const handledNotification = useRef<string | null>(null);
    useEffect(() => {
        if (!lastResponse || !navReady) return;
        const identifier = lastResponse.notification.request.identifier;
        if (handledNotification.current === identifier) return;
        handledNotification.current = identifier;
        handleNotificationData(lastResponse.notification.request.content.data);
        void Notifications.clearLastNotificationResponseAsync().catch(() => {});
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
            <OverlayProvider>
                <SupporterProvider>
                <PlayerProvider>
                    <BlurTargetProvider>
                        <View style={styles.flex}>
                            <BlurTargetSurface>
                                <Stack screenOptions={{headerShown: false}}/>
                            </BlurTargetSurface>
                            <TopBar/>
                        </View>
                    </BlurTargetProvider>
                    <PlayerHost/>
                </PlayerProvider>
                </SupporterProvider>
            </OverlayProvider>
            <OfflineBanner/>
            <UpdateSnackbar/>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'}/>
            <SystemBars/>
        </ThemeProvider>
    );

    return (
        <GestureHandlerRootView style={styles.flex}>
            <SafeAreaProvider>
                {isMacDesktop ? (
                    <SafeAreaInsetsContext.Provider
                        value={{top: DESKTOP_TOP_INSET, left: 0, right: 0, bottom: 0}}
                    >
                        {content}
                    </SafeAreaInsetsContext.Provider>
                ) : (
                    content
                )}
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});

export const ErrorBoundary = Sentry.wrapExpoRouterErrorBoundary(ExpoErrorBoundary);

export default Sentry.wrap(RootLayout);
