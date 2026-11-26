import {APP_NAME, PLAY_STORE_URL} from '@/core/config/app';
import {PRIVACY_URL, TERMS_URL} from '@/core/config/legal';
import type {TextProps as NativeTextProps} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {useTheme} from '../theme/useTheme';
import {Text} from './Text';

export const FOOTER_ATTRIBUTION = `This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming data from JustWatch. ${APP_NAME} does not host video.`;

export const FOOTER_LINKS: readonly {label: string; href: string; external: boolean}[] = [
  {label: 'About', href: '/settings/about', external: false},
  {label: 'Privacy', href: PRIVACY_URL, external: true},
  {label: 'Terms', href: TERMS_URL, external: true},
  {label: 'Get the Android app', href: PLAY_STORE_URL, external: true},
];

function anchor(href: string, external: boolean): Partial<NativeTextProps> {
  const attributes = external ? {href, hrefAttrs: {target: '_blank', rel: 'noopener noreferrer'}} : {href};
  return attributes as unknown as Partial<NativeTextProps>;
}

export function SiteFooter() {
  const theme = useTheme();
  return (
    <View role="contentinfo" style={[styles.footer, {gap: theme.space.sm, paddingHorizontal: theme.layout.gutter.compact, paddingVertical: theme.space.xl}]}>
      <View style={[styles.links, {columnGap: theme.space.lg, rowGap: theme.space.xs}]}>
        {FOOTER_LINKS.map((link) => (
          <Text key={link.label} {...anchor(link.href, link.external)} variant="bodySmall" color="onSurfaceVariant" style={styles.underline}>
            {link.label}
          </Text>
        ))}
      </View>
      <Text variant="bodySmall" color="onSurfaceVariant">{FOOTER_ATTRIBUTION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {alignSelf: 'stretch'},
  links: {flexDirection: 'row', flexWrap: 'wrap'},
  underline: {textDecorationLine: 'underline'},
});
