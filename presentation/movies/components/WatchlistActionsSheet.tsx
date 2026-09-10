import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {LIBRARY_MAX_COLLECTIONS, LIBRARY_NAME_LIMIT, libraryCollectionContains, libraryMovieWatched, liveLibraryCollections, type LibraryRepository, type LibraryState, type Movie} from '@/domain';
import {useConfirm} from '../../components/confirm-dialog';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {useToast} from '../../components/toast';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {WatchlistControlButton} from './WatchlistControls';
import {WatchlistSheet, WatchlistSheetInput} from './WatchlistSheet';

interface WatchlistActionsSheetProps {
    visible: boolean;
    movie: Movie | null;
    library: LibraryRepository;
    state: LibraryState;
    onClose: () => void;
    onRemove: (movie: Movie) => void;
    onSelectCollection: (id: string) => void;
}

export function WatchlistActionsSheet(props: WatchlistActionsSheetProps) {
    return (
        <WatchlistSheet visible={props.visible} title={props.movie?.title ?? 'Collections'} onClose={props.onClose}>
            <WatchlistActionsContent key={`${props.visible ? 'open' : 'closed'}:${props.movie?.id ?? 'collections'}`} {...props}/>
        </WatchlistSheet>
    );
}

function WatchlistActionsContent({movie, library, state, onClose, onRemove, onSelectCollection}: WatchlistActionsSheetProps) {
    const {colors} = usePalette();
    const confirm = useConfirm();
    const toast = useToast();
    const [editor, setEditor] = useState<{id?: string; name: string} | null>(null);
    const [error, setError] = useState('');
    const collections = liveLibraryCollections(state);
    const watched = movie ? libraryMovieWatched(state, movie.id) : false;

    const saveCollection = () => {
        if (!editor) return;
        const name = editor.name.trim().replace(/\s+/g, ' ');
        if (!name) {
            setError('Give your collection a name.');
            return;
        }
        if (!editor.id && collections.length >= LIBRARY_MAX_COLLECTIONS) {
            setError(`You can keep up to ${LIBRARY_MAX_COLLECTIONS} collections.`);
            return;
        }
        try {
            const id = editor.id ?? library.createCollection(name);
            if (editor.id) library.renameCollection(id, name);
            setEditor(null);
            setError('');
            if (movie && !editor.id) {
                try {
                    library.setCollectionMembership(movie.id, id, true);
                } catch {
                    setError('Collection saved. This title could not be added.');
                }
            }
        } catch {
            setError('This collection could not be saved. Try again.');
        }
    };

    const deleteCollection = (id: string, name: string) => {
        onClose();
        confirm({
            title: 'Delete collection?',
            message: `“${name}” will be deleted. Its movies will stay in your watchlist.`,
            confirmLabel: 'Delete',
            destructive: true,
            icon: 'folder-outline',
            onConfirm: () => {
                try {
                    library.removeCollection(id);
                } catch {
                    toast('This collection could not be deleted.', 'alert-circle-outline');
                }
            },
        });
    };

    return (
        <>
            {movie ? (
                <WatchlistControlButton label={watched ? 'Mark as to watch' : 'Mark as watched'}
                                        icon={watched ? 'checkmark-circle' : 'checkmark-circle-outline'} active={watched}
                                        onPress={() => {
                                            try {
                                                library.setWatched(movie.id, !watched);
                                                setError('');
                                            } catch {
                                                setError('Watched status could not be updated. Try again.');
                                            }
                                        }}/>
            ) : null}
            <View style={styles.sectionHeading}>
                <ThemedText style={[styles.sectionLabel, {color: colors.textMuted}]}>{movie ? 'In collections' : 'Your collections'}</ThemedText>
                <WatchlistControlButton label="New collection" icon="add" onPress={() => {setEditor({name: ''}); setError('');}}/>
            </View>
            {editor ? (
                <View style={styles.editor}>
                    <WatchlistSheetInput value={editor.name} onChangeText={(name) => setEditor({...editor, name})}
                                         accessibilityLabel="Collection name" placeholder="Collection name" maxLength={LIBRARY_NAME_LIMIT}
                                         placeholderTextColor={colors.textFaint} autoFocus returnKeyType="done"
                                         onSubmitEditing={saveCollection}
                                         style={[styles.input, {color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSunken}]}/>
                    <View style={styles.editorActions}>
                        <WatchlistControlButton label="Cancel editing" onPress={() => {setEditor(null); setError('');}}/>
                        <WatchlistControlButton label={editor.id ? 'Save name' : 'Create collection'} active onPress={saveCollection}/>
                    </View>
                </View>
            ) : null}
            {error ? <ThemedText accessibilityRole="alert" style={[styles.error, {color: colors.danger}]}>{error}</ThemedText> : null}
            {collections.length === 0 && !editor ? (
                <ThemedText style={[styles.empty, {color: colors.textMuted}]}>Make a collection for movie nights, favorites, or anything you like.</ThemedText>
            ) : null}
            <View>
                {collections.map((collection) => {
                    const included = !!movie && libraryCollectionContains(state, collection.id, movie.id);
                    return (
                        <View key={collection.id} style={[styles.collectionRow, {borderBottomColor: colors.border}]}>
                            <PressableScale style={styles.collectionMain} contentStyle={styles.collectionButton}
                                            accessibilityRole={movie ? 'checkbox' : 'button'}
                                            accessibilityState={movie ? {checked: included} : undefined}
                                            accessibilityLabel={movie ? `${included ? 'Remove from' : 'Add to'} ${collection.name}` : `View ${collection.name}`}
                                            onPress={() => {
                                                if (!movie) {
                                                    onSelectCollection(collection.id);
                                                    onClose();
                                                    return;
                                                }
                                                try {
                                                    library.setCollectionMembership(movie.id, collection.id, !included);
                                                    setError('');
                                                } catch {
                                                    setError('Collection membership could not be updated. Try again.');
                                                }
                                            }}>
                                <Ionicons name={movie ? included ? 'checkbox' : 'square-outline' : 'folder-outline'}
                                          size={20} color={included ? colors.accent : colors.textMuted}/>
                                <ThemedText numberOfLines={2} style={styles.collectionName}>{collection.name}</ThemedText>
                            </PressableScale>
                            {!movie ? (
                                <>
                                    <PressableScale onPress={() => {setEditor({id: collection.id, name: collection.name}); setError('');}}
                                                    accessibilityRole="button" accessibilityLabel={`Rename ${collection.name}`} contentStyle={styles.iconButton}>
                                        <Ionicons name="pencil-outline" size={18} color={colors.textMuted}/>
                                    </PressableScale>
                                    <PressableScale onPress={() => deleteCollection(collection.id, collection.name)}
                                                    accessibilityRole="button" accessibilityLabel={`Delete ${collection.name}`} contentStyle={styles.iconButton}>
                                        <Ionicons name="trash-outline" size={18} color={colors.textMuted}/>
                                    </PressableScale>
                                </>
                            ) : null}
                        </View>
                    );
                })}
            </View>
            {movie ? (
                <WatchlistControlButton label="Remove from watchlist" icon="bookmark-outline"
                                        onPress={() => {onClose(); onRemove(movie);}}/>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    sectionHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm},
    sectionLabel: {fontSize: 13, fontWeight: '600', flexShrink: 1},
    editor: {gap: Spacing.sm},
    input: {height: 48, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.md, fontSize: 15},
    editorActions: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-end'},
    error: {fontSize: 13, lineHeight: 18},
    empty: {fontSize: 14, lineHeight: 20},
    collectionRow: {flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth},
    collectionMain: {flex: 1, minWidth: 0},
    collectionButton: {minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm},
    collectionName: {flex: 1, fontSize: 15},
    iconButton: {width: 44, height: 44, justifyContent: 'center', alignItems: 'center'},
});
