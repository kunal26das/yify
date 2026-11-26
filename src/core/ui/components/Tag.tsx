import {StyleSheet, View} from 'react-native';
import {useTheme} from '../theme/useTheme';
import {Text} from './Text';

export interface TagProps {
  label: string;
}

const PADDING_VERTICAL = 2;

export function Tag({label}: TagProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: theme.colors.primaryContainer,
          borderRadius: theme.shape.extraSmall,
          paddingHorizontal: theme.space.sm,
          paddingVertical: PADDING_VERTICAL,
        },
      ]}
    >
      <Text variant="labelMedium" color="onPrimaryContainer" numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({tag: {alignSelf: 'flex-start'}});
