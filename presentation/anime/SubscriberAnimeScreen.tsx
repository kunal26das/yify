import {Redirect} from 'expo-router';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {ScreenDisplay} from '@/instrumentation/ScreenDisplay';
import {PressableScale} from '../components/motion';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing} from '../constants/theme';
import {useAnimeRepository} from '../di/DependenciesContext';
import {useAuth} from '../hooks/use-auth';
import {usePalette} from '../hooks/use-palette';
import {useSubscriberAccess} from '../hooks/use-subscriber-access';
import {useTopBarHeight} from '../movies/components/TopBar';
import {TopBarSlot} from '../movies/components/TopBarSlot';
import {AnimeScreen} from './AnimeScreen';
import {useAnimeViewModel} from './useAnimeViewModel';

function AvailableAnime() {
    const viewModel = useAnimeViewModel(useAnimeRepository());
    return <><AnimeScreen viewModel={viewModel}/><ScreenDisplay ready={viewModel.status !== 'loading'}/></>;
}

export function SubscriberAnimeScreen() {
    const {status, refresh} = useSubscriberAccess();
    const {account} = useAuth();
    const {colors} = usePalette();
    const top = useTopBarHeight();
    if (status === 'denied') return <Redirect href="/movies"/>;
    if (status === 'allowed') return <AvailableAnime key={account?.uid}/>;
    return <Screen overlays={<TopBarSlot showSearch={false}/>}>
        <View style={[styles.pending, {paddingTop: top + Spacing.xl}]}>
            {status === 'checking' ? <ActivityIndicator color={colors.accent} accessibilityLabel="Checking subscription"/>
                : <>
                    <ThemedText type="heading">Couldn’t verify your subscription</ThemedText>
                    <ThemedText style={styles.message}>Please try again in a moment.</ThemedText>
                    <PressableScale onPress={() => void refresh()} accessibilityRole="button" accessibilityLabel="Retry subscription check"
                        contentStyle={[styles.retry, {backgroundColor: colors.accentStrong}]}>
                        <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>Try again</ThemedText>
                    </PressableScale>
                </>}
        </View>
        <ScreenDisplay ready={status !== 'checking'}/>
    </Screen>;
}

const styles = StyleSheet.create({
    pending: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg},
    message: {textAlign: 'center'},
    retry: {minHeight: 48, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, justifyContent: 'center'},
});
