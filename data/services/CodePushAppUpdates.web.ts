import {IDLE_UPDATE_STATUS, type AppUpdates, type UpdateStatus} from '@/domain';

export class CodePushAppUpdates implements AppUpdates {
    getStatus(): UpdateStatus {
        return IDLE_UPDATE_STATUS;
    }

    subscribe(): () => void {
        return () => undefined;
    }

    start(): void {
    }

    async sync(): Promise<void> {
    }

    dismiss(): void {
    }

    restart(): void {
    }
}
