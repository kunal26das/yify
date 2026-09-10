import React from 'react';
import {Box, Text} from 'ink';
import {Confirm} from './Confirm.js';
import type {StoreFlowViewModel} from './useStoreFlow.js';

export function StoreConfirm({
                                 vm,
                                 onDone,
                             }: {
    vm: StoreFlowViewModel;
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
            <Text color="green">✓ Release inputs validated for v{vm.version}</Text>
            <Text>Platforms: {vm.platforms.join(', ')}</Text>
            <Text>Channels: {vm.channels.join(', ')}</Text>
            {vm.existingSummary ? (
                <Text color="yellow">
                    ⚠ This runtime version is already released on: {vm.existingSummary}
                </Text>
            ) : (
                <Text dimColor>No release recorded for this runtime version.</Text>
            )}
            {vm.allCovered ? (
                <Box flexDirection="column">
                    <Text color="yellow">
                        Nothing to ship — every channel already has this runtime version.
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
                            Channels that already have this runtime version will be skipped.
                        </Text>
                    ) : null}
                    <Text dimColor>Dependencies are reinstalled locally before the release.</Text>
                    {vm.platforms.includes('android') && vm.channels.includes('Production') && (
                        <Text dimColor>
                            Android Production: queue an Expo build with automatic Google Play submission, then return
                            once accepted.
                        </Text>
                    )}
                    {vm.platforms.includes('android') && vm.channels.includes('Staging') && (
                        <Text dimColor>
                            Android Staging: {vm.apk.trim() ? 'upload the supplied APK' : 'build locally and upload the APK'} to Firebase App Distribution.
                        </Text>
                    )}
                    {vm.platforms.includes('ios') && (
                        <Text dimColor>
                            iOS: record the IPA runtime for updates. Upload to App Store Connect separately.
                        </Text>
                    )}
                    <Confirm
                        onYes={() => void vm.start()}
                        onNo={onDone}
                        yesLabel="Ship store release"
                    />
                </Box>
            )}
        </Box>
    );
}
