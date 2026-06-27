import React from 'react';
import {Box, Text} from 'ink';

export function Field({
                          label,
                          children,
                      }: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <Box>
            <Text>{label}: </Text>
            {children}
        </Box>
    );
}
