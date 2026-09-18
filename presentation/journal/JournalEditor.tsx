import {useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {JOURNAL_MAX_NOTE_LENGTH, journalToday, validateJournalInput, type JournalEntry, type JournalMovie} from '@/domain';
import {Analytics} from '../analytics/events';
import {PressableScale} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing, Typography} from '../constants/theme';
import {useAuthRepository, useJournalRepository} from '../di/DependenciesContext';
import {useAuth} from '../hooks/use-auth';
import {useJournal} from '../hooks/use-journal';
import {usePalette} from '../hooks/use-palette';
import {WatchlistSheet, WatchlistSheetInput} from '../movies/components/WatchlistSheet';
import {JOURNAL_DELETED_MESSAGE, journalErrorMessage} from './journal-copy';

interface Props {
    visible: boolean;
    movie: JournalMovie | null;
    entry?: JournalEntry | null;
    onClose: () => void;
}

export function JournalEditor(props: Props) {
    const session = useAuth();
    if (!props.visible || !props.movie) return null;
    return <WatchlistSheet visible title={props.entry ? 'Edit journal entry' : 'Log a movie'} onClose={props.onClose}>
        {session.ready && session.account ? <JournalDraft key={`${session.account.uid}:${props.entry?.id ?? 'new'}:${props.movie.id}`}
            movie={props.movie} entry={props.entry} onClose={props.onClose}/> : <JournalSignIn/>}
    </WatchlistSheet>;
}

function JournalSignIn() {
    const session = useAuth();
    const auth = useAuthRepository();
    const {colors} = usePalette();
    const [error, setError] = useState('');
    const signIn = async () => {
        setError('');
        try {await auth.signIn();} catch {setError('Sign-in could not be completed. Try again.');}
    };
    if (!session.ready) return <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your account"/>;
    return <View style={styles.form}>
        <ThemedText>Sign in to save watch dates, personal ratings and private notes in your free movie journal.</ThemedText>
        <PressableScale onPress={() => void signIn()} disabled={session.signingIn || !session.available}
            accessibilityRole="button" accessibilityLabel="Sign in with Google"
            accessibilityState={{disabled: session.signingIn || !session.available}}
            contentStyle={[styles.action, {backgroundColor: colors.accentStrong, borderColor: colors.accentStrong}]}>
            <ThemedText style={{color: colors.onAccent}}>{session.signingIn ? 'Signing in…' : 'Sign in with Google'}</ThemedText>
        </PressableScale>
        {!session.available ? <ThemedText style={{color: colors.textMuted}}>Sign-in is unavailable on this device.</ThemedText> : null}
        {error || session.error ? <ThemedText accessibilityRole="alert" style={{color: colors.danger}}>
            {error || 'Sign-in could not be completed. Try again.'}
        </ThemedText> : null}
    </View>;
}

function JournalDraft({movie, entry, onClose}: Omit<Props, 'visible' | 'movie'> & {movie: JournalMovie}) {
    const {colors} = usePalette();
    const repository = useJournalRepository();
    const snapshot = useJournal();
    const [watchedOn, setWatchedOn] = useState(() => entry?.watchedOn ?? journalToday());
    const [rating, setRating] = useState<number | null>(entry?.rating ?? null);
    const [note, setNote] = useState(entry?.note ?? '');
    const [error, setError] = useState('');
    const save = () => {
        if (!snapshot.ready) return;
        let input;
        try {
            input = validateJournalInput({id: entry?.id, movie, watchedOn, rating, note});
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Check your journal entry.');
            return;
        }
        try {
            repository.save(input);
        } catch (failure) {
            setError(journalErrorMessage(failure, 'Your entry could not be saved. Try again.'));
            return;
        }
        Analytics.journal('entry_saved');
        onClose();
    };
    const inputStyle = [styles.input, {color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSunken}];
    return <View style={styles.form}>
        <View>
            <ThemedText type="defaultSemiBold">{movie.title}</ThemedText>
            {movie.year > 0 ? <ThemedText type="caption" style={{color: colors.textMuted}}>{movie.year}</ThemedText> : null}
        </View>
        <View style={styles.field}>
            <ThemedText type="caption">Watched on</ThemedText>
            <WatchlistSheetInput accessibilityLabel="Watched on, YYYY-MM-DD" value={watchedOn} onChangeText={setWatchedOn}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.textFaint} maxLength={10}
                autoCorrect={false} autoCapitalize="none" style={inputStyle}/>
        </View>
        <View style={styles.field}>
            <View style={styles.ratingHeading}>
                <ThemedText type="caption">Your rating (optional)</ThemedText>
                <PressableScale onPress={() => setRating(null)} accessibilityRole="button" accessibilityLabel="Clear rating"
                    contentStyle={styles.clear}>
                    <ThemedText type="caption" style={{color: colors.accent}}>{rating === null ? 'Unrated' : 'Clear'}</ThemedText>
                </PressableScale>
            </View>
            {[0, 5].map(offset => <View key={offset} style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map(value => {
                    const units = value + offset;
                    const selected = rating === units;
                    return <PressableScale key={units} style={styles.ratingButton} onPress={() => setRating(units)}
                        accessibilityRole="radio" accessibilityLabel={`${units / 2} stars`} accessibilityState={{selected}}
                        contentStyle={[styles.rating, {borderColor: selected ? colors.accent : colors.border,
                            backgroundColor: selected ? colors.accentSoft : colors.surfaceSunken}]}>
                        <ThemedText type="caption" style={{color: selected ? colors.accent : colors.text}}>{units / 2} ★</ThemedText>
                    </PressableScale>;
                })}
            </View>)}
        </View>
        <View style={styles.field}>
            <ThemedText type="caption">Private note (optional)</ThemedText>
            <WatchlistSheetInput accessibilityLabel="Private note" value={note} onChangeText={setNote}
                placeholder="What will you remember about this movie?" placeholderTextColor={colors.textFaint}
                maxLength={JOURNAL_MAX_NOTE_LENGTH} multiline textAlignVertical="top" style={[inputStyle, styles.note]}/>
            <ThemedText type="caption" style={[styles.count, {color: colors.textMuted}]}>{note.length}/{JOURNAL_MAX_NOTE_LENGTH}</ThemedText>
        </View>
        {error ? <ThemedText accessibilityRole="alert" style={{color: colors.danger}}>{error}</ThemedText> : null}
        {!snapshot.ready ? snapshot.error ? <View style={styles.field}>
            <ThemedText accessibilityRole="alert" style={{color: colors.danger}}>{journalErrorMessage(snapshot.error, 'Your journal could not be loaded.')}</ThemedText>
            {snapshot.error !== JOURNAL_DELETED_MESSAGE ? <PressableScale onPress={() => repository.retrySync()} accessibilityRole="button" accessibilityLabel="Retry journal sync"
                contentStyle={[styles.action, {borderColor: colors.border}]}>
                <ThemedText>Try again</ThemedText>
            </PressableScale> : null}
        </View> : <ThemedText type="caption" style={{color: colors.textMuted}}>Your journal is loading.</ThemedText> : null}
        <View style={styles.actions}>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel journal entry"
                contentStyle={[styles.action, {borderColor: colors.border}]}>
                <ThemedText>Cancel</ThemedText>
            </PressableScale>
            <PressableScale onPress={save} disabled={!snapshot.ready} accessibilityRole="button"
                accessibilityLabel={entry ? 'Save changes' : 'Save entry'} accessibilityState={{disabled: !snapshot.ready}}
                contentStyle={[styles.action, {borderColor: colors.accentStrong, backgroundColor: colors.accentStrong, opacity: snapshot.ready ? 1 : 0.5}]}>
                <ThemedText style={{color: colors.onAccent}}>{entry ? 'Save changes' : 'Save entry'}</ThemedText>
            </PressableScale>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    form: {gap: Spacing.lg},
    field: {gap: Spacing.sm},
    input: {...Typography.body, minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md},
    note: {minHeight: 128},
    count: {textAlign: 'right'},
    ratingHeading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm},
    clear: {minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm},
    ratingRow: {flexDirection: 'row', gap: Spacing.sm},
    ratingButton: {flex: 1, minWidth: 0},
    rating: {minHeight: 44, borderWidth: 1, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center'},
    actions: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-end'},
    action: {minHeight: 48, paddingHorizontal: Spacing.lg, borderWidth: 1, borderRadius: Radius.pill, justifyContent: 'center'},
});
