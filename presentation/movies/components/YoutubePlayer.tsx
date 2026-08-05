import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import {YOUTUBE_WEB_VIEW_PROPS} from '../../player/youtubeWebView';

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
          if (state === 'ended') setPlaying(loop);
          else if (state === 'paused') setPlaying(false);
          else if (state === 'playing') {
            setPlaying(true);
            onPlaybackStarted?.();
          }
        }}
        initialPlayerParams={{ controls, modestbranding: true, rel: false, loop }}
        webViewProps={YOUTUBE_WEB_VIEW_PROPS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
