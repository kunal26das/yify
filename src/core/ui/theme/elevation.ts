import type {ViewStyle} from 'react-native';

export const elevation = {
  level0: {},
  level2: {boxShadow: '0 2px 6px rgba(0, 0, 0, 0.24)'},
  level3: {boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)'},
} as const satisfies Record<string, ViewStyle>;
