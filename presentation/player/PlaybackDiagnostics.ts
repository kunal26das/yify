import type {Diagnostics, DiagnosticSpan} from '@/domain';

const ERRORS: Record<string, string> = {
    '2': 'invalid_parameter', invalid_parameter: 'invalid_parameter',
    '5': 'html5_error', HTML5_error: 'html5_error',
    '100': 'video_not_found', video_not_found: 'video_not_found',
    '101': 'embed_not_allowed', '150': 'embed_not_allowed', embed_not_allowed: 'embed_not_allowed',
    '153': 'missing_client_identity', handshake_timeout: 'handshake_timeout',
};

export class PlaybackDiagnostics {
    private wait?: DiagnosticSpan;
    private startup?: DiagnosticSpan;
    private buffering?: DiagnosticSpan;
    private timer?: ReturnType<typeof setTimeout>;
    private active = false;
    private started = false;
    private failed = false;
    private readyReported = false;
    private suspended = false;
    private played = false;

    constructor(private readonly diagnostics: Diagnostics) {}

    prepare(): void {
        this.stop();
        this.active = true;
        this.started = false;
        this.failed = false;
        this.readyReported = false;
        this.suspended = false;
        this.played = false;
        this.wait = this.diagnostics.start('player.ad_wait', {provider: 'youtube'});
    }

    begin(): void {
        if (!this.active || this.started || this.failed) return;
        this.started = true;
        this.wait?.finish();
        this.wait = undefined;
        if (!this.suspended) this.measureStartup('initial');
    }

    private measureStartup(stage: 'initial' | 'resume'): void {
        this.startup = this.diagnostics.start('player.start', {provider: 'youtube', stage});
        this.timer = setTimeout(() => {
            this.startup?.finish('timeout');
            this.startup = undefined;
            this.timer = undefined;
        }, 30_000);
    }

    ready(): void {
        if (!this.active || this.readyReported) return;
        this.readyReported = true;
        this.diagnostics.event('player.ready', {provider: 'youtube'});
    }

    state(state: string): void {
        if (!this.active || !this.started || this.failed || this.suspended) return;
        if (state === 'playing') {
            this.played = true;
            this.clearTimer();
            this.startup?.finish();
            this.startup = undefined;
            this.buffering?.finish();
            this.buffering = undefined;
        } else if (state === 'buffering' && !this.startup && !this.buffering) {
            this.buffering = this.diagnostics.start('player.buffer', {provider: 'youtube'});
        } else if (state === 'paused' || state === 'ended') {
            this.buffering?.finish(state === 'ended' ? 'ok' : 'cancelled');
            this.buffering = undefined;
        }
    }

    suspend(): void {
        if (!this.active || this.suspended) return;
        this.suspended = true;
        this.clearTimer();
        this.startup?.finish('cancelled');
        this.buffering?.finish('cancelled');
        this.startup = this.buffering = undefined;
    }

    resume(): void {
        if (!this.active || !this.suspended) return;
        this.suspended = false;
        if (this.started && !this.played && !this.failed) this.measureStartup('resume');
    }

    error(code: unknown): void {
        if (!this.active || this.failed) return;
        this.failed = true;
        const errorCode = typeof code === 'string' || typeof code === 'number'
            ? ERRORS[String(code)] ?? 'unknown' : 'unknown';
        this.clearTimer();
        const expected = errorCode === 'video_not_found' || errorCode === 'embed_not_allowed';
        const outcome = expected ? 'unavailable' : errorCode === 'handshake_timeout' ? 'timeout' : 'error';
        this.wait?.finish(outcome, {error_code: errorCode});
        this.startup?.finish(outcome, {error_code: errorCode});
        this.buffering?.finish(outcome, {error_code: errorCode});
        this.wait = this.startup = this.buffering = undefined;
        this.diagnostics.event('player.failure', {provider: 'youtube', error_code: errorCode, outcome});
        if (!expected && outcome !== 'timeout') {
            this.diagnostics.capture(new Error(`Player failed: ${errorCode}`), 'player.playback', {
                provider: 'youtube', error_code: errorCode,
            });
        }
    }

    stop(): void {
        this.clearTimer();
        this.wait?.finish('cancelled');
        this.startup?.finish('cancelled');
        this.buffering?.finish('cancelled');
        this.wait = this.startup = this.buffering = undefined;
        this.active = false;
    }

    private clearTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
    }
}
