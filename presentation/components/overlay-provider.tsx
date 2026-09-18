import type {ReactNode} from 'react';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {ConfirmDialogHost, ConfirmProvider} from './confirm-dialog';
import {ToastProvider} from './toast';

export function OverlayProvider({children}: {children: ReactNode}) {
    return (
        <ConfirmProvider>
            <ToastProvider>
                <BottomSheetModalProvider>
                    {children}
                    <ConfirmDialogHost/>
                </BottomSheetModalProvider>
            </ToastProvider>
        </ConfirmProvider>
    );
}
