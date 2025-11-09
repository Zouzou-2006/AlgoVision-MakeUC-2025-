// 3D rendering system using Three.js
import * as THREE from 'three';
import { SelectionManager } from './selection';
export class BaseRenderer {
    scene;
    selectionManager;
    nodeMap = new Map();
    constructor(scene, selectionManager) {
        this.scene = scene;
        this.selectionManager = selectionManager;
    }
    // Create a 3D box for functions
    createFunctionNode(node) {
        const geometry = new THREE.BoxGeometry(2, 1, 1);
        const material = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {
            nodeId: node.id,
            nodeType: 'function',
        };
        // Add label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        context.fillStyle = '#00ffff';
        context.font = 'bold 48px Fira Code';
        context.fillText(node.name, 10, 60);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.y = 1;
        mesh.add(sprite);
        this.setupInteraction(mesh);
        return mesh;
    }
    // Create a sphere for classes
    createClassNode(node) {
        const geometry = new THREE.SphereGeometry(0.8, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {
            nodeId: node.id,
            nodeType: 'class',
        };
        this.setupInteraction(mesh);
        return mesh;
    }
    // Create a cylinder for loops
    createLoopNode(node) {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: 0.7,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {
            nodeId: node.id,
            nodeType: 'loop',
        };
        this.setupInteraction(mesh);
        return mesh;
    }
    setupInteraction(mesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Hover effect
        mesh.userData.originalEmissiveIntensity = mesh.material.emissiveIntensity;
        // Click handler
        mesh.userData.onClick = () => {
            this.selectionManager.select({
                type: 'node',
                id: mesh.userData.nodeId,
            });
        };
    }
    renderNodes(nodes) {
        // Clear existing nodes
        this.nodeMap.forEach(node => this.scene.remove(node));
        this.nodeMap.clear();
        // Layout nodes in a grid
        const gridSize = Math.ceil(Math.sqrt(nodes.length));
        nodes.forEach((node, index) => {
            const x = (index % gridSize) * 4 - (gridSize * 2);
            const z = Math.floor(index / gridSize) * 4 - (gridSize * 2);
            let mesh;
            switch (node.type) {
                case 'function':
                    mesh = this.createFunctionNode(node);
                    break;
                case 'class':
                    mesh = this.createClassNode(node);
                    break;
                case 'loop':
                    mesh = this.createLoopNode(node);
                    break;
                default:
                    mesh = this.createFunctionNode(node); // Default fallback
            }
            mesh.position.set(x, 0, z);
            this.scene.add(mesh);
            this.nodeMap.set(node.id, mesh);
        });
        // Add connections
        this.renderConnections(nodes);
    }
    renderConnections(nodes) {
        // Simple connection rendering - can be enhanced with force-directed layout
        nodes.forEach((node, index) => {
            if (node.children && node.children.length > 0) {
                const parentMesh = this.nodeMap.get(node.id);
                node.children.forEach(child => {
                    const childMesh = this.nodeMap.get(child.id);
                    if (parentMesh && childMesh) {
                        this.createConnection(parentMesh, childMesh);
                    }
                });
            }
        });
    }
    createConnection(from, to) {
        const points = [from.position, to.position];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x888888,
            opacity: 0.5,
            transparent: true,
        });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
    }
    highlightNode(nodeId, highlight) {
        const mesh = this.nodeMap.get(nodeId);
        if (mesh) {
            const material = mesh.material;
            material.emissiveIntensity = highlight ? 0.5 : (mesh.userData.originalEmissiveIntensity ?? 0.2);
        }
    }
}
//# sourceMappingURL=renderers.js.map