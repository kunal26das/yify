import type {JSX} from 'react';
import {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import type {TitleKey} from '@/core/domain/keys';
import type {Video} from '@/core/domain/title';
import {openUrl} from '@/core/platform/openUrl';
import {Button} from '@/core/ui/components/Button';
import {Sheet} from '@/core/ui/components/Sheet';
import {setPlayerOpen} from '@/core/ui/overlays';
import {useTheme} from '@/core/ui/theme/useTheme';

export interface TrailerFrameProps {
  open: boolean;
  onClose: () => void;
  video: Video;
  title: string;
  titleKey: TitleKey;
  surface: 'title' | 'home';
  backdropPath?: string | null;
}

export function TrailerFrame(props: TrailerFrameProps): JSX.Element | null {
  const {open, onClose, video, title} = props;
  const theme = useTheme();
  useEffect(() => {
    setPlayerOpen(open);
    return () => setPlayerOpen(false);
  }, [open]);
  const watchOnYouTube = () => {
    void openUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}`, {external: true});
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Trailer: ${title}`}>
      <View style={[styles.body, {paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xl}]}>
        <Button label="Watch on YouTube" icon="open_in_new" onPress={watchOnYouTube}/>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({body: {alignItems: 'flex-start'}});
