export class AuthTokenError extends Error {
    constructor(readonly failure: 'network' | 'denied' | 'server') {
        super('Account authentication is temporarily unavailable.');
        this.name = 'AuthTokenError';
    }
}
