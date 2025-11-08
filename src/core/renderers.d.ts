import * as THREE from 'three';
import type { OutlineNode, OutlineNodeType } from './ir';
import { SelectionManager } from './selection';
interface MeshUserData {
    nodeId: string;
    nodeType: OutlineNodeType;
    originalEmissiveIntensity?: number;
    onClick?: () => void;
}
export interface Node3D extends THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial> {
    userData: MeshUserData;
}
export declare class BaseRenderer {
    protected scene: THREE.Scene;
    protected selectionManager: SelectionManager;
    protected nodeMap: Map<string, Node3D>;
    constructor(scene: THREE.Scene, selectionManager: SelectionManager);
    createFunctionNode(node: OutlineNode): Node3D;
    createClassNode(node: OutlineNode): Node3D;
    createLoopNode(node: OutlineNode): Node3D;
    private setupInteraction;
    renderNodes(nodes: OutlineNode[]): void;
    private renderConnections;
    private createConnection;
    highlightNode(nodeId: string, highlight: boolean): void;
}
export {};
//# sourceMappingURL=renderers.d.ts.map