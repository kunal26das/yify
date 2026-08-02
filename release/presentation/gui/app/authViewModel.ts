import {Emitter} from './emitter.js';
import {bridge} from './bridge.js';
import type {Info, OkResult} from './types.js';

export class AuthViewModel extends Emitter {
    info: Info = {repoRoot: '', version: '', packageVersion: '', branch: ''};
    loggedIn = false;
    account = '';

    async refresh(): Promise<void> {
        this.info = await bridge.info();
        const {loggedIn, name} = await bridge.checkAuth();
        this.loggedIn = loggedIn;
        this.account = name;
        this.emit('change', {info: this.info, loggedIn, name});
    }

    login(token: string): Promise<OkResult> {
        return bridge.login(token);
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
