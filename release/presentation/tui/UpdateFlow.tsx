import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {type Channel, type Platform} from '../container.js';
import {CheckboxList} from './CheckboxList.js';
import {LogPane} from './LogPane.js';
import {Field} from './Field.js';
import {useUpdateFlow} from './useUpdateFlow.js';

export function UpdateFlow({
                               onDone,
                               onNeedStoreRelease,
                           }: {
    onDone: () => void;
    onNeedStoreRelease: () => void;
}) {
    const vm = useUpdateFlow();

    useInput((input) => {
        if ((vm.step === 'result' || vm.step === 'blocked') && input === 'm')
            onDone();
        if (vm.step === 'blocked' && input === 'b') onNeedStoreRelease();
    });

    return (
        <Box flexDirection="column">
            <Text bold>EAS Update</Text>

            {vm.step === 'platforms' && (
                <Box flexDirection="column">
                    <Text>Platform(s):</Text>
                    <CheckboxList
                        options={[
                            {label: 'Android', value: 'android'},
                            {label: 'iOS', value: 'ios'},
                        ]}
                        onSubmit={(p) => vm.choosePlatforms(p as Platform[])}
                    />
                </Box>
            )}

            {vm.step === 'channel' && (
                <Box flexDirection="column">
                    <Text>Channel(s):</Text>
                    <CheckboxList
                        options={[
                            {label: 'Staging', value: 'Staging'},
                            {label: 'Production', value: 'Production'},
                        ]}
                        onSubmit={(c) => vm.chooseChannels(c as Channel[])}
                    />
                </Box>
            )}

            {vm.step === 'message' && (
                <Box flexDirection="column">
                    <Field label="Update message">
                        <TextInput
                            value={vm.message}
                            onChange={vm.setMessage}
                            onSubmit={() => vm.message.trim() && void vm.start()}
                        />
                    </Field>
                    <Text dimColor>
                        Each release runs a clean install (rm -rf node_modules + yarn
                        install) first.
                    </Text>
                </Box>
            )}

            {(vm.step === 'running' ||
                vm.step === 'result' ||
                vm.step === 'blocked') && (
                <Box flexDirection="column">
                    <Text dimColor>
                        {vm.platforms.join(', ')} · {vm.channels.join(', ')} ·{' '}
                        {vm.message}
                    </Text>
                    <LogPane lines={vm.lines}/>
                    {vm.step === 'blocked' && (
                        <Box flexDirection="column" marginTop={1}>
                            <Text color="yellow">
                                No store release for this runtime version: {vm.blocked.join(', ')}.
                            </Text>
                            <Text dimColor>
                                Press b to do a store release · m for menu
                            </Text>
                        </Box>
                    )}
                    {vm.step === 'result' && (
                        <Box flexDirection="column" marginTop={1}>
                            {vm.ok ? (
                                <Box borderStyle="round" borderColor="green" paddingX={1}>
                                    <Text color="green" bold>
                                        🎉 Update published — {vm.released} target
                                        {vm.released === 1 ? '' : 's'} succeeded!
                                    </Text>
                                </Box>
                            ) : (
                                <Text color="red">✖ Update finished with errors.</Text>
                            )}
                            <Text dimColor>Press m to return to the menu.</Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}
