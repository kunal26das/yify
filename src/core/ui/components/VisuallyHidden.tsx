import {StyleSheet, View} from 'react-native';
import {Text} from './Text';

export interface VisuallyHiddenProps {
  children: string;
  live?: 'polite' | 'assertive';
}

export function VisuallyHidden({children, live}: VisuallyHiddenProps) {
  return (
    <View dataSet={{srOnly: ''}} style={styles.hidden} aria-live={live}>
      <Text variant="bodySmall">{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0},
});
