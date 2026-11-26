import type {Ref} from 'react';
import {useState} from 'react';
import type {TextInputInstance, TextInputKeyPressEvent, TextInputProps, ViewProps} from 'react-native';
import {StyleSheet, TextInput, View} from 'react-native';
import {IS_WEB} from '../environment';
import {textStyle} from '../theme/typography';
import {useTheme} from '../theme/useTheme';
import {Icon} from './Icon';
import {IconButton} from './IconButton';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  variant: 'appBar' | 'header';
  autoFocus?: boolean;
  inputRef?: Ref<TextInputInstance>;
  placeholder?: string;
}

export const SEARCH_LABEL = 'Search movies, TV shows and people';
export const SEARCH_SHORTCUT = '/';

const HEIGHT = {appBar: 56, header: 44} as const;
const HEADER_MAX_WIDTH = 560;

export function SearchField({value, onChangeText, onSubmit, onFocus, variant, autoFocus = false, inputRef, placeholder = SEARCH_LABEL}: SearchFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const shortcut = (variant === 'header' && IS_WEB ? {'aria-keyshortcuts': SEARCH_SHORTCUT} : {}) as Partial<TextInputProps>;
  const landmark = (IS_WEB ? {role: 'search'} : {}) as Pick<ViewProps, 'role'>;
  const onKeyPress = (event: TextInputKeyPressEvent) => {
    if (event.nativeEvent.key === 'Escape' && value.length > 0) onChangeText('');
  };

  return (
    <View
      {...landmark}
      style={[
        styles.field,
        {
          minHeight: HEIGHT[variant],
          maxWidth: variant === 'header' ? HEADER_MAX_WIDTH : undefined,
          borderRadius: theme.shape[variant === 'header' ? 'large' : 'full'],
          backgroundColor: theme.colors.surfaceContainerHigh,
          paddingLeft: theme.space.lg,
          paddingRight: theme.space.xs,
          gap: theme.space.md,
        },
        focused ? {outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2, outlineColor: theme.colors.focusRing} : null,
      ]}
    >
      <Icon name="search" size={24} color="onSurfaceVariant"/>
      <TextInput
        {...shortcut}
        ref={inputRef}
        dataSet={{textInput: ''}}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={(event) => onSubmit?.(event.nativeEvent.text)}
        onKeyPress={onKeyPress}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        selectionColor={theme.colors.primary}
        cursorColor={theme.colors.onSurface}
        role="searchbox"
        aria-label={SEARCH_LABEL}
        inputMode="search"
        enterKeyHint="search"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, textStyle(theme.type.bodyLarge), {color: theme.colors.onSurface}]}
      />
      {value.length > 0 ? <IconButton icon="close" label="Clear search" onPress={() => onChangeText('')}/> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', flexGrow: 1},
  input: {flex: 1, minWidth: 0, paddingVertical: 8},
});
