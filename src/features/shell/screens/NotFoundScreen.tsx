import {Link} from 'expo-router';
import {Text} from 'react-native';
import {ScreenScaffold} from '@/core/ui/ScreenScaffold';

export function NotFoundScreen() {
  return (
    <ScreenScaffold title="Page not found">
      <Text>This page does not exist.</Text>
      <Link href="/">Go to Home</Link>
    </ScreenScaffold>
  );
}
