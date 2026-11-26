import type {Provider} from '@/core/domain/providers';
import {StyleSheet, View} from 'react-native';
import type {Tokens} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {Artwork} from './Artwork';
import {Text} from './Text';

export type ProviderLogoSize = 24 | 40 | 48;

export interface ProviderLogoProps {
  provider: Provider;
  size: ProviderLogoSize;
  decorative?: boolean;
}

const RADIUS: Readonly<Record<ProviderLogoSize, keyof Tokens['shape']>> = {48: 'medium', 40: 'small', 24: 'extraSmall'};

export function ProviderLogo({provider, size, decorative = false}: ProviderLogoProps) {
  const theme = useTheme();
  const rounded = RADIUS[size];
  if (provider.logoPath === null) {
    return (
      <View
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : provider.name}
        aria-hidden={decorative || undefined}
        style={[styles.monogram, {width: size, height: size, borderRadius: theme.shape[rounded], backgroundColor: theme.colors.surfaceContainerHigh}]}
      >
        <Text variant={size === 24 ? 'labelSmall' : 'titleMedium'} color="onSurfaceVariant" aria-hidden maxFontSizeMultiplier={1}>
          {Array.from(provider.name.trim())[0]?.toLocaleUpperCase() ?? ''}
        </Text>
      </View>
    );
  }
  return <Artwork kind="logo" path={provider.logoPath} size="w92" width={size} alt={provider.name} decorative={decorative} rounded={rounded}/>;
}

const styles = StyleSheet.create({monogram: {alignItems: 'center', justifyContent: 'center'}});
