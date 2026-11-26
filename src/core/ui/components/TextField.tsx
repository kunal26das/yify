import type {Ref} from 'react';
import {useEffect, useId, useState} from 'react';
import type {TextInputInstance} from 'react-native';
import {AccessibilityInfo, StyleSheet, TextInput, View} from 'react-native';
import {IS_WEB} from '../environment';
import {textStyle} from '../theme/typography';
import {useTheme} from '../theme/useTheme';
import {Text} from './Text';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  maxLength?: number;
  showCounter?: boolean;
  helper?: string;
  error?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: Ref<TextInputInstance>;
}

const MIN_HEIGHT = 56;
const MULTILINE_MIN_HEIGHT = 120;

export function TextField({label, value, onChangeText, multiline = false, maxLength, showCounter = false, helper, error = null, placeholder, autoFocus = false, inputRef}: TextFieldProps) {
  const theme = useTheme();
  const id = useId();
  const labelId = `${id}-label`;
  const [focused, setFocused] = useState(false);
  const errorText = error ? error : null;
  const counter = showCounter && maxLength !== undefined;
  const supported = errorText !== null || helper !== undefined || counter;

  useEffect(() => {
    if (errorText !== null && !IS_WEB) AccessibilityInfo.announceForAccessibility(errorText);
  }, [errorText]);

  return (
    <View style={styles.column}>
      <Text variant="labelLarge" color="onSurfaceVariant" nativeID={labelId}>{label}</Text>
      <TextInput
        ref={inputRef}
        dataSet={{textInput: ''}}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        selectionColor={theme.colors.primary}
        cursorColor={theme.colors.onSurface}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-labelledby={labelId}
        aria-invalid={errorText !== null ? true : undefined}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          textStyle(theme.type.bodyLarge),
          {
            color: theme.colors.onSurface,
            minHeight: multiline ? MULTILINE_MIN_HEIGHT : MIN_HEIGHT,
            marginTop: theme.space.xs,
            backgroundColor: theme.colors.surfaceContainerLowest,
            borderRadius: theme.shape.extraSmall,
            borderWidth: focused || errorText !== null ? 2 : 1,
            borderColor: errorText !== null ? theme.colors.error : focused ? theme.colors.primary : theme.colors.outline,
            paddingHorizontal: focused || errorText !== null ? theme.space.lg - 1 : theme.space.lg,
            paddingVertical: theme.space.md,
          },
        ]}
      />
      <View style={[styles.row, {gap: theme.space.lg, marginTop: supported ? theme.space.xs : 0}]}>
        <View style={styles.grow}>
          {errorText === null && helper !== undefined ? <Text variant="bodySmall" color="onSurfaceVariant">{helper}</Text> : null}
          <View {...(IS_WEB ? {'aria-live': 'polite' as const} : {})}>
            {errorText !== null ? <Text variant="bodySmall" color="error">{errorText}</Text> : null}
          </View>
        </View>
        {counter ? (
          <Text variant="bodySmall" color="onSurfaceVariant" align="right">{`${value.length}/${maxLength}`}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {alignSelf: 'stretch'},
  row: {flexDirection: 'row', alignItems: 'flex-start'},
  grow: {flex: 1},
});
