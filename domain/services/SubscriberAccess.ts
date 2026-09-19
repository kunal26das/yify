export type SubscriberAccessState = 'checking' | 'allowed' | 'denied' | 'unavailable';

/** A server-verified grant for subscriber features; local purchase flags are not proof of access. */
export interface SubscriberAccess {
    getState(): SubscriberAccessState;
    subscribe(listener: () => void): () => void;
    refresh(): Promise<void>;
}
