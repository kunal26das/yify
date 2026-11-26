import type {TextProps, ViewProps} from 'react-native';

export function headingProps(level: 1 | 2 | 3): TextProps {
  return {role: 'heading'};
}

export function currentPageProps(current: boolean): ViewProps {
  return {role: 'tab', 'aria-selected': current};
}

export function toggleProps(pressed: boolean): ViewProps {
  return {accessibilityRole: 'togglebutton', 'aria-checked': pressed};
}

export function popupProps(expanded: boolean): ViewProps {
  return {'aria-expanded': expanded};
}
