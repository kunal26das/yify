const PROVIDER_SEARCH: Record<number, (query: string) => string> = {
    8: (q) => `https://www.netflix.com/search?q=${q}`,
    9: (q) => `https://www.primevideo.com/search?phrase=${q}`,
    119: (q) => `https://www.primevideo.com/search?phrase=${q}`,
    337: (q) => `https://www.disneyplus.com/search?q=${q}`,
    350: (q) => `https://tv.apple.com/search?term=${q}`,
    2: (q) => `https://tv.apple.com/search?term=${q}`,
    122: (q) => `https://www.hotstar.com/in/search?q=${q}`,
    232: (q) => `https://www.zee5.com/search?q=${q}`,
    970: (q) => `https://www.jiocinema.com/search/${q}`,
    237: (q) => `https://www.sonyliv.com/search?searchTerm=${q}`,
    15: (q) => `https://www.hulu.com/search?q=${q}`,
    1899: (q) => `https://play.max.com/search?q=${q}`,
    531: (q) => `https://www.paramountplus.com/search/${q}`,
    192: (q) => `https://www.youtube.com/results?search_query=${q}`,
    3: (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
};

export function providerUrl(providerId: number, title: string, fallback?: string): string | undefined {
    const build = PROVIDER_SEARCH[providerId];
    if (build) return build(encodeURIComponent(title));
    return fallback;
}

export function opensNativeApp(providerId: number): boolean {
    return PROVIDER_SEARCH[providerId] != null;
}
