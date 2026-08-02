import {useCallback, useEffect, useMemo, useState} from 'react';
import {Image, type ImageContentFit} from 'expo-image';
import type {StyleProp, ImageStyle} from 'react-native';
import type {Movie} from '@/domain';
import {thumbCandidates, thumbPlaceholder} from './format';

const YT_PLACEHOLDER_MAX_WIDTH = 500;

export function Thumbnail({
                              movie,
                              style,
                              contentFit = 'cover',
                              transition = 180,
                              priority,
                          }: {
    movie: Movie;
    style?: StyleProp<ImageStyle>;
    contentFit?: ImageContentFit;
    transition?: number;
    priority?: 'low' | 'normal' | 'high';
}) {
    const candidates = useMemo(() => thumbCandidates(movie), [movie]);
    const placeholder = useMemo(() => thumbPlaceholder(movie), [movie]);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        setAttempt(0);
    }, [movie.id]);

    const advance = useCallback(() => {
        setAttempt((index) => (index + 1 < candidates.length ? index + 1 : index));
    }, [candidates.length]);

    const uri = candidates[Math.min(attempt, candidates.length - 1)];

    const onLoad = useCallback(
        (event: {source?: {width?: number} | null}) => {
            const loadedWidth = event.source?.width ?? 0;
            if (loadedWidth > 0 && loadedWidth < YT_PLACEHOLDER_MAX_WIDTH) advance();
        },
        [advance]
    );

    if (!uri) return null;

    return (
        <Image
            source={{uri}}
            placeholder={placeholder && placeholder !== uri ? {uri: placeholder} : undefined}
            placeholderContentFit={contentFit}
            style={style}
            contentFit={contentFit}
            transition={transition}
            priority={priority}
            cachePolicy="memory-disk"
            recyclingKey={`${movie.id}:${attempt}`}
            onError={advance}
            onLoad={onLoad}
        />
    );
}
