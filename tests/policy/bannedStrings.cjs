const BANNED_STRINGS = Object.freeze([
    /\byts\b/i,
    /yts\.(mx|pw|lt|am|ag|to)/i,
    /img\.yts\./i,
    /accel\.li/i,
    /eztv/i,
    /nyaa/i,
    /wsrv\.nl/i,
    /torrent/i,
    /magnet:/i,
    /urn:btih:/i,
    /8b6ff243/,
    /buymeacoffee/i,
    /adsbygoogle/i,
    /googlesyndication/i,
]);

function bannedMatches(text) {
    return BANNED_STRINGS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.toString());
}

module.exports = {BANNED_STRINGS, bannedMatches};
