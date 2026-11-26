import type {FontFamily} from './tokens';

export function fontStack(family: FontFamily): string {
  return `"${family}", system-ui, "Segoe UI", Roboto, sans-serif`;
}
