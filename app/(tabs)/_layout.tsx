import {Tabs} from 'expo-router/js-tabs';
import {useChromePosition} from '@/core/ui/navigation/useChromePosition';
import {DESTINATIONS} from '@/core/ui/navigation/destinations';
import {AppTabBar} from '@/features/shell/public/AppTabBar';

export default function TabsLayout() {
  const position = useChromePosition();
  return (
    <Tabs
      backBehavior="firstRoute"
      tabBar={(props) => <AppTabBar {...props}/>}
      screenOptions={{headerShown: false, tabBarPosition: position, lazy: true, animation: 'none'}}
    >
      {DESTINATIONS.map((destination) => (
        <Tabs.Screen key={destination.route} name={destination.route} options={{title: destination.label}}/>
      ))}
    </Tabs>
  );
}
