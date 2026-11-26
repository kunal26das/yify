import {StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import {useTheme} from '../theme/useTheme';
import {Heading} from './Text';

export interface PageTitleProps {
  title: string;
}

export function PageTitle({title}: PageTitleProps) {
  const theme = useTheme();
  if (!IS_WEB) return null;
  return (
    <View dataSet={{pageTitle: ''}} style={[styles.title, {paddingTop: theme.space.xl, paddingBottom: theme.space.md}]}>
      <Heading level={1} variant="headlineMedium">{title}</Heading>
    </View>
  );
}

const styles = StyleSheet.create({title: {flexDirection: 'row'}});
