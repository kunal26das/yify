import {useEffect} from 'react';
import {DarkTheme, DefaultTheme, router, Stack, ThemeProvider} from 'expo-router';
import * as Notifications from 'expo-notifications';
import {StatusBar} from 'expo-status-bar';
import 'react-native-reanimated';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
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

import {Colors, useColorScheme, useIsFrostedDesktop, useIsMacDesktop} from '@/presentation';
import {initRemoteConfig} from '@/lib/remote-config';
import {registerNewMoviesTask, requestNotificationPermission} from '@/lib/new-movies-task';

void initRemoteConfig();
// Push notifications / background tasks are native-only; expo-notifications throws
// on web (e.g. ExpoNotifications.getLastNotificationResponse is unavailable).
if (Platform.OS !== 'web') {
    void requestNotificationPermission().then(() => registerNewMoviesTask());
}

function handleNotificationData(data: unknown) {
    const movieId = (data as { movieId?: number } | null)?.movieId;
    if (typeof movieId === 'number') {
        router.push(`/movie/${movieId}`);
    }
}

// Top space reserved for the macOS title bar / traffic lights. Mirrors
// TITLEBAR_INSET in desktop/main.js. Surfaced as a safe-area inset so the
// existing safe-area-aware layouts render edge-to-edge but clear the controls.
const DESKTOP_TOP_INSET = 44;

function RootLayout() {
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
    // Notification taps only exist on native; the hook throws on web. Platform.OS
    // is constant for the runtime, so this conditional call keeps hook order stable.
    const lastResponse =
        Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();
    const navReady = fontsLoaded || !!fontError;
    useEffect(() => {
        if (!lastResponse || !navReady) return;
        handleNotificationData(lastResponse.notification.request.content.data);
    }, [lastResponse, navReady]);

    const colorScheme = useColorScheme();
    // macOS uses a frameless overlay needing a top inset; macOS + Windows both get
    // a translucent window the navigator must not paint over.
    const isMacDesktop = useIsMacDesktop();
    const isFrosted = useIsFrostedDesktop();

    const scheme = colorScheme === 'dark' ? 'dark' : 'light';
    const palette = Colors[scheme];
    const navBase = scheme === 'dark' ? DarkTheme : DefaultTheme;
    // Align the navigator chrome with the cinematic palette so there is no
    // white flash between screen transitions.
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
    // On frosted desktops the window is translucent; keep the navigator transparent
    // so it shows through instead of painting a solid background.
    const theme = isFrosted
        ? {...baseTheme, colors: {...baseTheme.colors, background: 'transparent', card: 'transparent'}}
        : baseTheme;

    // Hold the first paint until the bundled typefaces are ready (or failed) so
    // text doesn't flash in the system font and reflow. The native splash
    // screen stays up in the meantime.
    if (!fontsLoaded && !fontError) {
        return null;
    }

    const content = (
        <ThemeProvider value={theme}>
            <Stack>
                <Stack.Screen name="index" options={{headerShown: false}}/>
                <Stack.Screen name="movie/[id]" options={{headerShown: false}}/>
            </Stack>
            <StatusBar style="auto"/>
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

// CodePush/Revopush ships over-the-air JS bundles to the native builds only.
// Web and the Electron desktop target (react-native-web) have no native module,
// and importing it under static web/node rendering crashes (it destructures
// `Alert` from react-native's node export), so require it lazily on native only.
function withCodePush(component: typeof RootLayout) {
    if (Platform.OS === 'web') {
        return component;
    }
    const codePush = require('@revopush/react-native-code-push').default;
    return codePush({checkFrequency: codePush.CheckFrequency.ON_APP_RESUME})(component);
}

export default withCodePush(RootLayout);
