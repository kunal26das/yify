import {StyleSheet, View} from 'react-native';

// On web, react-native-youtube-iframe can't render (it depends on react-native-webview, which has
// no web implementation), so embed YouTube with a real <iframe> instead. Metro serves this file
// on web and the native YoutubePlayer.tsx on iOS/Android.
export function YoutubePlayer({
    videoId,
    width,
    autoplay = false,
}: {
    videoId: string;
    width: number;
    autoplay?: boolean;
}) {
    const height = Math.round((width * 9) / 16);
    const params = new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
        ...(autoplay ? {autoplay: '1'} : {}),
    });
    // youtube-nocookie.com is a separate origin from youtube.com, so the embed can't read the
    // viewer's YouTube login cookies — it plays anonymously and isn't tied to their account (which
    // otherwise surfaces sign-in/verification prompts, e.g. for a blocked account).
    const src = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;

    return (
        <View style={[styles.container, {width, height}]}>
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
