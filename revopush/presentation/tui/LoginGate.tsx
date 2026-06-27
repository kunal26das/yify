import React, {useState} from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {configFilePath} from '../container.js';
import {LogPane} from './LogPane.js';
import {Field} from './Field.js';
import type {AuthViewModel} from './useAuth.js';

export function LoginGate({
                              auth,
                              onQuit,
                          }: {
    auth: AuthViewModel;
    onQuit: () => void;
}) {
    const [mode, setMode] = useState<'menu' | 'enterKey'>('menu');
    const [key, setKey] = useState('');

    if (auth.busy) {
        return (
            <Box flexDirection="column">
                <Text color="cyan">{auth.status || 'Working…'}</Text>
                <LogPane lines={auth.lines}/>
            </Box>
        );
    }

    if (mode === 'enterKey') {
        return (
            <Box flexDirection="column">
                <Text color="yellow">Paste your RevoPush access key:</Text>
                <Field label="Access key">
                    <TextInput
                        value={key}
                        onChange={setKey}
                        onSubmit={() => {
                            const value = key;
                            setKey('');
                            setMode('menu');
                            void auth.login(value);
                        }}
                    />
                </Field>
                {auth.status ? <Text dimColor>{auth.status}</Text> : null}
                <Text dimColor>Enter to sign in</Text>
            </Box>
        );
    }

    const items = [
        {label: 'Open login page in browser', value: 'open' as const},
        {label: 'Paste access key & sign in', value: 'key' as const},
        {label: 'Re-check login status', value: 'recheck' as const},
        {label: 'Quit', value: 'quit' as const},
    ];

    return (
        <Box flexDirection="column">
            <Text color="yellow">You are not logged in to RevoPush.</Text>
            <Text dimColor>Session file: {configFilePath()}</Text>
            <Box marginTop={1}>
                <SelectInput
                    items={items}
                    onSelect={(i) => {
                        if (i.value === 'open') void auth.openLoginPage();
                        else if (i.value === 'key') setMode('enterKey');
                        else if (i.value === 'recheck') void auth.recheck();
                        else onQuit();
                    }}
                />
            </Box>
            {auth.status ? (
                <Box marginTop={1}>
                    <Text dimColor>{auth.status}</Text>
                </Box>
            ) : null}
        </Box>
    );
}
