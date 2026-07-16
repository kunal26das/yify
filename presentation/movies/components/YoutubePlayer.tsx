import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';

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
  const [playing, setPlaying] = useState(autoplay);

  return (
    <View style={[styles.container, { height }]}>
      <YoutubeIframe
        height={height}
        width={width}
        videoId={videoId}
        play={playing}
        forceAndroidAutoplay={autoplay}
        onChangeState={(state: string) => {
          if (state === 'ended' || state === 'paused') setPlaying(false);
          if (state === 'playing') setPlaying(true);
        }}
        initialPlayerParams={{ controls: true, modestbranding: true, rel: false }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          allowsFullscreenVideo: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
