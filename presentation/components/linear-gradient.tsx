import {Platform, type StyleProp, StyleSheet, View, type ViewStyle} from 'react-native';

interface LinearGradientProps {
    colors: readonly string[];
    direction?: 'vertical' | 'horizontal' | 'diagonal';
    bands?: number;
    style?: StyleProp<ViewStyle>;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    children?: React.ReactNode;
}

const DIRECTION_CSS = {
    vertical: 'to bottom',
    horizontal: 'to right',
    diagonal: '135deg',
} as const;

export function LinearGradient({
                                   colors,
                                   direction = 'vertical',
                                   style,
                                   pointerEvents,
                                   children,
                               }: LinearGradientProps) {
    const css = `linear-gradient(${DIRECTION_CSS[direction]}, ${colors.join(', ')})`;

    const gradientStyle: ViewStyle = {};
    const key = Platform.OS === 'web' ? 'backgroundImage' : 'experimental_backgroundImage';
    (gradientStyle as Record<string, unknown>)[key] = css;

    return (
        <View style={[styles.container, gradientStyle, style]} pointerEvents={pointerEvents}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {overflow: 'hidden'},
});
