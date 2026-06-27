import React from 'react';
import {Box, Text} from 'ink';
import {Confirm} from './Confirm.js';
import type {BaseFlowViewModel} from './useBaseFlow.js';

export function BaseConfirm({
                                vm,
                                onDone,
                            }: {
    vm: BaseFlowViewModel;
    onDone: () => void;
}) {
    if (vm.error) {
        return (
            <Box flexDirection="column">
                <Text color="red">✖ {vm.error}</Text>
                <Text dimColor>Press m to go back to the menu.</Text>
                <Confirm onYes={onDone} onNo={onDone} yesLabel="Back to menu" hideNo/>
            </Box>
        );
    }
    return (
        <Box flexDirection="column">
            <Text color="green">✓ apk and ipa both report v{vm.version}</Text>
            <Text>Deployments: {vm.deployments.join(', ')}</Text>
            {vm.existingSummary ? (
                <Text color="yellow">
                    ⚠ Base already exists for v{vm.version}: {vm.existingSummary}
                </Text>
            ) : (
                <Text dimColor>No existing base for this version.</Text>
            )}
            {vm.allCovered ? (
                <Box flexDirection="column">
                    <Text color="yellow">
                        Nothing to upload — every deployment already has a base.
                    </Text>
                    <Confirm
                        onYes={onDone}
                        onNo={onDone}
                        yesLabel="Back to menu"
                        hideNo
                    />
                </Box>
            ) : (
                <Box flexDirection="column">
                    {vm.existingSummary ? (
                        <Text dimColor>
                            Deployments that already have a base will be skipped.
                        </Text>
                    ) : null}
                    <Text dimColor>
                        Each release runs a clean install (rm -rf node_modules + yarn
                        install) first.
                    </Text>
                    <Confirm
                        onYes={() => void vm.start()}
                        onNo={onDone}
                        yesLabel="Upload base release"
                    />
                </Box>
            )}
        </Box>
    );
}
