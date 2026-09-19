export interface PageMeta {
    title: string;
    description?: string;
    canonical?: string | null;
    image?: string | null;
    type?: string;
    robots?: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
}

export function usePageMeta(_meta: PageMeta): void {
}
