import {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {YoutubePlayer} from './YoutubePlayer';

export function HeroTrailerLayer({
    videoId,
    width,
    height,
    muted,
    controls = false,
    captions = false,
    onStarted,
}: {
    videoId: string;
    width: number;
    height: number;
    muted: boolean;
    controls?: boolean;
    captions?: boolean;
    onStarted?: () => void;
}) {
    const [started, setStarted] = useState(false);

    useEffect(() => {
        setStarted(false);
    }, [videoId]);

    const widthLed = width * 9 / 16 >= height;
    const videoWidth = widthLed ? width : Math.ceil((height * 16) / 9);
    const videoHeight = widthLed ? Math.ceil((width * 9) / 16) : height;

    return (
        <View
            style={[StyleSheet.absoluteFill, styles.clip, started ? null : styles.hidden]}
            pointerEvents="box-none"
        >
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
                    captions={captions}
                    onPlaybackStarted={() => {
                        setStarted(true);
                        onStarted?.();
                    }}
                />
            </View>

            {controls ? null : <View style={StyleSheet.absoluteFill}/>}
        </View>
    );
}

const styles = StyleSheet.create({
    clip: {overflow: 'hidden'},
    hidden: {opacity: 0},
});
