import Constants from 'expo-constants';
import { getCornerRadius } from 'expo-device-corner-radius';
import { useState } from 'react';
import { Platform } from 'react-native';

const FALLBACK_RADIUS = 20;

function getInitialRadius(): number {
  if (Platform.OS === 'web') return FALLBACK_RADIUS;
  // expo-device-corner-radius requires a dev build; not available in Expo Go
  if (Constants.appOwnership === 'expo') return FALLBACK_RADIUS;
  try {
    const value = getCornerRadius();
    return value > 0 ? value : FALLBACK_RADIUS;
  } catch {
    return FALLBACK_RADIUS;
  }
}

export function useDeviceCornerRadius(): number {
  const [radius] = useState(getInitialRadius);
  return radius;
}
