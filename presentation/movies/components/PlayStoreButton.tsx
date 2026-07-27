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

// Native size of the supplied asset. Kept as a ratio so the badge can be scaled without the
// elements inside it being rescaled relative to one another.
const BADGE_ASPECT = 646 / 250;
const BADGE_HEIGHT = 48;
// "The clear space surrounding the badge must be equal to one-quarter of the height of the badge."
const CLEAR_SPACE = BADGE_HEIGHT / 4;

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
                style={{height: BADGE_HEIGHT, width: Math.round(BADGE_HEIGHT * BADGE_ASPECT)}}
                contentFit="contain"
                // The badge carries its own wording; the link's label is on the Pressable above.
                accessibilityElementsHidden
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    hit: {alignSelf: 'flex-start', padding: CLEAR_SPACE},
});
