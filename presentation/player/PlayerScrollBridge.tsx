import type {ReactNode} from 'react';

export interface PlayerScrollBridgeProps {
    active: boolean;
    targetId: string;
    width: number;
    height: number;
    children: ReactNode;
}

export function PlayerScrollBridge({children}: PlayerScrollBridgeProps) {
    return <>{children}</>;
}
