import type {AuthSession} from '../entities/Account';

export interface AuthRepository {
    init(): void;

    getSession(): AuthSession;

    subscribe(listener: () => void): () => void;

    signIn(): Promise<boolean>;

    signOut(): Promise<void>;

    deleteAccount(): Promise<boolean>;

    getIdToken(): Promise<string | null>;
}
