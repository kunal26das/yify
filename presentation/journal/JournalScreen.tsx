import Ionicons from '@expo/vector-icons/Ionicons';
import {Image} from 'expo-image';
import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {journalInsights, journalToday, type JournalEntry} from '@/domain';
import {Analytics} from '../analytics/events';
import {useConfirm} from '../components/confirm-dialog';
import {PressableScale} from '../components/motion';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing} from '../constants/theme';
import {useAuthRepository, useJournalRepository} from '../di/DependenciesContext';
import {useAuth} from '../hooks/use-auth';
import {useJournal} from '../hooks/use-journal';
import {usePalette} from '../hooks/use-palette';
import {usePurchases} from '../hooks/use-purchases';
import {useResponsive} from '../hooks/use-responsive';
import {useTopBarHeight} from '../movies/components/TopBar';
import {useGoTo} from '../movies/constants/destinations';
import {useSupporterPaywall} from '../purchases/supporter-paywall';
import {JournalEditor} from './JournalEditor';
import {JOURNAL_DELETED_MESSAGE, journalErrorMessage} from './journal-copy';

function Action({label, onPress, primary = false, disabled = false}: {
    label: string; onPress: () => void; primary?: boolean; disabled?: boolean;
}) {
    const {colors} = usePalette();
    return <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{disabled}} contentStyle={[styles.action, {borderColor: primary ? colors.accentStrong : colors.border,
            backgroundColor: primary ? colors.accentStrong : colors.surfaceSunken, opacity: disabled ? 0.5 : 1}]}>
        <ThemedText type="defaultSemiBold" style={{color: primary ? colors.onAccent : colors.text}}>{label}</ThemedText>
    </PressableScale>;
}

export function JournalScreen() {
    const session = useAuth();
    const auth = useAuthRepository();
    const {colors} = usePalette();
    const {gutter} = useResponsive();
    const top = useTopBarHeight();
    const [error, setError] = useState('');
    useEffect(() => {Analytics.journal('opened');}, []);
    if (session.ready && session.account) return <JournalContent key={session.account.uid}/>;
    const signIn = async () => {
        setError('');
        try {await auth.signIn();} catch {setError('Sign-in could not be completed. Try again.');}
    };
    return <Screen>
        <ScrollView contentContainerStyle={[styles.guest, {paddingHorizontal: gutter, paddingTop: top + Spacing.xxl}]}>
            {!session.ready ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your account"/> : <>
                <Ionicons name="book-outline" size={36} color={colors.accent}/>
                <ThemedText type="heading">Your movie journal</ThemedText>
                <ThemedText style={[styles.readable, {color: colors.textMuted}]}>Keep watch dates, personal ratings and private notes together. Sign in to start your free journal.</ThemedText>
                <Action label={session.signingIn ? 'Signing in…' : 'Sign in with Google'} onPress={() => void signIn()}
                    primary disabled={session.signingIn || !session.available}/>
                {!session.available ? <ThemedText style={{color: colors.textMuted}}>Sign-in is unavailable on this device.</ThemedText> : null}
                {error || session.error ? <ThemedText accessibilityRole="alert" style={{color: colors.danger}}>
                    {error || 'Sign-in could not be completed. Try again.'}
                </ThemedText> : null}
            </>}
        </ScrollView>
    </Screen>;
}

function JournalContent() {
    const {colors} = usePalette();
    const {width, contentMaxWidth, gutter, isPhone} = useResponsive();
    const insets = useSafeAreaInsets();
    const top = useTopBarHeight();
    const session = useAuth();
    const auth = useAuthRepository();
    const journal = useJournal();
    const repository = useJournalRepository();
    const purchases = usePurchases();
    const showPaywall = useSupporterPaywall();
    const confirm = useConfirm();
    const goTo = useGoTo();
    const [tab, setTab] = useState<'journal' | 'insights'>('journal');
    const [editing, setEditing] = useState<JournalEntry | null>(null);
    const [error, setError] = useState('');
    const [currentMonth] = useState(() => journalToday().slice(0, 7));
    const [month, setMonth] = useState<string | undefined>(currentMonth);
    const premium = !!session.account && purchases.ready && purchases.adsRemoved;
    const insights = useMemo(() => premium && journal.ready ? journalInsights(journal.entries, month) : null,
        [premium, journal.ready, journal.entries, month]);
    const remove = (entry: JournalEntry) => {
        const uid = session.account?.uid;
        confirm({title: 'Delete journal entry?', message: 'This watch date, rating and note will be removed from your journal.',
            confirmLabel: 'Delete', destructive: true, icon: 'trash-outline', onConfirm: () => {
                if (!uid || auth.getSession().account?.uid !== uid) return;
                try {repository.remove(entry.id); setError(''); Analytics.journal('entry_deleted');}
                catch (failure) {setError(journalErrorMessage(failure, 'Your entry could not be deleted. Try again.'));}
            }});
    };
    const switchTab = (value: typeof tab) => {
        if (value === 'insights' && tab !== value) Analytics.journal('insights_opened');
        setTab(value);
    };
    const changeMonth = (amount: number) => {
        if (!month) return;
        const [year, value] = month.split('-').map(Number);
        const date = new Date(year, value - 1 + amount, 1, 12);
        const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (next >= '1900-01' && next <= currentMonth) setMonth(next);
    };
    const header = <View style={styles.header}>
        <View style={styles.heading}>
            <View style={styles.headingText}>
                <ThemedText type="heading">Journal</ThemedText>
                <ThemedText type="caption" style={{color: colors.textMuted}}>Your private movie diary.</ThemedText>
            </View>
            <Action label="Open watchlist" onPress={() => goTo('/watchlist')}/>
        </View>
        <View style={styles.tabs}>
            {(['journal', 'insights'] as const).map(value => <PressableScale key={value} onPress={() => switchTab(value)}
                accessibilityRole="tab" accessibilityLabel={value === 'journal' ? 'Entries' : 'Insights'}
                accessibilityState={{selected: tab === value}} contentStyle={[styles.tab, {borderColor: colors.border,
                    backgroundColor: tab === value ? colors.accentSoft : 'transparent'}]}>
                <ThemedText type="defaultSemiBold" style={{color: tab === value ? colors.accent : colors.textMuted}}>
                    {value === 'journal' ? 'Entries' : 'Insights'}
                </ThemedText>
            </PressableScale>)}
        </View>
        {journal.error ? <View style={styles.notice}>
            <ThemedText accessibilityRole="alert" style={{color: colors.danger}}>
                {journalErrorMessage(journal.error, journal.ready ? 'Your journal could not sync. Your saved entries are still here.' : 'Your journal could not be loaded.')}
            </ThemedText>
            {journal.error !== JOURNAL_DELETED_MESSAGE ? <Action label="Retry journal sync" onPress={() => repository.retrySync()}/> : null}
        </View> : journal.syncing ? <ThemedText type="caption" style={{color: colors.textMuted}}>Syncing your journal…</ThemedText> : null}
        {error ? <ThemedText accessibilityRole="alert" style={{color: colors.danger}}>{error}</ThemedText> : null}
        {(!journal.ready && !journal.error) || (tab === 'insights' && journal.ready && !purchases.ready) ? <ActivityIndicator color={colors.accent}
            accessibilityLabel={!journal.ready ? 'Loading your journal' : 'Checking supporter access'}/> : null}
        {tab === 'insights' && journal.ready && purchases.ready ? premium && insights ? <>
            <View style={styles.periods}>
                <Action label="Monthly" primary={month !== undefined} onPress={() => setMonth(currentMonth)}/>
                <Action label="All time" primary={month === undefined} onPress={() => setMonth(undefined)}/>
            </View>
            {month ? <View style={styles.monthNavigation}>
                <PressableScale accessibilityRole="button" accessibilityLabel="Previous month" disabled={month === '1900-01'}
                    accessibilityState={{disabled: month === '1900-01'}} onPress={() => changeMonth(-1)} contentStyle={styles.delete}>
                    <Ionicons name="chevron-back" size={20} color={month === '1900-01' ? colors.textFaint : colors.text}/>
                </PressableScale>
                <ThemedText type="defaultSemiBold" style={styles.periodLabel}>{new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}</ThemedText>
                <PressableScale accessibilityRole="button" accessibilityLabel="Next month" disabled={month === currentMonth}
                    accessibilityState={{disabled: month === currentMonth}} onPress={() => changeMonth(1)} contentStyle={styles.delete}>
                    <Ionicons name="chevron-forward" size={20} color={month === currentMonth ? colors.textFaint : colors.text}/>
                </PressableScale>
            </View> : null}
            {insights.totalWatches === 0 ? <View style={styles.empty}>
                <ThemedText type="heading">No watches logged {month ? 'this month' : 'yet'}</ThemedText>
                <ThemedText style={{color: colors.textMuted}}>Log a movie you have watched to see your viewing patterns.</ThemedText>
            </View> : <View style={[styles.insights, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={styles.metrics}>
                    <Metric label="Watches logged" value={String(insights.totalWatches)}/>
                    <Metric label="Different movies" value={String(insights.distinctMovies)}/>
                    <Metric label="Repeat watches" value={String(insights.repeatWatches)}/>
                    <Metric label="Your average rating" value={insights.averageRating === null ? 'Unrated' : `${insights.averageRating.toFixed(1)} / 5`}/>
                </View>
                <View style={styles.section}>
                    <ThemedText type="defaultSemiBold">Logged runtime</ThemedText>
                    <ThemedText>{Math.floor(insights.knownRuntimeMinutes / 60)}h {insights.knownRuntimeMinutes % 60}m</ThemedText>
                    <ThemedText type="caption" style={{color: colors.textMuted}}>
                        {insights.unknownRuntimeCount ? `${insights.unknownRuntimeCount} ${insights.unknownRuntimeCount === 1 ? 'entry has' : 'entries have'} no runtime. ` : ''}
                        Based on movie lengths, including repeat watches.
                    </ThemedText>
                    <ThemedText type="caption" style={{color: colors.textMuted}}>Average rating uses {insights.ratedWatches} rated {insights.ratedWatches === 1 ? 'entry' : 'entries'}.</ThemedText>
                </View>
                {insights.topGenres.length ? <View style={styles.section}>
                    <ThemedText type="heading">Most watched genres</ThemedText>
                    {insights.topGenres.map(genre => <View key={genre.name} style={styles.breakdown}>
                        <ThemedText style={styles.flex}>{genre.name}</ThemedText>
                        <ThemedText type="defaultSemiBold">{genre.count}</ThemedText>
                    </View>)}
                    <ThemedText type="caption" style={{color: colors.textMuted}}>A movie can count toward more than one genre.</ThemedText>
                </View> : null}
                {insights.topRated.length ? <View style={styles.section}>
                    <ThemedText type="heading">Your highest rated</ThemedText>
                    {insights.topRated.map(item => <View key={item.movie.id} style={styles.breakdown}>
                        <ThemedText style={styles.flex}>{item.movie.title}</ThemedText>
                        <ThemedText style={{color: colors.accent}}>★ {item.rating}</ThemedText>
                    </View>)}
                    <ThemedText type="caption" style={{color: colors.textMuted}}>Uses your latest rating for each movie in this period.</ThemedText>
                </View> : null}
                {!month && insights.months.length ? <View style={styles.section}>
                    <ThemedText type="heading">Watches by month</ThemedText>
                    {insights.months.map(item => <View key={item.month} style={styles.breakdown}>
                        <ThemedText type="caption" style={styles.monthLabel}>{item.month}</ThemedText>
                        <View style={[styles.barTrack, {backgroundColor: colors.surfaceSunken}]}>
                            <View style={[styles.bar, {backgroundColor: colors.accent,
                                width: `${item.count / Math.max(...insights.months.map(point => point.count), 1) * 100}%`}]}/>
                        </View>
                        <ThemedText type="caption">{item.count}</ThemedText>
                    </View>)}
                    {insights.monthsTruncated ? <ThemedText type="caption" style={{color: colors.textMuted}}>Showing the latest 12 months with journal history.</ThemedText> : null}
                </View> : null}
            </View>}
        </> : <View style={[styles.upgrade, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <Ionicons name="stats-chart-outline" size={28} color={colors.accent}/>
            <ThemedText type="heading">See your viewing patterns</ThemedText>
            <ThemedText style={[styles.readable, {color: colors.textMuted}]}>Supporters get monthly recaps, favorite genres and personal rating insights. Your journal entries and editing stay free.</ThemedText>
            <Action label="Explore supporter access" primary onPress={() => {Analytics.journal('upgrade_opened'); showPaywall('settings_supporter');}}/>
        </View> : null}
    </View>;
    return <Screen overlays={<JournalEditor visible={!!editing} movie={editing?.movie ?? null} entry={editing} onClose={() => setEditing(null)}/> }>
        <FlatList data={tab === 'journal' && journal.ready ? journal.entries : []} keyExtractor={entry => entry.id}
            ListHeaderComponent={header} ListEmptyComponent={tab === 'journal' && journal.ready ? <View style={styles.empty}>
                <Ionicons name="book-outline" size={36} color={colors.accent}/>
                <ThemedText type="heading">Remember your next movie</ThemedText>
                <ThemedText style={{color: colors.textMuted}}>Open a movie and choose Log a watch. Add the date, your rating or a note.</ThemedText>
            </View> : null}
            renderItem={({item}) => <View style={[styles.entry, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={styles.entryTop}>
                    {item.movie.posterUrl ? <Image source={{uri: item.movie.posterUrl}} style={styles.poster} contentFit="cover" accessibilityLabel={`${item.movie.title} poster`}/> : null}
                    <View style={styles.flex}>
                        <ThemedText type="caption" style={{color: colors.textMuted}}>{new Date(`${item.watchedOn}T12:00:00`).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'})}</ThemedText>
                        <ThemedText type="defaultSemiBold">{item.movie.title}{item.movie.year ? ` (${item.movie.year})` : ''}</ThemedText>
                        <ThemedText type="caption" style={{color: item.rating ? colors.accent : colors.textMuted}}>
                            {item.rating ? `★ ${item.rating / 2} / 5` : 'Unrated'}
                        </ThemedText>
                    </View>
                </View>
                {item.note ? <ThemedText style={styles.readable}>{item.note}</ThemedText> : null}
                <View style={styles.entryActions}>
                    <Action label="Edit entry" onPress={() => {setError(''); setEditing(item);}}/>
                    <PressableScale onPress={() => remove(item)} accessibilityRole="button" accessibilityLabel={`Delete journal entry for ${item.movie.title}`}
                        contentStyle={styles.delete}>
                        <Ionicons name="trash-outline" size={19} color={colors.textMuted}/>
                    </PressableScale>
                </View>
            </View>}
            initialNumToRender={12} maxToRenderPerBatch={10} windowSize={9} keyboardShouldPersistTaps="handled"
            contentContainerStyle={{width: Math.min(width, contentMaxWidth, 1040), alignSelf: 'center', paddingHorizontal: gutter,
                paddingTop: top + (isPhone ? Spacing.md : Spacing.xl), paddingBottom: insets.bottom + 96}}/>
    </Screen>;
}

function Metric({label, value}: {label: string; value: string}) {
    const {colors} = usePalette();
    return <View style={styles.metric}><ThemedText type="heading">{value}</ThemedText>
        <ThemedText type="caption" style={{color: colors.textMuted}}>{label}</ThemedText></View>;
}

const styles = StyleSheet.create({
    flex: {flex: 1, minWidth: 0},
    guest: {gap: Spacing.lg, alignItems: 'flex-start', paddingBottom: 96},
    readable: {maxWidth: 680},
    header: {gap: Spacing.lg, paddingBottom: Spacing.lg},
    heading: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.md},
    headingText: {flex: 1, minWidth: 120},
    action: {minHeight: 44, paddingHorizontal: Spacing.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: Radius.pill},
    tabs: {flexDirection: 'row', gap: Spacing.sm},
    tab: {minHeight: 44, paddingHorizontal: Spacing.xl, justifyContent: 'center', borderRadius: Radius.pill, borderWidth: 1},
    notice: {gap: Spacing.sm, alignItems: 'flex-start'},
    empty: {paddingVertical: Spacing.xxl, gap: Spacing.md, maxWidth: 560},
    entry: {padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.md, marginBottom: Spacing.md},
    entryTop: {flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start'},
    poster: {width: 48, height: 72, borderRadius: Radius.sm},
    entryActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm},
    delete: {minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center'},
    periods: {flexDirection: 'row', gap: Spacing.sm},
    monthNavigation: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    periodLabel: {flex: 1, textAlign: 'center'},
    upgrade: {gap: Spacing.lg, alignItems: 'flex-start', borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.xl},
    insights: {borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.xl},
    metrics: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg},
    metric: {minWidth: 128, flex: 1, gap: Spacing.xs},
    section: {gap: Spacing.sm},
    breakdown: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 36},
    monthLabel: {width: 64},
    barTrack: {flex: 1, height: 8, borderRadius: Radius.pill, overflow: 'hidden'},
    bar: {height: 8, borderRadius: Radius.pill},
});
