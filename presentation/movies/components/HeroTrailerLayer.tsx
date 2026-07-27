import {StyleSheet, View} from 'react-native';
import {YoutubePlayer} from './YoutubePlayer';

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

            {controls ? null : <View style={StyleSheet.absoluteFill}/>}
        </View>
    );
}

const styles = StyleSheet.create({
    clip: {overflow: 'hidden'},
});
