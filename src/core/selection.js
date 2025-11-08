// Selection management for 3D objects and code synchronization
export class SelectionManager {
    selectedId = null;
    listeners = new Set();
    // Select an object (node, edge, or code segment)
    select(event) {
        this.selectedId = event.id;
        this.notifyListeners(event);
    }
    // Clear current selection
    clear() {
        this.selectedId = null;
        this.notifyListeners({
            type: 'node',
            id: '',
        });
    }
    // Get currently selected ID
    getSelected() {
        return this.selectedId;
    }
    // Add a selection change listener
    addListener(listener) {
        this.listeners.add(listener);
    }
    // Remove a listener
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    notifyListeners(event) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (error) {
                console.error('Selection listener error:', error);
            }
        }
    }
    // Sync code selection with 3D objects
    syncCodeTo3D(node) {
        this.select({
            type: 'node',
            id: node.id,
            location: node.location,
        });
    }
    // Sync 3D selection with code editor
    sync3DToCode(location) {
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
//# sourceMappingURL=selection.js.map