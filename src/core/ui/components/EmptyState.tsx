import {StyleSheet, View} from 'react-native';
import type {IconName} from '../icons/glyphs';
import {useTheme} from '../theme/useTheme';
import {Button} from './Button';
import {Icon} from './Icon';
import {Heading, Text} from './Text';

export interface StateAction {
  label: string;
  onPress?: () => void;
  href?: string;
}

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  primary?: StateAction;
  secondary?: StateAction;
  size?: 'page' | 'section';
}

export function EmptyState({icon, title, body, primary, secondary, size = 'page'}: EmptyStateProps) {
  const theme = useTheme();
  const page = size === 'page';
  return (
    <View style={[styles.column, {gap: page ? theme.space.md : theme.space.sm, paddingVertical: page ? theme.space.xxxl : theme.space.xl, paddingHorizontal: theme.space.lg}]}>
      <Icon name={icon} size={page ? 48 : 24} color="onSurfaceVariant"/>
      <Heading level={2} variant={page ? 'headlineSmall' : 'titleMedium'} align="center">{title}</Heading>
      {body ? <Text variant={page ? 'bodyLarge' : 'bodyMedium'} color="onSurfaceVariant" align="center" style={styles.body}>{body}</Text> : null}
      {primary || secondary ? (
        <View style={[styles.actions, {gap: theme.space.sm, marginTop: theme.space.sm}]}>
          {primary ? <Button label={primary.label} onPress={primary.onPress} href={primary.href} variant="filled"/> : null}
          {secondary ? <Button label={secondary.label} onPress={secondary.onPress} href={secondary.href} variant="text"/> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {alignItems: 'center', alignSelf: 'stretch'},
  body: {maxWidth: 480},
  actions: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center'},
});
