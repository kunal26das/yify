import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

import {ThemedText} from '../../components/themed-text';
import {Spacing} from '../../constants/theme';

export function DurationBadge({label, style}: {label: string; style?: StyleProp<ViewStyle>}) {
    return (
        <View style={[styles.badge, style]} pointerEvents="none">
            <ThemedText style={styles.label}>{label}</ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        position: 'absolute',
        right: Spacing.sm,
        bottom: Spacing.sm,
        paddingVertical: 3,
        paddingHorizontal: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    label: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
