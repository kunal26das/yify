import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {DarkTheme, DefaultTheme, ThemeProvider} from '@react-navigation/native';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import 'react-native-reanimated';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {useColorScheme} from '@/hooks/use-color-scheme';
import {getFirebaseApp} from '@/lib/firebase';

getFirebaseApp();

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <GestureHandlerRootView style={styles.flex}>
            <BottomSheetModalProvider>
                <SafeAreaProvider>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <Stack>
                        <Stack.Screen name="index" options={{headerShown: false}}/>
                    </Stack>
                    <StatusBar style="auto"/>
                </ThemeProvider>
            </SafeAreaProvider>
            </BottomSheetModalProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
