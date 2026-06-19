import {DarkTheme, DefaultTheme, Stack, ThemeProvider} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import 'react-native-reanimated';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {useColorScheme} from '@/presentation';
import {initRemoteConfig} from '@/lib/remote-config';

void initRemoteConfig();

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <GestureHandlerRootView style={styles.flex}>
            <SafeAreaProvider>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <Stack>
                        <Stack.Screen name="index" options={{headerShown: false}}/>
                    </Stack>
                    <StatusBar style="auto"/>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
