import {useCallback, useEffect, useRef, useState} from 'react';
import {hasSelectedStreamingOffer, type Movie, type StreamingAvailability} from '@/domain';
import {useStreamingRepository} from '../di/DependenciesContext';
import {usePreferences} from '../hooks/use-preferences';
import {useDeviceRegion} from './components/watchRegion';

const BATCH_SIZE = 20;
const CONCURRENCY = 2;

interface Results {
    country: string;
    entries: Record<string, StreamingAvailability>;
    busy: boolean;
    completed: number;
    total: number;
}

export function useWatchlistStreaming(movies: Movie[]) {
    const repository = useStreamingRepository();
    const preferences = usePreferences();
    const automatic = useDeviceRegion();
    const country = preferences.watchRegion ?? automatic;
    const services = preferences.streamingServices[country] ?? [];
    const [onlySelected, setOnlySelected] = useState(false);
    const [results, setResults] = useState<Results>({country, entries: {}, busy: false, completed: 0, total: 0});
    const currentCountry = useRef(country);
    currentCountry.current = country;
    const currentRun = useRef<{country: string} | null>(null);
    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;
        currentRun.current = null;
        return () => {mounted.current = false; currentRun.current = null;};
    }, [country, repository]);

    useEffect(() => {
        if (services.length === 0) setOnlySelected(false);
    }, [services.length]);

    const ids = [...new Set(movies.map(movie => movie.imdbCode).filter(id => /^tt\d{5,12}$/.test(id)))];
    const availability: Record<string, StreamingAvailability> = {};
    const current = (value: StreamingAvailability | null | undefined) => value?.country === country
        && (value.status === 'unavailable' || value.checkedAt == null || value.checkedAt > Date.now() - 86_400_000);
    for (const id of ids) {
        const cached = repository.getCachedAvailability(id, country);
        const result = results.country === country ? results.entries[id] : undefined;
        const value = current(cached) ? cached : current(result) ? result : undefined;
        if (value) availability[id] = value;
    }
    const unsupported = Object.values(availability).find(value => value.status === 'unsupported-country');
    if (unsupported) for (const id of ids) availability[id] = unsupported;
    const unchecked = ids.filter(id => !availability[id]);
    const failed = ids.filter(id => availability[id]?.status === 'unavailable');
    const pending = unchecked.length ? unchecked : failed;
    const filterActive = onlySelected && services.length > 0;
    const visible = filterActive ? movies.filter(movie => hasSelectedStreamingOffer(availability[movie.imdbCode], country, services)) : movies;
    const busy = results.country === country && results.busy && currentRun.current?.country === country;

    const checkNext = useCallback(async () => {
        if (currentRun.current || pending.length === 0) return;
        const run = {country};
        currentRun.current = run;
        const targets = pending.slice(0, BATCH_SIZE);
        const active = () => mounted.current && currentRun.current === run && currentCountry.current === country;
        setResults(current => ({country, entries: current.country === country ? current.entries : {},
            busy: true, completed: 0, total: targets.length}));
        let nextIndex = 0;
        let countryUnsupported = false;
        const worker = async () => {
            while (active() && !countryUnsupported) {
                const index = nextIndex++;
                if (index >= targets.length) return;
                const id = targets[index];
                let value: StreamingAvailability;
                try {
                    const received = await repository.getAvailability(id, country);
                    value = received.country === country ? {...received, checkedAt: received.checkedAt ?? Date.now()}
                        : {country, status: 'unavailable', offers: []};
                } catch {
                    value = {country, status: 'unavailable', offers: []};
                }
                if (!active()) return;
                if (value.status === 'unsupported-country') countryUnsupported = true;
                setResults(current => ({...current, entries: {...current.entries, [id]: value}, completed: current.completed + 1}));
            }
        };
        await Promise.all(Array.from({length: Math.min(CONCURRENCY, targets.length)}, () => worker()));
        if (!active()) return;
        currentRun.current = null;
        setResults(current => ({...current, busy: false}));
    }, [country, pending, repository]);

    return {country, services, availability, visible, filterActive, setOnlySelected,
        checkNext, busy, totalCount: ids.length, checkedCount: ids.filter(id => availability[id]?.status === 'ready').length,
        uncheckedCount: unchecked.length, failedCount: failed.length,
        unsupportedCountry: ids.some(id => availability[id]?.status === 'unsupported-country'),
        missingIdCount: movies.filter(movie => !/^tt\d{5,12}$/.test(movie.imdbCode)).length,
        nextCount: Math.min(pending.length, BATCH_SIZE),
        completed: results.country === country ? results.completed : 0,
        batchTotal: results.country === country ? results.total : 0};
}

export type WatchlistStreaming = ReturnType<typeof useWatchlistStreaming>;
