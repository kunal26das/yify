const {app, Notification} = require('electron');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://movies-api.accel.li/api/v2';
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15000;
const POLL_MS = 60 * 60 * 1000;
const BURST_LIMIT = 5;

const DEFAULT_SETTINGS = {
    enabled: true,
    quality: '2160p',
    minimumRating: 0,
    genre: '',
    quietHours: false,
    quietStartHour: 22,
    quietEndHour: 8,
    perTitle: false,
};

function cacheFile() {
    return path.join(app.getPath('userData'), 'new-movies-cache.json');
}

function settingsFile() {
    return path.join(app.getPath('userData'), 'notification-settings.json');
}

function writeSettings(raw) {
    try {
        fs.writeFileSync(settingsFile(), typeof raw === 'string' ? raw : JSON.stringify(raw));
    } catch (e) {
        console.warn('[new-movies] failed to persist settings', e);
    }
}

function readSettings() {
    try {
        const parsed = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
        if (!parsed || typeof parsed !== 'object') return {...DEFAULT_SETTINGS};
        const settings = {...DEFAULT_SETTINGS};
        Object.keys(DEFAULT_SETTINGS).forEach((key) => {
            if (typeof parsed[key] === typeof DEFAULT_SETTINGS[key]) settings[key] = parsed[key];
        });
        return settings;
    } catch {
        return {...DEFAULT_SETTINGS};
    }
}

function isWithinQuietHours(now, startHour, endHour) {
    if (startHour === endHour) return false;
    const hour = now.getHours();
    if (startHour < endHour) return hour >= startHour && hour < endHour;
    return hour >= startHour || hour < endHour;
}

function matchesFilter(movie, settings) {
    if (settings.minimumRating > 0 && (movie.rating || 0) < settings.minimumRating) return false;
    const genre = settings.genre.trim().toLowerCase();
    if (!genre) return true;
    return (movie.genres || []).some((value) => String(value).trim().toLowerCase() === genre);
}

function readCache() {
    try {
        const raw = fs.readFileSync(cacheFile(), 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ids: Array.isArray(parsed.ids) ? parsed.ids : [],
            lastRunDate: typeof parsed.lastRunDate === 'string' ? parsed.lastRunDate : undefined,
            signature: typeof parsed.signature === 'string' ? parsed.signature : undefined,
        };
    } catch {
        return {ids: [], lastRunDate: undefined, signature: undefined};
    }
}

function writeCache(cache) {
    try {
        fs.writeFileSync(cacheFile(), JSON.stringify(cache));
    } catch (e) {
        console.warn('[new-movies] failed to persist cache', e);
    }
}

function localDateKey(date) {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchFirstPage(quality) {
    const url = `${BASE_URL}/list_movies.json?page=1&limit=${PAGE_SIZE}${
        quality ? `&quality=${encodeURIComponent(quality)}` : ''
    }`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(url, {signal: controller.signal});
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (json.status !== 'ok') throw new Error(json.status_message || 'Unknown API error');
        return (json.data && json.data.movies) || [];
    } finally {
        clearTimeout(timeout);
    }
}

function buildNotificationContent(newMovies) {
    if (newMovies.length === 1) {
        return {title: 'New movie added', body: newMovies[0].title, movieId: newMovies[0].id};
    }
    return {
        title: `${newMovies.length} new movies`,
        body: newMovies.slice(0, 3).map((m) => m.title).join(', '),
    };
}

function buildNotificationBatch(newMovies, perTitle) {
    if (!perTitle || newMovies.length > BURST_LIMIT) return [buildNotificationContent(newMovies)];
    return newMovies.map((movie) => buildNotificationContent([movie]));
}

async function checkForNewMovies(onClick, force = false) {
    if (!Notification.isSupported()) return 0;

    const settings = readSettings();
    if (!settings.enabled) return 0;

    const now = new Date();
    const today = localDateKey(now);
    const cache = readCache();
    if (!force && cache.lastRunDate === today) return 0;
    if (
        !force &&
        settings.quietHours &&
        isWithinQuietHours(now, settings.quietStartHour, settings.quietEndHour)
    ) {
        return 0;
    }

    const signature = `q:${settings.quality || 'all'}`;
    const knownSignature = cache.signature === undefined ? 'q:2160p' : cache.signature;
    const seeded = knownSignature === signature ? cache.ids : [];

    const movies = await fetchFirstPage(settings.quality);
    const ids = movies.map((m) => m.id);
    const cachedIds = new Set(seeded);

    if (seeded.length === 0) {
        writeCache({ids, lastRunDate: today, signature});
        return 0;
    }

    const fresh = movies.filter((m) => !cachedIds.has(m.id));
    writeCache({ids, lastRunDate: today, signature});

    const matched = fresh.filter((movie) => matchesFilter(movie, settings));
    if (matched.length === 0) return 0;

    buildNotificationBatch(matched, settings.perTitle).forEach((content) => {
        const notification = new Notification({title: content.title, body: content.body});
        notification.on('click', () => onClick(content.movieId));
        notification.show();
    });
    return matched.length;
}

function startNewMoviesNotifier(onClick) {
    const run = () => {
        checkForNewMovies(onClick).catch((e) =>
            console.warn('[new-movies] desktop check failed', e),
        );
    };
    const startupTimer = setTimeout(run, 10_000);
    const pollTimer = setInterval(run, POLL_MS);
    return () => {
        clearTimeout(startupTimer);
        clearInterval(pollTimer);
    };
}

module.exports = {startNewMoviesNotifier, checkForNewMovies, writeSettings};
