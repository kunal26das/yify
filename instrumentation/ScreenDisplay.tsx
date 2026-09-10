import {createTimeToFullDisplay} from '@sentry/react-native';
import {useFocusEffect} from 'expo-router';

export const ScreenDisplay = createTimeToFullDisplay({useFocusEffect});
