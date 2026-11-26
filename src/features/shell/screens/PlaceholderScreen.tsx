import {Text} from 'react-native';
import {ScreenScaffold} from '@/core/ui/ScreenScaffold';

export function PlaceholderScreen({name}: {name: string}) {
  return (
    <ScreenScaffold title={name}>
      <Text testID="placeholder">{`${name} is being rebuilt`}</Text>
    </ScreenScaffold>
  );
}
