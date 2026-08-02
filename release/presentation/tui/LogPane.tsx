import React from 'react';
import {Box, Text} from 'ink';
import type {LogLine} from '../container.js';

export function LogPane({
                            lines,
                            max = 16,
                        }: {
    lines: LogLine[];
    max?: number;
}) {
    const tail = lines.slice(-max);
    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            paddingX={1}>
            {tail.length === 0 ? (
                <Text dimColor>(no output yet)</Text>
            ) : (
                tail.map((l, i) => (
                    <Text
                        key={i}
                        color={
                            l.stream === 'stderr'
                                ? 'red'
                                : l.stream === 'system'
                                    ? 'cyan'
                                    : undefined
                        }>
                        {l.text}
                    </Text>
                ))
            )}
        </Box>
    );
}
