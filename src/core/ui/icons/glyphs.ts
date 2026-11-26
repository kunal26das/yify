export const ICON_NAMES = [
  'home', 'search', 'video_library', 'account_circle', 'arrow_back', 'close', 'more_vert', 'share', 'play_arrow',
  'bookmark', 'bookmark_add', 'bookmark_added', 'check_circle', 'playlist_add', 'playlist_add_check', 'star',
  'star_half', 'arrow_drop_down', 'expand_more', 'expand_less', 'check', 'tune', 'sort', 'history', 'cloud_off',
  'error', 'refresh', 'open_in_new', 'delete', 'edit', 'add', 'chevron_right', 'chevron_left', 'public', 'movie',
  'tv', 'person', 'lock', 'workspace_premium', 'palette', 'logout', 'info', 'policy', 'calendar_month', 'replay',
  'image', 'photo_library', 'schedule', 'trending_up', 'link', 'notes', 'dark_mode', 'light_mode', 'brightness_auto',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const FILLED_ICON_NAMES = [
  'home', 'search', 'video_library', 'account_circle', 'bookmark', 'check_circle', 'star',
] as const satisfies readonly IconName[];

export type FilledIconName = (typeof FILLED_ICON_NAMES)[number];

const FILLED: ReadonlySet<string> = new Set(FILLED_ICON_NAMES);

export function hasFilledGlyph(name: IconName): name is FilledIconName {
  return FILLED.has(name);
}
