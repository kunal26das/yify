import React from 'react';
import SelectInput from 'ink-select-input';

export function Confirm({
                            onYes,
                            onNo,
                            yesLabel = 'Yes',
                            hideNo = false,
                        }: {
    onYes: () => void;
    onNo: () => void;
    yesLabel?: string;
    hideNo?: boolean;
}) {
    const items = hideNo
        ? [{label: yesLabel, value: 'yes'}]
        : [
            {label: yesLabel, value: 'yes'},
            {label: 'Cancel', value: 'no'},
        ];
    return (
        <SelectInput
            items={items}
            onSelect={(i) => (i.value === 'yes' ? onYes() : onNo())}
        />
    );
}
