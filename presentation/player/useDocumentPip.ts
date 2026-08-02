export interface DocumentPipApi {
    supported: boolean;
    active: boolean;
    toggle: () => void;
    hostRef: (node: unknown) => void;
}

export function useDocumentPip(): DocumentPipApi {
    return {
        supported: false,
        active: false,
        toggle: () => {},
        hostRef: () => {},
    };
}
