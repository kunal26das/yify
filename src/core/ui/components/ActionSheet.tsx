import {View} from 'react-native';
import type {IconName} from '../icons/glyphs';
import {useTheme} from '../theme/useTheme';
import {ListItem} from './ListItem';
import {Sheet} from './Sheet';

export interface ActionSheetAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: readonly ActionSheetAction[];
}

export function ActionSheet({open, onClose, title, actions}: ActionSheetProps) {
  const theme = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <View role="list" style={{marginHorizontal: -theme.space.xl}}>
        {actions.map((action) => (
          <View role="listitem" key={action.label}>
            <ListItem
              headline={action.label}
              leading={{kind: 'icon', icon: action.icon}}
              destructive={action.destructive}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            />
          </View>
        ))}
      </View>
    </Sheet>
  );
}
