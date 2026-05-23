import {useMemo} from 'react';
import {type StyleProp, StyleSheet, View, type ViewStyle} from 'react-native';

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(input: string): RGBA {
    const c = input.trim();
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return {r, g, b, a};
    }
    const m = c.match(/rgba?\(([^)]+)\)/i);
    if (m) {
        const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
        return {r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] == null ? 1 : parts[3]};
    }
    return {r: 0, g: 0, b: 0, a: 1};
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function mix(a: RGBA, b: RGBA, t: number): string {
    const r = Math.round(lerp(a.r, b.r, t));
    const g = Math.round(lerp(a.g, b.g, t));
    const bl = Math.round(lerp(a.b, b.b, t));
    const al = lerp(a.a, b.a, t);
    return `rgba(${r}, ${g}, ${bl}, ${al.toFixed(3)})`;
}

interface LinearGradientProps {
    /** Two or more color stops, evenly distributed. */
    colors: readonly string[];
    direction?: 'vertical' | 'horizontal' | 'diagonal';
    /** Number of interpolation bands. Higher = smoother. */
    bands?: number;
    style?: StyleProp<ViewStyle>;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    children?: React.ReactNode;
}

/**
 * Zero-dependency linear gradient built from stacked solid bands. Works
 * identically on iOS, Android, web and the Electron desktop shell without any
 * native module. For a transparent → color scrim, pass an rgba(...) transparent
 * stop first.
 */
export function LinearGradient({
                                   colors,
                                   direction = 'vertical',
                                   bands = 14,
                                   style,
                                   pointerEvents,
                                   children,
                               }: LinearGradientProps) {
    const stops = useMemo(() => colors.map(parseColor), [colors]);

    const bandColors = useMemo(() => {
        const out: string[] = [];
        const segments = stops.length - 1;
        for (let i = 0; i < bands; i++) {
            const pos = (i / (bands - 1)) * segments;
            const idx = Math.min(Math.floor(pos), segments - 1);
            const local = pos - idx;
            out.push(mix(stops[idx], stops[idx + 1], local));
        }
        return out;
    }, [stops, bands]);

    const isRow = direction === 'horizontal';
    const isDiagonal = direction === 'diagonal';

    return (
        <View style={[styles.container, style]} pointerEvents={pointerEvents}>
            <View
                style={[
                    StyleSheet.absoluteFill,
                    {flexDirection: isRow || isDiagonal ? 'row' : 'column'},
                    isDiagonal && styles.diagonal,
                ]}
                pointerEvents="none"
            >
                {bandColors.map((c, i) => (
                    <View key={i} style={[styles.band, {backgroundColor: c}]}/>
                ))}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {overflow: 'hidden'},
    band: {flex: 1},
    // Rotate the band stack to fake a diagonal sweep; oversize so corners stay covered.
    diagonal: {
        transform: [{rotate: '18deg'}, {scale: 1.8}],
    },
});
