import {$} from './dom.js';

export type ToastKind = 'ok' | 'warn' | 'bad';

const TOAST_ICONS: Record<ToastKind, string> = {
    ok: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    bad: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
};

export function clearToasts(): void {
    const wrap = $('#toasts');
    if (!wrap) return;
    wrap.querySelectorAll('.toast').forEach((t) => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    });
}

export function showToast(message: string, kind: ToastKind = 'ok'): void {
    const wrap = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (kind === 'ok' ? '' : ' ' + kind);

    const clean = String(message).replace(/^[✓✔✖✗⚠⚡•\s]+/, '');
    const time = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    t.innerHTML =
        '<span class="ticon">' +
        (TOAST_ICONS[kind] || TOAST_ICONS.ok) +
        '</span>' +
        '<span class="tbody"><span class="tmsg"></span><span class="ttime"></span></span>' +
        '<button class="tclose" type="button" aria-label="Dismiss">' +
        '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
        '</button>';
    t.querySelector<HTMLElement>('.tmsg')!.textContent = clean;
    t.querySelector<HTMLElement>('.ttime')!.textContent = time;
    const dismiss = () => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    };
    const closeBtn = t.querySelector<HTMLButtonElement>('.tclose')!;
    closeBtn.addEventListener('click', dismiss);

    closeBtn.classList.add('right');
    t.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = t.getBoundingClientRect();
        const onLeft = e.clientX - rect.left < rect.width / 2;
        closeBtn.classList.toggle('left', onLeft);
        closeBtn.classList.toggle('right', !onLeft);
    });

    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
}
