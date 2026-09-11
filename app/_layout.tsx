import {useEffect} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {DarkTheme, DefaultTheme, ErrorBoundary as ExpoErrorBoundary, router, Stack, ThemeProvider, usePathname} from 'expo-router';
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import {StatusBar} from 'expo-status-bar';
import {ReduceMotion, ReducedMotionConfig} from 'react-native-reanimated';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {Platform, StyleSheet, View} from 'react-native';
import {SafeAreaInsetsContext, SafeAreaProvider} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {HankenGrotesk_400Regular} from '@expo-google-fonts/hanken-grotesk/400Regular';
import {HankenGrotesk_500Medium} from '@expo-google-fonts/hanken-grotesk/500Medium';
import {HankenGrotesk_600SemiBold} from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import {HankenGrotesk_700Bold} from '@expo-google-fonts/hanken-grotesk/700Bold';
import {HankenGrotesk_800ExtraBold} from '@expo-google-fonts/hanken-grotesk/800ExtraBold';
import {Fraunces_600SemiBold} from '@expo-google-fonts/fraunces/600SemiBold';
import {Fraunces_700Bold} from '@expo-google-fonts/fraunces/700Bold';
import {Fraunces_900Black} from '@expo-google-fonts/fraunces/900Black';

import {
    BlurTargetProvider,
    BlurTargetSurface,
    Colors,
    ConfirmProvider,
    DependenciesProvider,
    OfflineBanner,
    PlayerHost,
    PlayerProvider,
    SystemBars,
    SupporterProvider,
    ToastProvider,
    TopBar,
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
            <ConfirmProvider>
                <SupporterProvider>
                <ToastProvider>
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
                </ToastProvider>
                </SupporterProvider>
            </ConfirmProvider>
            <OfflineBanner/>
            <UpdateSnackbar/>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'}/>
            <SystemBars/>
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

export const ErrorBoundary = Sentry.wrapExpoRouterErrorBoundary(ExpoErrorBoundary);

export default Sentry.wrap(RootLayout);
