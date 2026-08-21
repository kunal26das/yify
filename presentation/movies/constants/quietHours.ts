export const HOUR_OPTIONS = Array.from({length: 24}, (_, hour) => ({
    value: hour,
    label:
        hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`,
}));
