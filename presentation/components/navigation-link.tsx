import type {ComponentProps} from 'react';
import {Link} from 'expo-router';
import {Platform, type GestureResponderEvent} from 'react-native';
import {PressableScale} from './motion';

interface NavigationLinkProps extends Omit<ComponentProps<typeof PressableScale>, 'onPress'> {
    href: string;
    onNavigate: () => void;
}

export function NavigationLink({href, onNavigate, ...props}: NavigationLinkProps) {
    const onPress = (event: GestureResponderEvent) => {
        if (event.defaultPrevented) return;
        if (Platform.OS === 'web' && 'button' in event) {
            if (event.button !== 0 || ('metaKey' in event && event.metaKey) ||
                ('ctrlKey' in event && event.ctrlKey) || ('shiftKey' in event && event.shiftKey) ||
                ('altKey' in event && event.altKey)) return;
        }
        event.preventDefault();
        onNavigate();
    };

    return <Link href={href as never} asChild>
        <PressableScale {...props} onPress={onPress}/>
    </Link>;
}
