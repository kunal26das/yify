import {Image} from 'expo-image';
import * as Linking from 'expo-linking';
import {Platform, StyleSheet} from 'react-native';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {Analytics} from '@/presentation/analytics/events';
import {distributionChannel, storeLink} from '../constants/storeLinks';

export {PLAY_STORE_URL} from '../constants/storeLinks';

export async function openPlayStore(source: string): Promise<void> {
    Analytics.playStoreOpen(source);
    const {url, appUri} = storeLink();
    if (Platform.OS === 'android' && appUri) {
        try {
            if (await Linking.canOpenURL(appUri)) {
                await Linking.openURL(appUri);
                return;
            }
        } catch {
        }
    }
    await Linking.openURL(url);
}

const BADGE = require('../../../assets/images/google-play-badge.png');

const CANVAS = {width: 646, height: 250};
const ARTWORK_HEIGHT = 168;

const ARTWORK_TARGET_HEIGHT = 40;
const IMAGE_HEIGHT = Math.round(ARTWORK_TARGET_HEIGHT * (CANVAS.height / ARTWORK_HEIGHT));
const IMAGE_WIDTH = Math.round(IMAGE_HEIGHT * (CANVAS.width / CANVAS.height));

const BLEED = Math.round(IMAGE_HEIGHT * (41 / CANVAS.height));

export function PlayStoreButton({source}: {source: string}) {
    const {colors} = usePalette();

    if (Platform.OS === 'android') return null;

    const link = storeLink();

    if (distributionChannel() !== 'play') {
        return (
            <PressableScale
                onPress={() => void openPlayStore(source)}
                accessibilityRole="link"
                accessibilityLabel={`Download Yify from ${link.label}`}
                pressedScale={0.95}
                pressedOpacity={0.85}
                hoveredScale={1.04}
                style={styles.hit}
                contentStyle={styles.hit}
            >
                <ThemedText style={[styles.fallbackLabel, {color: colors.accent}]}>
                    Download from {link.label}
                </ThemedText>
            </PressableScale>
        );
    }

    return (
        <PressableScale
            onPress={() => void openPlayStore(source)}
            accessibilityRole="link"
            accessibilityLabel="Get it on Google Play"
            pressedScale={0.95}
            pressedOpacity={0.85}
            hoveredScale={1.04}
            style={styles.hit}
            contentStyle={styles.hit}
        >
            <Image
                source={BADGE}
                style={styles.image}
                contentFit="contain"
                accessibilityElementsHidden
            />
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    hit: {alignSelf: 'flex-start', overflow: 'hidden'},
    image: {height: IMAGE_HEIGHT, width: IMAGE_WIDTH, margin: -BLEED},
    fallbackLabel: {fontSize: 15, fontWeight: '600'},
});
