import {$} from './dom.js';
import {clearToasts, showToast} from './toast.js';
import type {AuthViewModel} from './authViewModel.js';
import type {LogViewModel} from './logViewModel.js';
import type {Info} from './types.js';

interface AuthChangeState {
    info: Info;
    loggedIn: boolean;
    email: string;
}

export class AuthView {
    vm: AuthViewModel;
    logVm: LogViewModel;
    #wasLoggedIn?: boolean;

    constructor(vm: AuthViewModel, logVm: LogViewModel) {
        this.vm = vm;
        this.logVm = logVm;
        vm.on('change', (state: AuthChangeState) => this.#render(state));

        $('#recheck').addEventListener('click', () => this.#recheck());
        $('#copyCmdBtn').addEventListener('click', () => this.#copyCmd());
        $('#logoutBtn').addEventListener('click', () => this.#logout());
        $('#openLoginBtn').addEventListener('click', () => this.#openLogin());
        $('#pasteKeyBtn').addEventListener('click', () => this.#keyAffixClick());
        $('#loginBtn').addEventListener('click', () => this.#login());
        $('#accessKey').addEventListener('input', () => this.#syncKeyAffix());
        $('#accessKey').addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.#login();
        });
    }

    #render({info, loggedIn, email}: AuthChangeState): void {
        if (loggedIn && this.#wasLoggedIn === false) {
            this.logVm?.clear();
            clearToasts();
        }
        const justLoggedOut = !loggedIn && this.#wasLoggedIn === true;
        this.#wasLoggedIn = loggedIn;

        if (justLoggedOut) {
            const gs = $('#gateStatus');
            gs.textContent = '';
            gs.className = 'status';
        }

        const branchEl = $('#branch');
        if (info.branch) {
            branchEl.classList.remove('hidden');
            branchEl.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="7" r="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M6 8.5v7M8.5 6.5h4a3 3 0 0 1 3 3v.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span></span>';
            branchEl.querySelector<HTMLElement>('span')!.textContent = info.branch;
        } else {
            branchEl.classList.add('hidden');
        }

        const titleVersion = info.packageVersion || info.version;
        const brandVersion = $('#brandVersion');
        if (brandVersion && titleVersion)
            brandVersion.textContent = 'v' + titleVersion;

        const who = $('#who');
        who.classList.toggle('online', loggedIn);
        who.querySelector<HTMLElement>('.dot')!.className = 'dot';
        who.querySelector<HTMLElement>('span:last-child')!.textContent = loggedIn
            ? email || 'Logged in'
            : 'Not logged in';

        $('#gate').classList.toggle('hidden', loggedIn);
        $('#app').classList.toggle('hidden', !loggedIn);
        $('#logoutBtn').classList.toggle('hidden', !loggedIn);
        if (loggedIn) $('#app').classList.add('fade');
    }

    async #copyCmd(): Promise<void> {
        const btn = $('#copyCmdBtn');
        try {
            await navigator.clipboard.writeText('revopush login');
            btn.classList.add('done');
            setTimeout(() => btn.classList.remove('done'), 1200);
            showToast('Command copied to clipboard.');
        } catch {
            showToast("Couldn't copy command.", 'warn');
        }
    }

    #keyAffixClick(): void {
        const input = $<HTMLInputElement>('#accessKey');
        if (input.value.trim()) {
            input.value = '';
            this.#syncKeyAffix();
            input.focus();
            return;
        }
        let text = '';
        try {
            text = this.vm.readClipboard().trim();
        } catch {
            text = '';
        }
        if (!text) {
            showToast('Clipboard is empty.', 'warn');
            input.focus();
            return;
        }
        input.value = text;
        this.#syncKeyAffix();
        showToast('Pasted from clipboard.');
        input.focus();
    }

    #syncKeyAffix(): void {
        const btn = $('#pasteKeyBtn');
        const input = $<HTMLInputElement>('#accessKey');
        const hasText = input.value.trim().length > 0;
        btn.classList.toggle('has-text', hasText);
        btn.setAttribute(
            'aria-label',
            hasText ? 'Clear access key' : 'Paste access key',
        );
        btn.setAttribute('title', hasText ? 'Clear' : 'Paste from clipboard');
    }

    async #recheck(): Promise<void> {
        const btn = $<HTMLButtonElement>('#recheck');
        btn.disabled = true;
        try {
            await this.vm.refresh();
            showToast('Status refreshed.');
        } catch {
            showToast("Couldn't refresh status.", 'bad');
        } finally {
            btn.disabled = false;
        }
    }

    async #logout(): Promise<void> {
        const btn = $<HTMLButtonElement>('#logoutBtn');
        btn.disabled = true;
        try {
            const res = await this.vm.logout();
            showToast(
                res.ok ? 'Signed out.' : "Couldn't sign out cleanly.",
                res.ok ? 'ok' : 'warn',
            );
            await this.vm.refresh();
        } catch {
            showToast("Couldn't sign out — something went wrong.", 'bad');
        } finally {
            btn.disabled = false;
        }
    }

    async #openLogin(): Promise<void> {
        const gs = $('#gateStatus');
        try {
            const res = await this.vm.openLoginPage();
            if (res && res.ok === false) throw new Error('openLoginPage failed');
            gs.textContent =
                'Opened the login page in your browser — copy your access key, then paste it above.';
            gs.className = 'status ok';
            showToast('Opened the login page in your browser.');
            $('#accessKey').focus();
        } catch {
            gs.textContent =
                "Couldn't open the login page — open app.revopush.org manually.";
            gs.className = 'status bad';
            showToast("Couldn't open the login page.", 'bad');
        }
    }

    async #login(): Promise<void> {
        const gs = $('#gateStatus');
        const keyInput = $<HTMLInputElement>('#accessKey');
        const key = keyInput.value.trim();
        if (!key) {
            gs.textContent = 'Paste your access key first.';
            gs.className = 'status warn';
            showToast('Paste your access key first.', 'warn');
            keyInput.focus();
            return;
        }

        const loginBtn = $<HTMLButtonElement>('#loginBtn');
        loginBtn.disabled = true;
        loginBtn.classList.add('is-loading');
        keyInput.disabled = true;
        gs.textContent = 'Signing in…';
        gs.className = 'status run';

        try {
            const res = await this.vm.login(key);
            if (res.ok) {
                keyInput.value = '';
                this.#syncKeyAffix();
                gs.textContent = 'Signed in.';
                gs.className = 'status ok';
                showToast('Signed in to RevoPush.');
                await this.vm.refresh();
            } else {
                gs.textContent =
                    'Login failed — double-check the access key and try again.';
                gs.className = 'status bad';
                showToast('Login failed — check the access key.', 'bad');
            }
        } catch {
            gs.textContent = 'Login failed — something went wrong. Try again.';
            gs.className = 'status bad';
            showToast('Login failed — something went wrong.', 'bad');
        } finally {
            loginBtn.disabled = false;
            loginBtn.classList.remove('is-loading');
            keyInput.disabled = false;
        }
    }
}
