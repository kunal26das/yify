import {Link} from 'expo-router';
import {View} from 'react-native';
import {ScreenScaffold} from '@/core/ui/ScreenScaffold';
import {titleHref} from '@/features/title/public/titleQuery';
import {useOpenMedia} from '@/features/title/public/useOpenMedia';
import {HOME_RAIL} from './homeRail';

export function HomeScreen() {
  const openMedia = useOpenMedia();
  return (
    <ScreenScaffold title="Home">
      <View testID="home-rail">
        {HOME_RAIL.map((item) => (
          <Link key={item.key} href={titleHref(item)} testID={`open-${item.type}-${item.id}`} onPress={() => openMedia(item)}>
            {`${item.title} (${item.year})`}
          </Link>
        ))}
        <Link href="/person/6384-keanu-reeves" testID="open-person-6384">Keanu Reeves</Link>
      </View>
    </ScreenScaffold>
  );
}
