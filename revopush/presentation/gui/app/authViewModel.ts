import {Emitter} from './emitter.js';
import {bridge} from './bridge.js';
import type {Info, OkResult} from './types.js';

export class AuthViewModel extends Emitter {
    info: Info = {repoRoot: '', version: '', packageVersion: '', branch: ''};
    loggedIn = false;
    email = '';

    async refresh(): Promise<void> {
        this.info = await bridge.info();
        const {loggedIn, email} = await bridge.checkAuth();
        this.loggedIn = loggedIn;
        this.email = email;
        this.emit('change', {info: this.info, loggedIn, email});
    }

    login(accessKey: string): Promise<OkResult> {
        return bridge.login(accessKey);
    }

    logout(): Promise<OkResult> {
        return bridge.logout();
    }

    openLoginPage(): Promise<{ ok: boolean; url?: string }> {
        return bridge.openLoginPage();
    }

    readClipboard(): string {
        return bridge.readClipboard();
    }
}
