import type {JSX} from 'react';
import {StyleSheet, View} from 'react-native';
import {localToday} from '@/core/domain/dates';
import type {EntryKey} from '@/core/domain/keys';
import type {TitleSnapshot} from '@/core/domain/library';
import {Button} from '@/core/ui/components/Button';
import {Sheet} from '@/core/ui/components/Sheet';
import {Text} from '@/core/ui/components/Text';
import {useTheme} from '@/core/ui/theme/useTheme';
import {logWatch} from './diary';

export interface LibraryTarget {
  key: EntryKey;
  snapshot: TitleSnapshot;
}

export function DiarySheet(props: {open: boolean; onClose: () => void; target: LibraryTarget; entryId?: string | null; startNew?: boolean}): JSX.Element | null {
  const {open, onClose, target, entryId, startNew} = props;
  const theme = useTheme();
  const editing = typeof entryId === 'string' && startNew !== true;
  const save = () => {
    logWatch({key: target.key, snapshot: target.snapshot, watchedOn: localToday(), rating: null, note: '', rewatch: startNew === true});
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit diary entry' : 'Log a watch'}
      footer={(
        <>
          <Button label="Cancel" variant="text" onPress={onClose}/>
          <Button label="Save" onPress={save}/>
        </>
      )}
    >
      <View style={[styles.body, {gap: theme.space.xs, paddingHorizontal: theme.space.xl}]}>
        <Text variant="titleMedium">{target.snapshot.title}</Text>
        {target.snapshot.year === null ? null : <Text variant="bodySmall" color="onSurfaceVariant">{String(target.snapshot.year)}</Text>}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({body: {alignSelf: 'stretch'}});
