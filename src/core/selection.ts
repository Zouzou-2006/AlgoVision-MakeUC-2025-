// Selection management for 3D objects and code synchronization

import type { OutlineNode } from './ir';

export interface SelectionEvent {
  type: 'node' | 'edge' | 'code';
  id: string;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export class SelectionManager {
  private selectedId: string | null = null;
  private listeners: Set<(event: SelectionEvent) => void> = new Set();

  // Select an object (node, edge, or code segment)
  select(event: SelectionEvent): void {
    this.selectedId = event.id;
    this.notifyListeners(event);
  }

  // Clear current selection
  clear(): void {
    this.selectedId = null;
    this.notifyListeners({
      type: 'node',
      id: '',
    });
  }

  // Get currently selected ID
  getSelected(): string | null {
    return this.selectedId;
  }

  // Add a selection change listener
  addListener(listener: (event: SelectionEvent) => void): void {
    this.listeners.add(listener);
  }

  // Remove a listener
  removeListener(listener: (event: SelectionEvent) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(event: SelectionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Selection listener error:', error);
      }
    }
  }

  // Sync code selection with 3D objects
  syncCodeTo3D(node: OutlineNode): void {
    this.select({
      type: 'node',
      id: node.id,
      location: node.location,
    });
  }

  // Sync 3D selection with code editor
  sync3DToCode(location: SelectionEvent['location']): void {
    if (location) {
      // This would trigger a scroll-to-line in the editor
      this.select({
        type: 'code',
        id: 'code-selection',
        location,
      });
    }
  }
}