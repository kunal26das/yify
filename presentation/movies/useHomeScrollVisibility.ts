import {useEffect, useRef, useState} from 'react';
import type {Animated} from 'react-native';

const AT_TOP_THRESHOLD = 8;

export function useHomeScrollVisibility(scrollY: Animated.Value, heroHeight: number) {
    const [visibility, setVisibility] = useState({atTop: true, heroVisible: true});
    const current = useRef(visibility);
    const offset = useRef(0);

    useEffect(() => {
        const update = ({value}: {value: number}) => {
            offset.current = value;
            const atTop = value <= AT_TOP_THRESHOLD;
            const heroVisible = value < heroHeight;
            if (current.current.atTop === atTop && current.current.heroVisible === heroVisible) return;
            current.current = {atTop, heroVisible};
            setVisibility(current.current);
        };
        update({value: offset.current});
        const id = scrollY.addListener(update);
        return () => scrollY.removeListener(id);
    }, [heroHeight, scrollY]);

    return visibility;
}
