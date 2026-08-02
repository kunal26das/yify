export interface AccountSync {
    start(): void;

    setAccount(uid: string | null): void;
}
