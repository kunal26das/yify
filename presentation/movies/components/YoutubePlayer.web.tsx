import {StyleSheet, View} from 'react-native';

export function YoutubePlayer({
    videoId,
    width,
    height,
    autoplay = false,
    muted = false,
    loop = false,
    controls = true,
    onPlaybackStarted,
}: {
    videoId: string;
    width: number;
    height?: number;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    onPlaybackStarted?: () => void;
}) {
    const resolvedHeight = height ?? Math.round((width * 9) / 16);
    const params = new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
        controls: controls ? '1' : '0',
        ...(autoplay ? {autoplay: '1'} : {}),
        ...(muted ? {mute: '1'} : {}),
        ...(loop ? {loop: '1', playlist: videoId} : {}),
    });
    const src = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;

    return (
        <View style={[styles.container, {width, height: resolvedHeight}]}>
            <iframe
                title="Trailer"
                src={src}
                style={{width: '100%', height: '100%', border: 0, display: 'block'}}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                onLoad={onPlaybackStarted}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {overflow: 'hidden'},
});
