import React from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import {LogPane} from './LogPane.js';
import type {AuthViewModel} from './useAuth.js';

export function MainMenu({
                             auth,
                             onPick,
                         }: {
    auth: AuthViewModel;
    onPick: (s: 'base' | 'codepush' | 'quit') => void;
}) {
    if (auth.busy) {
        return (
            <Box flexDirection="column">
                <Text color="cyan">{auth.status || 'Working…'}</Text>
                <LogPane lines={auth.lines}/>
            </Box>
        );
    }

    const items = [
        {label: 'Base release (upload apk + ipa)', value: 'base' as const},
        {label: 'CodePush update (release-react)', value: 'codepush' as const},
        {
            label: `Log out${auth.email ? ` (${auth.email})` : ''}`,
            value: 'logout' as const,
        },
        {label: 'Quit', value: 'quit' as const},
    ];
    return (
        <SelectInput
            items={items}
            onSelect={(i) => {
                if (i.value === 'logout') void auth.logout();
                else onPick(i.value);
            }}
        />
    );
}
