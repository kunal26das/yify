import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import type {Movie, MovieRepository} from '@/domain';
import {PressableScale} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {WatchlistSheetInput} from '../movies/components/WatchlistSheet';

interface Props {
    visible: boolean;
    repository: MovieRepository;
    savedMovies: Movie[];
    onSelect: (movie: Movie) => void;
}

const LIMIT = 20;

export function JournalMoviePicker(props: Props) {
    if (!props.visible) return null;
    return <MovieChoices repository={props.repository} savedMovies={props.savedMovies} onSelect={props.onSelect}/>;
}

function MovieChoices({repository, savedMovies, onSelect}: Omit<Props, 'visible'>) {
    const {colors} = usePalette();
    const [draft, setDraft] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Movie[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const generation = useRef(0);
    useEffect(() => () => {generation.current++;}, [repository]);

    const search = async (value: string) => {
        const next = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
        const request = ++generation.current;
        setQuery(next);
        setResults([]);
        setHasMore(false);
        setFailed(false);
        setLoading(!!next);
        if (!next) return;
        try {
            const response = await repository.listMovies({page: 1, limit: LIMIT, query: next});
            if (generation.current !== request) return;
            setResults(response.movies.slice(0, LIMIT));
            setHasMore(response.hasMore);
        } catch {
            if (generation.current !== request) return;
            setFailed(true);
        } finally {
            if (generation.current === request) setLoading(false);
        }
    };
    const movies = query ? results : savedMovies.slice(0, LIMIT);
    return <View style={styles.content}>
        <ThemedText type="caption" style={{color: colors.textMuted}}>Choose from your watchlist or search for a movie you watched.</ThemedText>
        <View style={styles.search}>
            <WatchlistSheetInput accessibilityLabel="Search movies for your journal" value={draft} onChangeText={setDraft}
                placeholder="Movie title" placeholderTextColor={colors.textFaint} maxLength={200} returnKeyType="search"
                autoCorrect={false} onSubmitEditing={() => void search(draft)}
                style={[styles.input, {color: colors.text, backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}/>
            <PressableScale accessibilityRole="button" accessibilityLabel="Search journal movies" onPress={() => void search(draft)}
                contentStyle={[styles.action, {backgroundColor: colors.accentStrong, borderColor: colors.accentStrong}]}>
                <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>Search</ThemedText>
            </PressableScale>
        </View>
        {query || draft ? <PressableScale accessibilityRole="button" accessibilityLabel="Clear journal movie search"
            onPress={() => {setDraft(''); void search('');}} contentStyle={styles.clear}>
            <ThemedText type="caption" style={{color: colors.accent}}>Back to saved movies</ThemedText>
        </PressableScale> : null}
        <ThemedText type="defaultSemiBold">{query ? 'Search results' : 'Saved movies'}</ThemedText>
        {loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="Searching movies"/> : failed ? <View style={styles.content}>
            <ThemedText accessibilityRole="alert" style={{color: colors.textMuted}}>Movies could not be loaded. Your saved movies are still available.</ThemedText>
            <PressableScale accessibilityRole="button" accessibilityLabel="Retry journal movie search" onPress={() => void search(query)}
                contentStyle={[styles.action, styles.start, {borderColor: colors.border}]}>
                <ThemedText>Try again</ThemedText>
            </PressableScale>
        </View> : movies.length ? <View style={styles.results}>
            {movies.map(movie => <PressableScale key={movie.id} accessibilityRole="button"
                accessibilityLabel={`Log ${movie.title}${movie.year ? ` (${movie.year})` : ''}`} onPress={() => onSelect(movie)}
                contentStyle={[styles.movie, {backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}>
                <ThemedText type="defaultSemiBold" style={styles.title}>{movie.title}</ThemedText>
                {movie.year > 0 ? <ThemedText type="caption" style={{color: colors.textMuted}}>{movie.year}</ThemedText> : null}
            </PressableScale>)}
        </View> : <ThemedText style={{color: colors.textMuted}}>
            {query ? 'No movies found. Try another title.' : 'No saved movies yet. Search above to start your journal.'}
        </ThemedText>}
        {!loading && !failed && (query ? hasMore : savedMovies.length > LIMIT) ? <ThemedText type="caption" style={{color: colors.textMuted}}>
            {query ? 'Search a more specific title to narrow these results.' : 'Showing your first 20 saved movies. Search to find another movie.'}
        </ThemedText> : null}
    </View>;
}

const styles = StyleSheet.create({
    content: {gap: Spacing.md},
    search: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm},
    input: {...Typography.body, flex: 1, minWidth: 144, minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md},
    action: {minHeight: 48, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, justifyContent: 'center'},
    start: {alignSelf: 'flex-start'},
    clear: {alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center'},
    results: {gap: Spacing.sm},
    movie: {minHeight: 60, gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1},
    title: {flexShrink: 1},
});
