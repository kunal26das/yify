export type UpdateState =
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'installing'
    | 'ready'
    | 'error';

export interface UpdateStatus {
    state: UpdateState;
    progress: number;
}

export const IDLE_UPDATE_STATUS: UpdateStatus = {state: 'idle', progress: 0};
