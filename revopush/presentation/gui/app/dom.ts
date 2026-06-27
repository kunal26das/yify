export const $ = <T extends Element = HTMLElement>(sel: string): T =>
    document.querySelector<T>(sel) as T;

export const $$ = <T extends Element = HTMLElement>(sel: string): T[] =>
    Array.from(document.querySelectorAll<T>(sel));
