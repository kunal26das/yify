import {Easing, useReducedMotion} from 'react-native-reanimated';
import {motion} from './tokens';

export type EasingName = keyof typeof motion.easing;
export type DurationName = keyof typeof motion.duration;

export function easing(name: EasingName) {
  const [x1, y1, x2, y2] = motion.easing[name];
  return Easing.bezier(x1, y1, x2, y2);
}

export function timing(duration: DurationName, curve: EasingName, reduceMotion: boolean): {duration: number; easing: ReturnType<typeof easing>} {
  return {duration: reduceMotion ? 0 : motion.duration[duration], easing: easing(curve)};
}

export function useMotion(): {reduceMotion: boolean; timing: (duration: DurationName, curve: EasingName) => {duration: number; easing: ReturnType<typeof easing>}} {
  const reduceMotion = useReducedMotion();
  return {reduceMotion, timing: (duration, curve) => timing(duration, curve, reduceMotion)};
}
