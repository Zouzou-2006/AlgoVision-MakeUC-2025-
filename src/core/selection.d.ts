import type { OutlineNode } from './ir';
export interface SelectionEvent {
    type: 'node' | 'edge' | 'code';
    id: string;
    location?: {
        start: {
            line: number;
            column: number;
        };
        end: {
            line: number;
            column: number;
        };
    };
}
export declare class SelectionManager {
    private selectedId;
    private listeners;
    select(event: SelectionEvent): void;
    clear(): void;
    getSelected(): string | null;
    addListener(listener: (event: SelectionEvent) => void): void;
    removeListener(listener: (event: SelectionEvent) => void): void;
    private notifyListeners;
    syncCodeTo3D(node: OutlineNode): void;
    sync3DToCode(location: SelectionEvent['location']): void;
}
//# sourceMappingURL=selection.d.ts.map