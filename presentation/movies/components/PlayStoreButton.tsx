import Constants from 'expo-constants';
import {Image} from 'expo-image';
import * as Linking from 'expo-linking';
import {Platform, Pressable, StyleSheet} from 'react-native';
import {Analytics} from '@/lib/analytics-events';

const PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'io.github.kunal26das.yify';

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;

const PLAY_STORE_APP_URI = `market://details?id=${PACKAGE_NAME}`;

export async function openPlayStore(source: string): Promise<void> {
    Analytics.playStoreOpen(source);
    if (Platform.OS === 'android') {
        try {
            if (await Linking.canOpenURL(PLAY_STORE_APP_URI)) {
                await Linking.openURL(PLAY_STORE_APP_URI);
                return;
            }
        } catch {
        }
    }
    await Linking.openURL(PLAY_STORE_URL);
}

const BADGE = require('../../../assets/images/google-play-badge.png');

const CANVAS = {width: 646, height: 250};
const ARTWORK_HEIGHT = 168;

const ARTWORK_TARGET_HEIGHT = 40;
const IMAGE_HEIGHT = Math.round(ARTWORK_TARGET_HEIGHT * (CANVAS.height / ARTWORK_HEIGHT));
const IMAGE_WIDTH = Math.round(IMAGE_HEIGHT * (CANVAS.width / CANVAS.height));

const BLEED = Math.round(IMAGE_HEIGHT * (41 / CANVAS.height));

export function PlayStoreButton({source}: {source: string}) {
    if (Platform.OS === 'android') return null;

    return (
        <Pressable
            onPress={() => void openPlayStore(source)}
            accessibilityRole="link"
            accessibilityLabel="Get it on Google Play"
            style={({pressed}) => [styles.hit, {opacity: pressed ? 0.85 : 1}]}
        >
            <Image
                source={BADGE}
                style={styles.image}
                contentFit="contain"
                accessibilityElementsHidden
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    hit: {alignSelf: 'flex-start', overflow: 'hidden'},
    image: {height: IMAGE_HEIGHT, width: IMAGE_WIDTH, margin: -BLEED},
});
