import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';

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
  const [playing, setPlaying] = useState(autoplay);

  useEffect(() => {
    setPlaying(autoplay);
  }, [autoplay, videoId]);

  return (
    <View style={[styles.container, { height: resolvedHeight }]}>
      <YoutubeIframe
        height={resolvedHeight}
        width={width}
        videoId={videoId}
        play={playing}
        mute={muted}
        forceAndroidAutoplay={autoplay}
        onChangeState={(state: string) => {
          // A looping background trailer restarts itself instead of settling into a paused frame.
          if (state === 'ended') setPlaying(loop);
          else if (state === 'paused') setPlaying(false);
          else if (state === 'playing') setPlaying(true);
        }}
        initialPlayerParams={{ controls, modestbranding: true, rel: false, loop }}
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
