import {StyleSheet, View} from 'react-native';

// On web, react-native-youtube-iframe can't render (it depends on react-native-webview, which has
// no web implementation), so embed YouTube with a real <iframe> instead. Metro serves this file
// on web and the native YoutubePlayer.tsx on iOS/Android.
export function YoutubePlayer({
    videoId,
    width,
    height,
    autoplay = false,
    muted = false,
    loop = false,
    controls = true,
}: {
    videoId: string;
    width: number;
    /** Defaults to 16:9 against `width`. Pass explicitly to letterbox-free cover a taller box. */
    height?: number;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
}) {
    const resolvedHeight = height ?? Math.round((width * 9) / 16);
    const params = new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
        controls: controls ? '1' : '0',
        ...(autoplay ? {autoplay: '1'} : {}),
        // Browsers only honour autoplay for muted video, so the background hero trailer must ask
        // for mute up front rather than muting after the fact.
        ...(muted ? {mute: '1'} : {}),
        // A single-video loop needs `playlist` set to the same id — YouTube ignores `loop` alone.
        ...(loop ? {loop: '1', playlist: videoId} : {}),
    });
    // youtube-nocookie.com is a separate origin from youtube.com, so the embed can't read the
    // viewer's YouTube login cookies — it plays anonymously and isn't tied to their account (which
    // otherwise surfaces sign-in/verification prompts, e.g. for a blocked account).
    const src = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;

    return (
        <View style={[styles.container, {width, height: resolvedHeight}]}>
            <iframe
                title="Trailer"
                src={src}
                style={{width: '100%', height: '100%', border: 0, display: 'block'}}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {overflow: 'hidden'},
});
