import Constants from 'expo-constants';
import {Image} from 'expo-image';
import * as Linking from 'expo-linking';
import {Platform, Pressable, StyleSheet} from 'react-native';
import {Analytics} from '@/lib/analytics-events';

// Read from the app config so the link can't drift from what actually ships.
const PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'io.github.kunal26das.yify';

/**
 * The canonical listing URL. Google's linking guide specifies this form for anywhere outside an
 * Android app — web pages, ads, social — and it resolves on every platform.
 */
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;

/**
 * Android-only scheme that hands straight to the Play Store app. Without it, tapping the link on a
 * device opens a browser chooser first. Google's own recommendation is an ACTION_VIEW intent
 * pinned to `com.android.vending`, which React Native's Linking can't express — `market://` is the
 * equivalent that goes through a plain URL open, with the web listing as the fallback.
 */
const PLAY_STORE_APP_URI = `market://details?id=${PACKAGE_NAME}`;

/** Opens the store listing the best way the current platform allows. */
export async function openPlayStore(source: string): Promise<void> {
    Analytics.playStoreOpen(source);
    if (Platform.OS === 'android') {
        try {
            if (await Linking.canOpenURL(PLAY_STORE_APP_URI)) {
                await Linking.openURL(PLAY_STORE_APP_URI);
                return;
            }
        } catch {
            // No Play Store app, or the scheme is unhandled — fall through to the web listing.
        }
    }
    await Linking.openURL(PLAY_STORE_URL);
}

// Google's official badge artwork, used unmodified as the badge guidelines require: the colour and
// the arrangement of its elements may not be altered, and a self-made lookalike is not permitted.
const BADGE = require('../../../assets/images/google-play-badge.png');

// The asset is a 646x250 canvas holding 564x168 of artwork, i.e. a 41px transparent margin on every
// side. The guideline asks for clear space of one quarter of the badge height — 168/4 = 42 — so the
// file already carries it. Adding padding here would double it, which is what made the badge look
// adrift in its own box.
const CANVAS = {width: 646, height: 250};
const ARTWORK_HEIGHT = 168;

// Sized by the visible artwork rather than the canvas, so this is the height the badge actually
// reads at; the transparent margin then scales with it and stays exactly the mandated clear space.
const ARTWORK_TARGET_HEIGHT = 40;
const IMAGE_HEIGHT = Math.round(ARTWORK_TARGET_HEIGHT * (CANVAS.height / ARTWORK_HEIGHT));
const IMAGE_WIDTH = Math.round(IMAGE_HEIGHT * (CANVAS.width / CANVAS.height));

// The asset's transparent margin is baked into the file, so it otherwise shows up as dead space in
// the layout and the badge reads as adrift. Pulling the image in by that margin makes the layout box
// hug the artwork; the clear space is then supplied by real spacing from the neighbouring elements,
// which is what the rule is actually about.
const BLEED = Math.round(IMAGE_HEIGHT * (41 / CANVAS.height));

export function PlayStoreButton({source}: {source: string}) {
    // Pointless on an Android device — they already have it installed.
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
                // The badge carries its own wording; the link's label is on the Pressable above.
                accessibilityElementsHidden
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    hit: {alignSelf: 'flex-start', overflow: 'hidden'},
    image: {height: IMAGE_HEIGHT, width: IMAGE_WIDTH, margin: -BLEED},
});
