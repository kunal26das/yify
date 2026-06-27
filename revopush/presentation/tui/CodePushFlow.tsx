import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {type Deployment, type Platform} from '../container.js';
import {CheckboxList} from './CheckboxList.js';
import {LogPane} from './LogPane.js';
import {Field} from './Field.js';
import {useCodePushFlow} from './useCodePushFlow.js';

export function CodePushFlow({
                                 onDone,
                                 onNeedBase,
                             }: {
    onDone: () => void;
    onNeedBase: () => void;
}) {
    const vm = useCodePushFlow();

    useInput((input) => {
        if ((vm.step === 'result' || vm.step === 'blocked') && input === 'm')
            onDone();
        if (vm.step === 'blocked' && input === 'b') onNeedBase();
    });

    return (
        <Box flexDirection="column">
            <Text bold>CodePush update</Text>

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

            {vm.step === 'deployment' && (
                <Box flexDirection="column">
                    <Text>Deployment(s):</Text>
                    <CheckboxList
                        options={[
                            {label: 'Staging', value: 'Staging'},
                            {label: 'Production', value: 'Production'},
                        ]}
                        onSubmit={(d) => vm.chooseDeployments(d as Deployment[])}
                    />
                </Box>
            )}

            {vm.step === 'version' && (
                <Box flexDirection="column">
                    <Field label="Target binary version">
                        <TextInput
                            value={vm.version}
                            onChange={vm.setVersion}
                            onSubmit={() => vm.version.trim() && void vm.start()}
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
                        {vm.platforms.join(', ')} · {vm.deployments.join(', ')} · v
                        {vm.version}
                    </Text>
                    <LogPane lines={vm.lines}/>
                    {vm.step === 'blocked' && (
                        <Box flexDirection="column" marginTop={1}>
                            <Text color="yellow">
                                No base release (v{vm.version}) for: {vm.blocked.join(', ')}.
                            </Text>
                            <Text dimColor>Press b to do a base release · m for menu</Text>
                        </Box>
                    )}
                    {vm.step === 'result' && (
                        <Box flexDirection="column" marginTop={1}>
                            {vm.ok ? (
                                <Box borderStyle="round" borderColor="green" paddingX={1}>
                                    <Text color="green" bold>
                                        {vm.released === 0 && vm.unchanged > 0
                                            ? '✓ Already up to date — no new release needed.'
                                            : vm.unchanged > 0
                                                ? `🎉 CodePush complete — ${vm.released} released, ${vm.unchanged} unchanged!`
                                                : '🎉 CodePush complete — all targets succeeded!'}
                                    </Text>
                                </Box>
                            ) : (
                                <Text color="red">✖ CodePush finished with errors.</Text>
                            )}
                            <Text dimColor>Press m to return to the menu.</Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}
