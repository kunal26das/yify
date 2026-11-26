import type {JSX} from 'react';
import type {UserList} from '@/core/domain/library';
import {Button} from '@/core/ui/components/Button';
import {ListItem} from '@/core/ui/components/ListItem';
import {Sheet} from '@/core/ui/components/Sheet';
import type {LibraryTarget} from './DiarySheet';
import {setListItem, useLists} from './lists';

function selectLists(lists: readonly UserList[]): readonly UserList[] {
  return lists;
}

export function AddToListSheet(props: {open: boolean; onClose: () => void; target: LibraryTarget}): JSX.Element | null {
  const {open, onClose, target} = props;
  const lists = useLists(selectLists);
  return (
    <Sheet open={open} onClose={onClose} title="Add to list" footer={<Button label="Done" onPress={onClose}/>}>
      {lists.map((list) => {
        const checked = list.items[target.key]?.value === true;
        return (
          <ListItem
            key={list.id}
            headline={list.name}
            trailing={{kind: 'check', checked}}
            onPress={() => setListItem(list.id, target.key, target.snapshot, !checked)}
          />
        );
      })}
    </Sheet>
  );
}
