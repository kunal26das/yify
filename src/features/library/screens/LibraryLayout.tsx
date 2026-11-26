import {TabList, TabSlot, TabTrigger, Tabs} from 'expo-router/ui';
import {Text} from 'react-native';

export function LibraryLayout() {
  return (
    <Tabs>
      <TabList>
        <TabTrigger name="watchlist" href="/library"><Text>Watchlist</Text></TabTrigger>
        <TabTrigger name="watched" href="/library/watched"><Text>Watched</Text></TabTrigger>
        <TabTrigger name="lists" href="/library/lists"><Text>Lists</Text></TabTrigger>
        <TabTrigger name="recent" href="/library/recent"><Text>Recent</Text></TabTrigger>
      </TabList>
      <TabSlot/>
    </Tabs>
  );
}
