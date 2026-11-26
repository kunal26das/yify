import {StyleSheet, View} from 'react-native';
import {useOfflineBannerVisible} from '../connectivity';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {Text} from './Text';

export const OFFLINE_MESSAGE = "You're offline. Showing what's saved on this device.";

export function OfflineBanner() {
  const theme = useTheme();
  const visible = useOfflineBannerVisible();
  return (
    <View role="status">
      {visible ? (
        <View style={[styles.banner, {gap: theme.space.md, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md, backgroundColor: theme.colors.errorContainer}]}>
          <Icon name="cloud_off" size={20} color="onErrorContainer"/>
          <Text variant="bodyMedium" color="onErrorContainer" style={styles.text}>{OFFLINE_MESSAGE}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {flexDirection: 'row', alignItems: 'center'},
  text: {flex: 1},
});
