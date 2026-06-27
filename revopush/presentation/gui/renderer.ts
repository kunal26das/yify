import {$} from './app/dom.js';
import {runState} from './app/runState.js';
import {bridge} from './app/bridge.js';
import {showToast} from './app/toast.js';
import {LogViewModel} from './app/logViewModel.js';
import {AuthViewModel} from './app/authViewModel.js';
import {BaseReleaseViewModel} from './app/baseReleaseViewModel.js';
import {CodePushViewModel} from './app/codePushViewModel.js';
import {initChrome} from './app/chrome.js';
import {LogView} from './app/logView.js';
import {AuthView} from './app/authView.js';
import {BaseReleaseView} from './app/baseReleaseView.js';
import {CodePushView} from './app/codePushView.js';

initChrome();

const logVm = new LogViewModel();
const authVm = new AuthViewModel();
const baseVm = new BaseReleaseViewModel();
const codePushVm = new CodePushViewModel();

new LogView(logVm);
new AuthView(authVm, logVm);
new BaseReleaseView(baseVm);
new CodePushView(codePushVm, authVm);

logVm.start();

runState.on('change', () => {
    $('#runbar').classList.toggle('active', runState.busy);
});

function hideLoader(): void {
    const loader = $('#loader');
    if (!loader) return;
    loader.classList.add('hide');
    loader.setAttribute('aria-busy', 'false');
    setTimeout(() => loader.remove(), 400);
}

authVm.refresh().finally(hideLoader);

window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (runState.busy) {
        bridge.cancelTask?.();
        showToast('Stopping the current task…', 'warn');
    } else {
        window.close();
    }
});
