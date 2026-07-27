import {StyleSheet, View} from 'react-native';
import {YoutubePlayer} from './YoutubePlayer';

/**
 * A 16:9 trailer scaled to *cover* the hero box rather than letterbox inside it.
 *
 * The billboard is far taller than 16:9 on phones, so fitting the video to the width would leave
 * black bars top and bottom. Instead the video is blown up until both axes are filled and the
 * overflow is clipped — the same crop Netflix uses for its background trailers.
 */
export function HeroTrailerLayer({
    videoId,
    width,
    height,
    muted,
    controls = false,
}: {
    videoId: string;
    width: number;
    height: number;
    muted: boolean;
    controls?: boolean;
}) {
    const widthLed = width * 9 / 16 >= height;
    const videoWidth = widthLed ? width : Math.ceil((height * 16) / 9);
    const videoHeight = widthLed ? Math.ceil((width * 9) / 16) : height;

    return (
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="box-none">
            <View
                style={{
                    position: 'absolute',
                    width: videoWidth,
                    height: videoHeight,
                    left: (width - videoWidth) / 2,
                    top: (height - videoHeight) / 2,
                }}
            >
                <YoutubePlayer
                    videoId={videoId}
                    width={videoWidth}
                    height={videoHeight}
                    autoplay
                    muted={muted}
                    loop={!controls}
                    controls={controls}
                />
            </View>

            {/* The ambient trailer is scenery, not a player, so the pointer must never reach it —
                otherwise YouTube fades in its own title bar and transport controls on hover. A
                `pointerEvents="none"` wrapper is not enough: React Native Web writes
                `pointer-events: auto` onto child views, which overrides the parent for the iframe
                below. A transparent pane over the video is what actually keeps hover off it. */}
            {controls ? null : <View style={StyleSheet.absoluteFill}/>}
        </View>
    );
}

const styles = StyleSheet.create({
    clip: {overflow: 'hidden'},
});
