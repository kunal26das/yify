import {useCallback, useEffect, useRef, useState} from 'react';
import type {AnimeCategory, AnimeRelease} from '@/domain/entities/AnimeRelease';
import type {AnimeRepository} from '@/domain/repositories/AnimeRepository';
import {useReloadOnCatalogAccess} from '../hooks/use-reload-on-catalog-access';

export type AnimeStatus = 'loading' | 'ready' | 'empty' | 'unavailable';

interface FeedState {
    repository: AnimeRepository;
    releases: AnimeRelease[];
    status: AnimeStatus;
    refreshing: boolean;
    refreshFailed: boolean;
    limit: number;
}

function initialState(repository: AnimeRepository): FeedState {
    return {repository, releases: [], status: 'loading', refreshing: false, refreshFailed: false, limit: 75};
}

export function useAnimeViewModel(repository: AnimeRepository) {
    const [request, setRequest] = useState({query: '', category: 'all' as AnimeCategory, revision: 0});
    const [state, setState] = useState(() => initialState(repository));
    const generationRef = useRef(0);

    if (state.repository !== repository) setState(initialState(repository));

    useEffect(() => {
        const generation = ++generationRef.current;
        const controller = new AbortController();
        const load = async () => {
            try {
                const result = await repository.listAnime({query: request.query, category: request.category}, controller.signal);
                if (generation !== generationRef.current) return;
                setState({repository, releases: result.releases, limit: result.limit,
                    status: result.releases.length ? 'ready' : 'empty', refreshing: false, refreshFailed: false});
            } catch {
                if (generation !== generationRef.current) return;
                setState(current => ({...current, refreshing: false,
                    status: current.releases.length ? 'ready' : 'unavailable',
                    refreshFailed: current.releases.length > 0}));
            }
        };
        void load();
        return () => {
            generationRef.current += 1;
            controller.abort();
        };
    }, [repository, request]);

    const submitSearch = useCallback((value: string) => {
        const query = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
        generationRef.current += 1;
        setState(initialState(repository));
        setRequest(current => ({...current, query, revision: current.revision + 1}));
    }, [repository]);

    const selectCategory = useCallback((category: AnimeCategory) => {
        if (category === request.category) return;
        generationRef.current += 1;
        setState(initialState(repository));
        setRequest(current => ({...current, category, revision: current.revision + 1}));
    }, [repository, request.category]);

    const reload = useCallback(() => {
        generationRef.current += 1;
        setState(current => ({...current, refreshFailed: false, refreshing: true,
            status: current.releases.length ? 'ready' : 'loading'}));
        setRequest(current => ({...current, revision: current.revision + 1}));
    }, []);

    useReloadOnCatalogAccess(reload, state.status === 'loading' || state.refreshing);

    return {...state, query: request.query, category: request.category, submitSearch, selectCategory, reload};
}

export type AnimeViewModel = ReturnType<typeof useAnimeViewModel>;
