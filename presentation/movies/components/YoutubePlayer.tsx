import { StyleSheet, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';

export function YoutubePlayer({ videoId, width }: { videoId: string; width: number }) {
  const height = Math.round((width * 9) / 16);
  return (
    <View style={[styles.container, { height }]}>
      <YoutubeIframe height={height} width={width} videoId={videoId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
