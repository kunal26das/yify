import {Stack} from 'expo-router';
import {useReducedMotion} from 'react-native-reanimated';
import {singularById} from '@/core/navigation/singular';

export const unstable_settings = {
  anchor: 'index',
  search: {anchor: 'search'},
  library: {anchor: 'library'},
  you: {anchor: 'you'},
};

export default function TabStackLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Stack screenOptions={{headerShown: false, animation: reduceMotion ? 'none' : 'default'}}>
      <Stack.Screen name="title/movie/[id]" dangerouslySingular={singularById}/>
      <Stack.Screen name="title/tv/[id]/index" dangerouslySingular={singularById}/>
      <Stack.Screen name="person/[id]" dangerouslySingular={singularById}/>
    </Stack>
  );
}
