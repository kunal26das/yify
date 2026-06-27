import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';

export interface CheckboxOption<T extends string> {
    label: string;
    value: T;
}

export function CheckboxList<T extends string>({
                                                   options,
                                                   initial = [],
                                                   onSubmit,
                                               }: {
    options: CheckboxOption<T>[];
    initial?: T[];
    onSubmit: (values: T[]) => void;
}) {
    const [cursor, setCursor] = useState(0);
    const [selected, setSelected] = useState<Set<T>>(new Set(initial));

    const rowCount = options.length + 1;
    const onConfirmRow = cursor === options.length;
    const canConfirm = selected.size > 0;

    const toggle = (value: T) =>
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(value) ? next.delete(value) : next.add(value);
            return next;
        });

    useInput((input, key) => {
        if (key.upArrow) setCursor((c) => (c - 1 + rowCount) % rowCount);
        else if (key.downArrow) setCursor((c) => (c + 1) % rowCount);
        else if (input === ' ') {
            if (!onConfirmRow) toggle(options[cursor].value);
        } else if (key.return) {
            if (onConfirmRow) {
                if (canConfirm) onSubmit(Array.from(selected));
            } else {
                toggle(options[cursor].value);
            }
        }
    });

    return (
        <Box flexDirection="column">
            {options.map((opt, i) => (
                <Text key={opt.value} color={i === cursor ? 'green' : undefined}>
                    {i === cursor ? '❯ ' : '  '}
                    {selected.has(opt.value) ? '[x] ' : '[ ] '}
                    {opt.label}
                </Text>
            ))}
            <Text
                color={onConfirmRow ? (canConfirm ? 'green' : 'yellow') : undefined}
                dimColor={!onConfirmRow}>
                {onConfirmRow ? '❯ ' : '  '}
                {canConfirm
                    ? `Continue ▸ (${selected.size} selected)`
                    : 'Continue ▸ — check at least one above'}
            </Text>
            <Text dimColor>
                ↑/↓ to move · Space or Enter to check · Continue to proceed
            </Text>
        </Box>
    );
}
