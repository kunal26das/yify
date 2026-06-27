import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {type Deployment, type Platform} from '../container.js';
import {CheckboxList} from './CheckboxList.js';
import {LogPane} from './LogPane.js';
import {Field} from './Field.js';
import {BaseConfirm} from './BaseConfirm.js';
import {useBaseFlow} from './useBaseFlow.js';

export function BaseFlow({onDone}: { onDone: () => void }) {
    const vm = useBaseFlow();

    useInput((input) => {
        if (vm.step === 'result' && (input === 'm' || input === 'q')) onDone();
    });

    return (
        <Box flexDirection="column">
            <Text bold>Base release</Text>

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
                <Field label="Android .apk path">
                    <TextInput
                        value={vm.apk}
                        onChange={vm.setApk}
                        onSubmit={vm.submitApk}
                    />
                </Field>
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

            {vm.step === 'deployments' && (
                <Box flexDirection="column">
                    <Text>Target deployment(s):</Text>
                    <CheckboxList
                        options={[
                            {label: 'Staging', value: 'Staging'},
                            {label: 'Production', value: 'Production'},
                        ]}
                        initial={['Staging', 'Production']}
                        onSubmit={(d) => void vm.submitDeployments(d as Deployment[])}
                    />
                </Box>
            )}

            {vm.step === 'validating' && <Text>Validating binaries…</Text>}

            {vm.step === 'confirm' && <BaseConfirm vm={vm} onDone={onDone}/>}

            {(vm.step === 'running' || vm.step === 'result') && (
                <Box flexDirection="column">
                    <LogPane lines={vm.lines}/>
                    {vm.step === 'result' && (
                        <Box flexDirection="column" marginTop={1}>
                            {vm.ok ? (
                                <Box borderStyle="round" borderColor="green" paddingX={1}>
                                    <Text color="green" bold>
                                        🎉 Base release complete — all targets succeeded!
                                    </Text>
                                </Box>
                            ) : (
                                <Text color="red">✖ Base release finished with errors.</Text>
                            )}
                            <Text dimColor>Press m to return to the menu.</Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}
