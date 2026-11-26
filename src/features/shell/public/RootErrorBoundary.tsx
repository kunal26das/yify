import type {ErrorBoundaryProps} from 'expo-router';
import type {JSX} from 'react';
import {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {APP_NAME} from '@/core/config/app';
import {reportError} from '@/core/platform/telemetry/sentry';
import {ErrorState} from '@/core/ui/components/ErrorState';
import {useTheme} from '@/core/ui/theme/useTheme';

export const ROOT_ERROR_COPY = {
  title: 'Something went wrong',
  body: `${APP_NAME} hit an unexpected problem.`,
} as const;

export function RootErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  const {error, retry} = props;
  const theme = useTheme();
  useEffect(() => {
    reportError(error, {boundary: 'root'});
  }, [error]);
  const tryAgain = () => {
    void retry();
  };
  return (
    <View style={[styles.root, {backgroundColor: theme.colors.surface}]}>
      <ErrorState title={ROOT_ERROR_COPY.title} body={ROOT_ERROR_COPY.body} onRetry={tryAgain}/>
    </View>
  );
}

const styles = StyleSheet.create({root: {flex: 1, justifyContent: 'center'}});
