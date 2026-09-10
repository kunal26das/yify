import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {type Channel, type Platform} from '../container.js';
import {CheckboxList} from './CheckboxList.js';
import {LogPane} from './LogPane.js';
import {Field} from './Field.js';
import {StoreConfirm} from './StoreConfirm.js';
import {useStoreFlow} from './useStoreFlow.js';

export function StoreFlow({onDone}: { onDone: () => void }) {
    const vm = useStoreFlow();

    useInput((input) => {
        if (vm.step === 'result' && (input === 'm' || input === 'q')) onDone();
    });

    return (
        <Box flexDirection="column">
            <Text bold>Store release</Text>

            {vm.step === 'platforms' && (
                <Box flexDirection="column">
                    <Text>Platform(s):</Text>
                    <CheckboxList
                        options={[
                            {label: 'Android', value: 'android'},
                            {label: 'iOS', value: 'ios'},
                        ]}
                        initial={['android', 'ios']}
                        onSubmit={(p) => vm.choosePlatforms(p as Platform[])}
                    />
                </Box>
            )}

            {vm.step === 'apk' && (
                <Box flexDirection="column">
                    <Text dimColor>
                        Production builds on Expo. Leave this blank for Production or both channels.
                    </Text>
                    <Text dimColor>
                        For Staging only, provide an APK or leave blank for a local build.
                    </Text>
                    <Field label="Android .apk path (optional)">
                        <TextInput
                            value={vm.apk}
                            onChange={vm.setApk}
                            onSubmit={vm.submitApk}
                        />
                    </Field>
                </Box>
            )}

            {vm.step === 'ipa' && (
                <Field label="iOS .ipa path">
                    <TextInput
                        value={vm.ipa}
                        onChange={vm.setIpa}
                        onSubmit={vm.submitIpa}
                    />
                </Field>
            )}

            {vm.step === 'channels' && (
                <Box flexDirection="column">
                    <Text>Target channel(s):</Text>
                    <CheckboxList
                        options={[
                            {label: 'Staging', value: 'Staging'},
                            {label: 'Production', value: 'Production'},
                        ]}
                        initial={['Staging', 'Production']}
                        onSubmit={(c) => void vm.submitChannels(c as Channel[])}
                    />
                </Box>
            )}

            {vm.step === 'validating' && <Text>Validating release inputs…</Text>}

            {vm.step === 'confirm' && <StoreConfirm vm={vm} onDone={onDone}/>}

            {(vm.step === 'running' || vm.step === 'result') && (
                <Box flexDirection="column">
                    <LogPane lines={vm.lines}/>
                    {vm.step === 'result' && (
                        <Box flexDirection="column" marginTop={1}>
                            {vm.ok ? (
                                <Box borderStyle="round" borderColor="green" paddingX={1}>
                                    <Text color="green" bold>
                                        {vm.queuedCount > 0
                                            ? 'Release requests accepted.'
                                            : '🎉 Store release complete — all targets succeeded!'}
                                    </Text>
                                </Box>
                            ) : (
                                <Text color="red">✖ Store release ended with errors or cancellation.</Text>
                            )}
                            {vm.queuedCount > 0 && (
                                <Text dimColor>
                                    Queued on Expo. Play upload is automatic.
                                </Text>
                            )}
                            <Text dimColor>Press m to return to the menu.</Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}
