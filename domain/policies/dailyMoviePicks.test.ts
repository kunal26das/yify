import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import type {Movie} from '../entities/Movie.ts';
import type {NotificationPreferences} from '../entities/NotificationPreferences.ts';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../tests/helpers/load-typescript.cjs');
const {buildDailyMoviePicks, localNotificationDateKey} = loadTypeScript('domain/policies/dailyMoviePicks.ts');

const preferences = {
    quality: '', minimumRating: 0, genre: '', quietHours: false,
    quietStartHour: 22, quietEndHour: 8, perTitle: false, dailyPicks: true, dailyHour: 19,
} as NotificationPreferences;

function movie(id: number, extra: Partial<Movie> = {}): Movie {
    return {id, title: `Movie ${id}`, titleLong: `Movie ${id}`, imdbCode: `tt${id}`, year: 2026,
        rating: 7, runtimeMinutes: 100, genres: ['Drama'], summary: '', language: 'en',
        mpaRating: '', posterUrls: [], ...extra};
}

const catalog = Array.from({length: 20}, (_, index) => movie(index + 1));
const now = () => new Date(2026, 8, 18, 12);
const build = (extra = {}) => buildDailyMoviePicks({now: now(), preferences, movies: catalog, watchlist: [], ...extra});
const ids = (picks: ReturnType<typeof build>) => picks.map((pick: {movieId: number}) => pick.movieId);
const keys = (picks: ReturnType<typeof build>) => picks.map((pick: {date: Date}) => localNotificationDateKey(pick.date));

function inTimezone<T>(timezone: string, run: () => T): T {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    try {
        return run();
    } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
    }
}

test('daily picks are unique, future, deterministic and bounded to seven dates', () => {
    const picks = build({days: 1000});
    assert.equal(picks.length, 7);
    assert.equal(new Set(ids(picks)).size, 7);
    assert.equal(new Set(keys(picks)).size, 7);
    assert.equal(new Set(picks.map((pick: {identifier: string}) => pick.identifier)).size, 7);
    assert.ok(picks.every((pick: {date: Date}) => pick.date > now() && pick.date.getHours() === 19 && pick.date.getMinutes() === 0));
    assert.deepEqual(build(), picks);
    assert.deepEqual(build({movies: [...catalog].reverse()}), picks);
    assert.equal(build({days: 2.9}).length, 2);
    assert.deepEqual(build({days: 0}), []);
    assert.deepEqual(build({days: -1}), []);
});

test('disabled picks, invalid dates and an empty eligible catalog schedule nothing', () => {
    assert.deepEqual(build({preferences: {...preferences, dailyPicks: false}}), []);
    assert.deepEqual(build({now: new Date('invalid')}), []);
    assert.deepEqual(build({movies: [], watchlist: []}), []);
    assert.deepEqual(build({preferences: {...preferences, minimumRating: 8}}), []);
    assert.equal(localNotificationDateKey(new Date('invalid')), '');
});

test('today is eligible before the selected hour, but not at or after that time', () => {
    assert.equal(keys(build({now: new Date(2026, 8, 18, 18, 59, 59)}))[0], '2026-09-18');
    assert.equal(keys(build({now: new Date(2026, 8, 18, 19)}))[0], '2026-09-19');
    assert.equal(keys(build({now: new Date(2026, 8, 18, 23)}))[0], '2026-09-19');
    assert.equal(build({preferences: {...preferences, dailyHour: Number.NaN}})[0].date.getHours(), 19);
    assert.equal(build({now: new Date(2026, 8, 18, 23), preferences: {...preferences, dailyHour: 0}})[0].date.getHours(), 0);
});

test('an opened day is skipped without consuming its movie pick', () => {
    const picks = build({lastActiveDate: '2026-09-18', days: 2});
    assert.deepEqual(keys(picks), ['2026-09-19', '2026-09-20']);
    assert.deepEqual(ids(picks), [1, 2]);
    assert.equal(keys(build({lastActiveDate: '2026-09-17'}))[0], '2026-09-18');
});

test('saved and discovery movies alternate without duplication and fall back when a pool ends', () => {
    const picks = build({watchlist: [movie(10), movie(12)], movies: [movie(10), movie(1), movie(2), movie(3)], days: 7});
    assert.deepEqual(ids(picks), [10, 1, 12, 2, 3]);
    assert.deepEqual(ids(build({watchlist: [movie(10), movie(12)], movies: []})), [10, 12]);
    assert.equal(picks[0].content.title, 'One from your Watchlist');
    assert.match(picks[0].content.body, /Movie 10/);
    assert.match(picks[1].content.body, /7\.0\/10 · Drama\. Take a closer look\./);
    assert.deepEqual(picks[0].content.data, {movieId: 10, kind: 'daily-pick', dateKey: '2026-09-18'});
    assert.equal(picks[0].identifier, 'yify-daily-pick:2026-09-18');
    assert.doesNotMatch(picks.map((pick: {content: {title: string; body: string}}) => `${pick.content.title} ${pick.content.body}`).join(' '), /newly|just added|now streaming|available on|watch now/i);
});

test('rating and explicit genre preferences filter both saved and discovery pools', () => {
    const picks = build({
        preferences: {...preferences, minimumRating: 7, genre: 'action'},
        watchlist: [movie(10, {rating: 6.9, genres: ['Action']}), movie(11, {genres: [' ACTION ']})],
        movies: [movie(1, {rating: 9, genres: ['Drama']}), movie(2, {rating: 7, genres: ['Action']}), movie(3, {rating: 6, genres: ['Action']})],
    });
    assert.deepEqual(ids(picks), [11, 2]);
});

test('saved genres softly rank discovery without excluding other genres', () => {
    const picks = build({
        watchlist: [movie(10, {genres: ['Comedy']})],
        movies: [movie(1, {rating: 9, genres: ['Drama']}), movie(2, {rating: 7, genres: ['Comedy']})],
    });
    assert.deepEqual(ids(picks), [10, 2, 1]);
});

test('watched and recently recommended IDs are excluded from both pools', () => {
    const picks = build({watchlist: [movie(10), movie(11)], movies: [movie(1), movie(2), movie(10), movie(11)],
        excludedIds: [10, 1], recentIds: [11]});
    assert.deepEqual(ids(picks), [2]);
    assert.deepEqual(build({movies: [movie(1)], excludedIds: [1]}), []);
    assert.deepEqual(build({movies: [movie(1)], recentIds: [1]}), []);
    assert.deepEqual(build({movies: [movie(1)], excludedIds: [...Array(4000).fill(99), 1]}), []);
    assert.deepEqual(build({movies: [movie(1)], recentIds: [...Array(4000).fill(99), 1]}), []);
});

test('invalid IDs and empty titles cannot produce notifications; duplicates are collapsed', () => {
    const picks = build({movies: [movie(0), movie(-1), movie(1.5), movie(Number.NaN), movie(2_147_483_648),
        movie(1, {title: '\n\u200b\t'}), movie(2), movie(2), movie(3, {title: '  A\nmovie\u202e  '})], watchlist: [movie(2), movie(2)]});
    assert.deepEqual(ids(picks), [2, 3]);
    assert.equal(picks[1].content.body, 'A movie · 7.0/10 · Drama. Take a closer look.');
});

test('untrusted titles and candidate inputs remain bounded', () => {
    const picks = build({movies: [movie(1, {title: '🎬'.repeat(2000), genres: []})]});
    assert.ok(Array.from(picks[0].content.body).length <= 200);
    assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(picks[0].content.body));
    assert.deepEqual(build({movies: [...Array.from({length: 1000}, () => movie(0)), movie(1)]}), []);
    assert.deepEqual(build({movies: [movie(1, {rating: Number.NaN})], preferences: {...preferences, minimumRating: 1}}), []);
});

test('notification copy uses real ratings and genres without inventing missing metadata', () => {
    const rated = build({movies: [movie(1, {title: 'A space story', rating: 8.2, genres: ['Sci-Fi']})]})[0];
    assert.equal(rated.content.title, 'Your next movie?');
    assert.equal(rated.content.body, 'A space story · 8.2/10 · Sci-Fi. Take a closer look.');
    const unknown = build({movies: [movie(1, {rating: 0, genres: []})]})[0];
    assert.equal(unknown.content.body, 'Movie 1. Take a closer look.');
    const invalid = build({movies: [movie(1, {rating: Number.NaN, genres: ['\u202eDrama\nPretend metadata']})]})[0];
    assert.equal(invalid.content.body, 'Movie 1. Take a closer look.');
    const filtered = build({preferences: {...preferences, genre: 'action'}, movies: [movie(1, {genres: ['Drama', 'Action']})]})[0];
    assert.match(filtered.content.body, / · Action\./);
});

test('quiet hours defer within a day and across midnight using delivery-day identifiers', () => {
    const daytime = build({preferences: {...preferences, dailyHour: 12, quietHours: true, quietStartHour: 9, quietEndHour: 17}});
    assert.equal(daytime[0].date.getHours(), 17);
    assert.equal(keys(daytime)[0], '2026-09-18');
    const overnight = build({preferences: {...preferences, dailyHour: 23, quietHours: true}, days: 3});
    assert.deepEqual(keys(overnight), ['2026-09-19', '2026-09-20', '2026-09-21']);
    assert.ok(overnight.every((pick: {date: Date}) => pick.date.getHours() === 8));
    assert.equal(overnight[0].identifier, 'yify-daily-pick:2026-09-19');
    assert.equal(overnight[0].content.data.dateKey, '2026-09-19');
    assert.equal(keys(build({preferences: {...preferences, dailyHour: 23, quietHours: true}, lastActiveDate: '2026-09-19'}))[0], '2026-09-20');
});

test('quiet-hour boundaries and early-morning deferrals remain future only', () => {
    const quiet = {...preferences, quietHours: true, dailyHour: 8};
    assert.equal(build({now: new Date(2026, 8, 18, 7), preferences: quiet})[0].date.getHours(), 8);
    const delayed = build({now: new Date(2026, 8, 18, 6), preferences: {...quiet, dailyHour: 5}});
    assert.equal(keys(delayed)[0], '2026-09-18');
    assert.equal(delayed[0].date.getHours(), 8);
    const equal = build({preferences: {...quiet, dailyHour: 19, quietStartHour: 19, quietEndHour: 19}});
    assert.equal(equal[0].date.getHours(), 19);
});

test('local calendar keys do not leak UTC dates and year boundaries advance correctly', () => {
    inTimezone('Asia/Kolkata', () => {
        assert.equal(localNotificationDateKey(new Date('2026-09-17T20:00:00Z')), '2026-09-18');
        const picks = build({now: new Date(2026, 11, 31, 20), days: 2});
        assert.deepEqual(keys(picks), ['2027-01-01', '2027-01-02']);
        assert.equal(picks[0].date.getHours(), 19);
    });
});

test('spring and autumn DST changes preserve the chosen local hour instead of adding 24 hours', () => {
    inTimezone('America/New_York', () => {
        const spring = build({now: new Date(2026, 2, 7, 12), days: 3});
        assert.deepEqual(keys(spring), ['2026-03-07', '2026-03-08', '2026-03-09']);
        assert.ok(spring.every((pick: {date: Date}) => pick.date.getHours() === 19));
        assert.equal(spring[1].date.getTime() - spring[0].date.getTime(), 23 * 60 * 60 * 1000);
        const autumn = build({now: new Date(2026, 9, 31, 12), days: 3});
        assert.deepEqual(keys(autumn), ['2026-10-31', '2026-11-01', '2026-11-02']);
        assert.ok(autumn.every((pick: {date: Date}) => pick.date.getHours() === 19));
        assert.equal(autumn[1].date.getTime() - autumn[0].date.getTime(), 25 * 60 * 60 * 1000);
    });
});

test('overnight quiet hours keep consecutive morning deliveries through both DST changes', () => {
    inTimezone('America/New_York', () => {
        const quiet = {...preferences, dailyHour: 23, quietHours: true};
        const spring = build({now: new Date(2026, 2, 6, 12), preferences: quiet, days: 3});
        assert.deepEqual(keys(spring), ['2026-03-07', '2026-03-08', '2026-03-09']);
        assert.ok(spring.every((pick: {date: Date}) => pick.date.getHours() === 8));
        assert.equal(spring[1].date.getTime() - spring[0].date.getTime(), 23 * 60 * 60 * 1000);
        const autumn = build({now: new Date(2026, 9, 30, 12), preferences: quiet, days: 3});
        assert.deepEqual(keys(autumn), ['2026-10-31', '2026-11-01', '2026-11-02']);
        assert.ok(autumn.every((pick: {date: Date}) => pick.date.getHours() === 8));
        assert.equal(autumn[1].date.getTime() - autumn[0].date.getTime(), 25 * 60 * 60 * 1000);
    });
});

test('nonexistent DST hours normalize forward and calendar jumps never duplicate a delivery date', () => {
    inTimezone('America/New_York', () => {
        const picks = build({now: new Date(2026, 2, 7, 12), preferences: {...preferences, dailyHour: 2}, days: 2});
        assert.deepEqual(keys(picks), ['2026-03-08', '2026-03-09']);
        assert.equal(picks[0].date.getHours(), 3);
        assert.equal(picks[1].date.getHours(), 2);
    });
    inTimezone('Pacific/Apia', () => {
        const picks = build({now: new Date(2011, 11, 29, 12), preferences: {...preferences, dailyHour: 23, quietHours: true}, days: 3});
        assert.deepEqual(keys(picks), ['2011-12-31', '2012-01-01', '2012-01-02']);
        assert.equal(new Set(keys(picks)).size, 3);
        assert.ok(picks.every((pick: {date: Date}) => pick.date.getHours() === 8));
    });
});

test('building a schedule does not mutate the input date, movies, preferences or exclusions', () => {
    const input = {now: now(), preferences: {...preferences}, movies: [movie(2), movie(1)],
        watchlist: [movie(10)], recentIds: [99], excludedIds: [98]};
    const snapshot = JSON.stringify(input);
    buildDailyMoviePicks(input);
    assert.equal(JSON.stringify(input), snapshot);
});
