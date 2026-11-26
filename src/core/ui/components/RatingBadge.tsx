import {StyleSheet, View} from 'react-native';
import {formatRating} from '../format';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {Text} from './Text';

export interface RatingBadgeProps {
  value: number | null;
  votes?: number;
  size?: 'small' | 'medium';
}

export const MIN_RATING_VOTES = 10;

export function ratingLabel(value: number): string {
  return `Rated ${formatRating(value)} out of 10 on TMDB`;
}

export function isRatingShown(value: number | null, votes?: number): value is number {
  return value !== null && Number.isFinite(value) && value > 0 && (votes === undefined || votes >= MIN_RATING_VOTES);
}

export function RatingBadge({value, votes, size = 'medium'}: RatingBadgeProps) {
  const theme = useTheme();
  if (!isRatingShown(value, votes)) return null;
  return (
    <View role="img" aria-label={ratingLabel(value)} style={[styles.row, {gap: theme.space.xs}]}>
      <Icon name="star" filled size={size === 'small' ? 18 : 20} color="ratingStar"/>
      <Text variant={size === 'small' ? 'bodySmall' : 'labelLarge'} aria-hidden>{formatRating(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({row: {flexDirection: 'row', alignItems: 'center'}});
