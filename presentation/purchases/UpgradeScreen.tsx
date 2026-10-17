import {ScrollView, StyleSheet} from 'react-native';
import {router, useIsFocused} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Screen} from '../components/screen';
import {useTopBarHeight} from '../movies/components/TopBar';
import {Spacing} from '../constants/theme';
import {useResponsive} from '../hooks/use-responsive';
import {SupporterMembership} from './supporter-paywall';

export function UpgradeScreen() {
    const top = useTopBarHeight();
    const focused = useIsFocused();
    const insets = useSafeAreaInsets();
    const {gutter} = useResponsive();
    return <Screen><ScrollView contentContainerStyle={[styles.content, {
        paddingHorizontal: gutter, paddingTop: top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xxl,
    }]}>
        <SupporterMembership active={focused}
            onOpenJournal={() => router.push('/journal')}
            onOpenInsights={() => router.push('/journal?tab=insights')}/>
    </ScrollView></Screen>;
}

const styles = StyleSheet.create({content: {paddingVertical: Spacing.xl}});
