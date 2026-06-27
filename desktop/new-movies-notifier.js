// Desktop "new movies" notifications, run from the Electron main process.
//
// The shared React Native code uses expo-background-task on native and a
// foreground check on web; neither covers a desktop window that's closed to the
// tray. The main process IS long-lived, so here we poll YTS on a daily timer,
// diff against a small JSON cache in userData, and fire native notifications even
// when the window is hidden. Clicking a notification deep-links into the app.

const {app, Notification} = require('electron');
const fs = require('fs');
const path = require('path');

// Mirrors DEFAULT_BASE_URL in data/datasources/YtsApiDataSource.ts. The desktop
// main process has no access to Firebase Remote Config, so it uses the default.
const BASE_URL = 'https://movies-api.accel.li/api/v2';
const PAGE_SIZE = 50;
const QUALITY = '2160p';
const REQUEST_TIMEOUT_MS = 15000;
const DAY_MS = 24 * 60 * 60 * 1000;

function cacheFile() {
    return path.join(app.getPath('userData'), 'new-movies-cache.json');
}

function readCache() {
    try {
        const raw = fs.readFileSync(cacheFile(), 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ids: Array.isArray(parsed.ids) ? parsed.ids : [],
            lastRunDate: typeof parsed.lastRunDate === 'string' ? parsed.lastRunDate : undefined,
        };
    } catch {
        return {ids: [], lastRunDate: undefined};
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

async function fetchFirstPage() {
    const url =
        `${BASE_URL}/list_movies.json?page=1&limit=${PAGE_SIZE}&quality=${QUALITY}`;
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

// Mirrors buildNotificationContent in lib/new-movies-diff.ts.
function buildNotificationContent(newMovies) {
    if (newMovies.length === 1) {
        return {title: 'New movie added', body: newMovies[0].title, movieId: newMovies[0].id};
    }
    return {
        title: `${newMovies.length} new movies`,
        body: newMovies.slice(0, 3).map((m) => m.title).join(', '),
    };
}

/**
 * @param {(movieId?: number) => void} onClick invoked when the user clicks a
 *   notification, with the movie id to deep-link to (undefined for the multi
 *   "N new movies" case).
 */
async function checkForNewMovies(onClick, force = false) {
    if (!Notification.isSupported()) return 0;

    const today = localDateKey(new Date());
    const cache = readCache();
    if (!force && cache.lastRunDate === today) return 0;

    const movies = await fetchFirstPage();
    const ids = movies.map((m) => m.id);
    const cachedIds = new Set(cache.ids);

    // First run seeds the baseline silently.
    if (cache.ids.length === 0) {
        writeCache({ids, lastRunDate: today});
        return 0;
    }

    const newMovies = movies.filter((m) => !cachedIds.has(m.id));
    writeCache({ids, lastRunDate: today});

    if (newMovies.length > 0) {
        const content = buildNotificationContent(newMovies);
        const notification = new Notification({title: content.title, body: content.body});
        notification.on('click', () => onClick(content.movieId));
        notification.show();
    }
    return newMovies.length;
}

/**
 * Run a check shortly after launch and then once a day. Returns a disposer that
 * clears the timer.
 * @param {(movieId?: number) => void} onClick
 */
function startNewMoviesNotifier(onClick) {
    const run = () => {
        checkForNewMovies(onClick).catch((e) =>
            console.warn('[new-movies] desktop check failed', e),
        );
    };
    // Defer the first run so launch isn't blocked on the network.
    const startupTimer = setTimeout(run, 10_000);
    const dailyTimer = setInterval(run, DAY_MS);
    return () => {
        clearTimeout(startupTimer);
        clearInterval(dailyTimer);
    };
}

module.exports = {startNewMoviesNotifier, checkForNewMovies};
