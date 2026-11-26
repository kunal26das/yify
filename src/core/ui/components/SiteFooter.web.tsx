import {APP_NAME, PLAY_STORE_URL} from '@/core/config/app';
import {PRIVACY_URL, TERMS_URL} from '@/core/config/legal';
import {StyleSheet, View} from 'react-native';
import {useTheme} from '../theme/useTheme';
import {Text} from './Text';
import {Touchable} from './Touchable';

export const FOOTER_ATTRIBUTION = `This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming data from JustWatch. ${APP_NAME} does not host video.`;

export const FOOTER_LINKS: readonly {label: string; href: string}[] = [
  {label: 'About', href: '/settings/about'},
  {label: 'Privacy', href: PRIVACY_URL},
  {label: 'Terms', href: TERMS_URL},
  {label: 'Get the Android app', href: PLAY_STORE_URL},
];

const LINK_TARGET = 40;

export function SiteFooter() {
  const theme = useTheme();
  return (
    <View role="contentinfo" style={[styles.footer, {gap: theme.space.xs, paddingHorizontal: theme.layout.gutter.compact, paddingTop: theme.space.md, paddingBottom: theme.space.xl}]}>
      <View style={[styles.links, {marginHorizontal: -theme.space.sm}]}>
        {FOOTER_LINKS.map((link) => (
          <Touchable
            key={link.label}
            href={link.href}
            contentColor="onSurfaceVariant"
            shape="extraSmall"
            style={[styles.link, {minHeight: LINK_TARGET, minWidth: LINK_TARGET, paddingHorizontal: theme.space.sm}]}
          >
            <Text variant="bodySmall" color="onSurfaceVariant" style={styles.underline}>{link.label}</Text>
          </Touchable>
        ))}
      </View>
      <Text variant="bodySmall" color="onSurfaceVariant">{FOOTER_ATTRIBUTION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {alignSelf: 'stretch'},
  links: {flexDirection: 'row', flexWrap: 'wrap'},
  link: {justifyContent: 'center', alignItems: 'center'},
  underline: {textDecorationLine: 'underline'},
});
