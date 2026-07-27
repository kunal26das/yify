import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import Animated from 'react-native-reanimated';
import {ThemedText} from '../../components/themed-text';
import {FontFamily} from '../../constants/theme';
import {enterPop} from '../../components/motion';

export function NewBadge({style}: {style?: StyleProp<ViewStyle>}) {
    return (
        <Animated.View entering={enterPop(2)} style={[styles.badge, style]}>
            <ThemedText style={styles.label}>NEW</ThemedText>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    badge: {
        backgroundColor: '#C2379B',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    label: {
        color: '#fff',
        fontSize: 9,
        lineHeight: 11,
        letterSpacing: 0.7,
        fontFamily: FontFamily.extrabold,
    },
});
