import {Text, View} from 'react-native';

export function RootErrorBoundary({error}: {error: Error}) {
  return (
    <View role="alert" testID="root-error">
      <Text>{`Something went wrong: ${error.message}`}</Text>
    </View>
  );
}
