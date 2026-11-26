import type {TextProps, ViewProps} from 'react-native';

export function headingProps(level: 1 | 2 | 3): TextProps {
  return {role: 'heading', 'aria-level': level} as TextProps;
}

export function currentPageProps(current: boolean): ViewProps {
  return {'aria-current': current ? 'page' : undefined} as ViewProps;
}

export function toggleProps(pressed: boolean): ViewProps {
  return {role: 'button', 'aria-pressed': pressed} as ViewProps;
}

export function popupProps(expanded: boolean): ViewProps {
  return {'aria-haspopup': 'dialog', 'aria-expanded': expanded} as ViewProps;
}
