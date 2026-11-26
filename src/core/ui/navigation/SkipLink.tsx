import {StyleSheet} from 'react-native';
import {Text} from '../components/Text';
import {Touchable} from '../components/Touchable';
import {focusMainContent} from '../layout/mainContent';
import {useTheme} from '../theme/useTheme';

export const SKIP_LINK_LABEL = 'Skip to content';

export function SkipLink() {
  const theme = useTheme();
  return (
    <Touchable
      href="#main"
      onPress={focusMainContent}
      dataSet={{skipLink: ''}}
      contentColor="onPrimary"
      shape="full"
      style={[styles.link, {top: theme.space.sm, left: theme.space.sm, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm, backgroundColor: theme.colors.primary}]}
    >
      <Text variant="labelLarge" color="onPrimary">{SKIP_LINK_LABEL}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({link: {position: 'absolute', zIndex: 50}});
