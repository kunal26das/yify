import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';
import {Button} from './Button';
import {Sheet} from './Sheet';
import {Text} from './Text';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export type Confirm = (request: ConfirmRequest) => void;

export const DEFAULT_CANCEL_LABEL = 'Cancel';

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (confirm === null) throw new Error('useConfirm needs a ConfirmProvider above it.');
  return confirm;
}

interface DialogState {
  request: ConfirmRequest;
  open: boolean;
}

export function ConfirmProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<DialogState | null>(null);
  const confirm = useCallback<Confirm>((request) => setState({request, open: true}), []);
  const settle = (run: (request: ConfirmRequest) => void) => {
    if (state === null || !state.open) return;
    setState({...state, open: false});
    run(state.request);
  };
  const cancel = () => settle((request) => request.onCancel?.());
  const accept = () => settle((request) => request.onConfirm());

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state === null ? null : (
        <Sheet
          open={state.open}
          onClose={cancel}
          title={state.request.title}
          presentation="dialog"
          footer={(
            <>
              <Button label={state.request.cancelLabel ?? DEFAULT_CANCEL_LABEL} variant="text" onPress={cancel}/>
              <Button label={state.request.confirmLabel} variant={state.request.destructive ? 'destructive' : 'filled'} onPress={accept}/>
            </>
          )}
        >
          <Text variant="bodyMedium" color="onSurfaceVariant">{state.request.message}</Text>
        </Sheet>
      )}
    </ConfirmContext.Provider>
  );
}
