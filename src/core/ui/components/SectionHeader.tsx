import type {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTheme} from '../theme/useTheme';
import {Button} from './Button';
import {Heading, Text} from './Text';

export interface SectionHeaderAction {
  label: string;
  accessibilityLabel: string;
  href?: string;
  onPress?: () => void;
}

export interface SectionHeaderProps {
  title: string;
  level?: 2 | 3;
  subtitle?: string;
  action?: SectionHeaderAction;
  trailing?: ReactNode;
  nativeID?: string;
}

export function SectionHeader({title, level = 2, subtitle, action, trailing, nativeID}: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, {gap: theme.space.sm}]}>
      <View style={styles.titles}>
        <Heading level={level} variant={level === 2 ? 'titleLarge' : 'titleMedium'} nativeID={nativeID}>{title}</Heading>
        {subtitle ? <Text variant="bodyMedium" color="onSurfaceVariant">{subtitle}</Text> : null}
      </View>
      {action ? (
        <Button
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          href={action.href}
          onPress={action.onPress}
          variant="text"
          trailingIcon="chevron_right"
        />
      ) : null}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  titles: {flex: 1, minWidth: 0},
});
