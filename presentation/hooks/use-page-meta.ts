export interface PageMeta {
    title: string;
    description?: string;
    canonical?: string | null;
    image?: string | null;
    type?: string;
}

export function usePageMeta(_meta: PageMeta): void {
}
