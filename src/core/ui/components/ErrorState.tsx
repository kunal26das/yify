import {useEffect} from 'react';
import {AccessibilityInfo, StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import {useTheme} from '../theme/useTheme';
import {Button} from './Button';
import {Icon} from './Icon';
import {Text} from './Text';

export interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry: () => void;
  size?: 'page' | 'section' | 'inline';
}

export const ERROR_COPY = {
  title: "Couldn't load this",
  body: 'Check your connection and try again.',
  retry: 'Try again',
} as const;

export function ErrorState({title = ERROR_COPY.title, body = ERROR_COPY.body, onRetry, size = 'page'}: ErrorStateProps) {
  const theme = useTheme();
  useEffect(() => {
    if (!IS_WEB) AccessibilityInfo.announceForAccessibility(title);
  }, [title]);
  if (size === 'inline') {
    return (
      <View style={[styles.inline, {gap: theme.space.sm, paddingVertical: theme.space.sm}]}>
        <Icon name="error" size={20} color="error"/>
        <View role="alert" style={styles.grow}>
          <Text variant="bodyMedium">{title}</Text>
        </View>
        <Button label={ERROR_COPY.retry} variant="text" onPress={onRetry}/>
      </View>
    );
  }
  const page = size === 'page';
  return (
    <View style={[styles.column, {gap: page ? theme.space.md : theme.space.sm, paddingVertical: page ? theme.space.xxxl : theme.space.xl, paddingHorizontal: theme.space.lg}]}>
      <Icon name="error" size={page ? 48 : 24} color="error"/>
      <View role="alert">
        <Text variant={page ? 'headlineSmall' : 'titleMedium'} align="center">{title}</Text>
      </View>
      <Text variant={page ? 'bodyLarge' : 'bodyMedium'} color="onSurfaceVariant" align="center" style={styles.body}>{body}</Text>
      <View style={{marginTop: theme.space.sm}}>
        <Button label={ERROR_COPY.retry} variant="tonal" icon="refresh" onPress={onRetry}/>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {alignItems: 'center', alignSelf: 'stretch'},
  body: {maxWidth: 480},
  inline: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'},
  grow: {flexShrink: 1, flexGrow: 1},
});
