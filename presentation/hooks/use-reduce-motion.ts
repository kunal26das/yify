import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

export function useReduceMotion(): boolean {
    const [reduce, setReduce] = useState(false);
    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => {
                if (active) setReduce(enabled);
            })
            .catch(() => {
            });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
        return () => {
            active = false;
            subscription.remove();
        };
    }, []);
    return reduce;
}
