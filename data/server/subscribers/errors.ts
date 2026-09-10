export class SubscriberAccessError extends Error {
    constructor(readonly status: 401 | 403 | 503) {
        super(status === 401 ? 'Authentication is required' : status === 403 ? 'An active subscription is required' : 'Subscriber verification is unavailable');
        this.name = 'SubscriberAccessError';
    }
}
