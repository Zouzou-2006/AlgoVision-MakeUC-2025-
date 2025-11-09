import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import './Diagram.css';
/**
 * Neon Circuit color scheme - Futuristic + Glowing
 */
const NODE_COLORS = {
    module: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Module' }, // Primary Accent (Cyan)
    function: { main: 0x845EC2, glow: 0x845EC2, label: 'Function' }, // Tertiary Accent (Purple)
    class: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Class' }, // Primary Accent (Cyan)
    variable: { main: 0xA8B2D1, glow: 0xA8B2D1, label: 'Variable' }, // Text Secondary
    loop: { main: 0xFF9F1C, glow: 0xFF9F1C, label: 'Loop' }, // Control Lines (Orange)
    conditional: { main: 0xFF2E63, glow: 0xFF2E63, label: 'Conditional' }, // Secondary Accent (Magenta)
    namespace: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Namespace' }, // Primary Accent (Cyan)
    interface: { main: 0x845EC2, glow: 0x845EC2, label: 'Interface' }, // Tertiary Accent (Purple)
    struct: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Struct' }, // Primary Accent (Cyan)
    property: { main: 0xA8B2D1, glow: 0xA8B2D1, label: 'Property' }, // Text Secondary
    import: { main: 0x1F2833, glow: 0x1F2833, label: 'Import' }, // Graph Outline
};
const NODE_SIZES = {
    module: 1.8,
    class: 1.4,
    function: 1.0,
    variable: 0.7,
    loop: 0.85,
    conditional: 0.85,
    namespace: 1.3,
    interface: 1.2,
    struct: 1.35,
    property: 0.75,
    import: 0.6,
};
/**
 * Creates optimized geometries with proper detail levels
 */
function createNodeGeometry(type, size, detail = 16) {
    switch (type) {
        case 'class':
        case 'struct':
            return new THREE.BoxGeometry(size, size * 1.2, size, 2, 2, 2);
        case 'function':
            return new THREE.CylinderGeometry(size * 0.6, size * 0.6, size * 1.4, detail);
        case 'variable':
        case 'property':
            return new THREE.SphereGeometry(size, detail, detail);
        case 'loop':
            return new THREE.TorusGeometry(size * 0.6, size * 0.25, detail, 32);
        case 'conditional':
            return new THREE.ConeGeometry(size * 0.7, size * 1.3, 6);
        case 'module':
            return new THREE.OctahedronGeometry(size, 1);
        case 'namespace':
        case 'interface':
            return new THREE.IcosahedronGeometry(size, 0);
        case 'import':
            return new THREE.TetrahedronGeometry(size * 0.8, 0);
        default:
            return new THREE.SphereGeometry(size, detail, detail);
    }
}
/**
 * Creates emissive material with glow effect
 */
function createGlowMaterial(color, glowColor, intensity = 0.3) {
    return new THREE.MeshStandardMaterial({
        color: color,
        emissive: glowColor,
        emissiveIntensity: intensity,
        metalness: 0.3,
        roughness: 0.4,
        transparent: true,
        opacity: 0.95,
    });
}
/**
 * Creates curved edge for better visual flow
 */
function createCurvedEdge(from, to, type, color) {
    const midPoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const distance = from.distanceTo(to);
    const controlOffset = distance * 0.3;
    midPoint.y += controlOffset;
    return new THREE.QuadraticBezierCurve3(from, midPoint, to);
}
const Diagram = ({ visualizationData, isVisualizing, onSelectNode, selectedNodeId, code = '' }) => {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const animationFrameRef = useRef(null);
    const meshRefs = useRef(new Map());
    const lineRefs = useRef(new Map());
    const labelRefs = useRef(new Map());
    const glowLightRefs = useRef(new Map());
    const gridHelperRef = useRef(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [viewMode, setViewMode] = useState('structure');
    const [showLegend, setShowLegend] = useState(true);
    const effectiveSelectedNode = selectedNodeId ?? selectedNode;
    useEffect(() => {
        if (selectedNodeId !== undefined) {
            setSelectedNode(selectedNodeId);
        }
    }, [selectedNodeId]);
    const hoveredDetails = useMemo(() => {
        if (!hoveredNode || !visualizationData)
            return null;
        const node = visualizationData.nodes.find((n) => n.id === hoveredNode);
        if (!node)
            return null;
        let codeSnippet = '';
        if (code && node.location) {
            const lines = code.split('\n');
            const startLine = node.location.start.line;
            const endLine = Math.min(node.location.end.line, lines.length - 1);
            const snippet = lines.slice(startLine, endLine + 1).slice(0, 3).join('\n');
            if (snippet) {
                codeSnippet = snippet.trim();
            }
        }
        return { ...node, codeSnippet };
    }, [hoveredNode, visualizationData, code]);
    // Initialize Three.js scene with OrbitControls
    useEffect(() => {
        if (!containerRef.current)
            return;
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight || 600;
        // Create scene with futuristic background
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0f);
        scene.fog = new THREE.FogExp2(0x0a0a0f, 0.06); // Lighter fog for better visibility
        sceneRef.current = scene;
        // Create camera
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        camera.position.set(0, 10, 25);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;
        // Create renderer with performance optimizations
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        // Enhanced lighting with futuristic colors
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        // Main directional light with neon blue tint
        const mainLight = new THREE.DirectionalLight(0x00d9ff, 1.2);
        mainLight.position.set(15, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024; // Reduced for performance
        mainLight.shadow.mapSize.height = 1024;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -20;
        mainLight.shadow.camera.right = 20;
        mainLight.shadow.camera.top = 20;
        mainLight.shadow.camera.bottom = -20;
        mainLight.shadow.bias = -0.0001;
        scene.add(mainLight);
        // Fill light with violet tint
        const fillLight = new THREE.DirectionalLight(0x7c3aed, 0.4);
        fillLight.position.set(-10, 5, -10);
        scene.add(fillLight);
        // Rim light
        const rimLight = new THREE.DirectionalLight(0x06b6d4, 0.3);
        rimLight.position.set(0, -10, -15);
        scene.add(rimLight);
        // OrbitControls with damping for smooth camera movement
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.zoomSpeed = 1.2;
        controls.enablePan = true;
        controls.panSpeed = 0.8;
        controls.rotateSpeed = 0.5;
        controls.minDistance = 5;
        controls.maxDistance = 50;
        controls.maxPolarAngle = Math.PI / 1.8; // Prevent going under the ground
        controls.target.set(0, 0, 0);
        controls.update();
        controlsRef.current = controls;
        // Update label positions
        const updateLabelPositions = () => {
            if (!cameraRef.current || !containerRef.current)
                return;
            labelRefs.current.forEach((label, nodeId) => {
                const mesh = meshRefs.current.get(nodeId);
                if (!mesh)
                    return;
                const vector = mesh.position.clone();
                vector.project(cameraRef.current);
                const x = (vector.x * 0.5 + 0.5) * container.clientWidth;
                const y = (vector.y * -0.5 + 0.5) * container.clientHeight;
                label.style.left = `${x}px`;
                label.style.top = `${y}px`;
                label.style.display = vector.z < 1 ? 'block' : 'none';
            });
        };
        // Optimized animation loop
        let lastLabelUpdate = 0;
        const LABEL_UPDATE_INTERVAL = 100;
        let lastTime = performance.now();
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            const now = performance.now();
            const deltaTime = now - lastTime;
            lastTime = now;
            // Update controls (required for damping)
            if (controlsRef.current) {
                controlsRef.current.update();
            }
            // Subtle rotation for visual appeal (only when not interacting)
            if (!controlsRef.current?.enableRotate || controlsRef.current.getAzimuthalAngle() === 0) {
                meshRefs.current.forEach((mesh) => {
                    mesh.rotation.y += 0.001 * (deltaTime / 16.67); // Frame-rate independent
                });
            }
            // Update label positions (throttled)
            if (now - lastLabelUpdate > LABEL_UPDATE_INTERVAL) {
                updateLabelPositions();
                lastLabelUpdate = now;
            }
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };
        animate();
        // Handle window resize
        const handleResize = () => {
            if (!containerRef.current || !cameraRef.current || !rendererRef.current)
                return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight || 600;
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
            // OrbitControls automatically handles resize
        };
        window.addEventListener('resize', handleResize);
        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            // Clean up meshes
            meshRefs.current.forEach((mesh) => {
                scene.remove(mesh);
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                }
                else {
                    mesh.material.dispose();
                }
            });
            meshRefs.current.clear();
            // Clean up lines
            lineRefs.current.forEach((line) => {
                scene.remove(line);
                line.geometry.dispose();
                if (Array.isArray(line.material)) {
                    line.material.forEach(m => m.dispose());
                }
                else {
                    line.material.dispose();
                }
            });
            lineRefs.current.clear();
            // Clean up lights
            glowLightRefs.current.forEach((light) => {
                scene.remove(light);
            });
            glowLightRefs.current.clear();
            // Clean up grid helper
            if (gridHelperRef.current && sceneRef.current) {
                sceneRef.current.remove(gridHelperRef.current);
                gridHelperRef.current.dispose();
                gridHelperRef.current = null;
            }
            // Clean up controls
            if (controlsRef.current) {
                controlsRef.current.dispose();
            }
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);
    // Update visualization when data or view mode changes
    useEffect(() => {
        if (!visualizationData || !sceneRef.current)
            return;
        const scene = sceneRef.current;
        // Clear existing meshes, lines, and labels
        meshRefs.current.forEach((mesh) => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            }
            else {
                mesh.material.dispose();
            }
        });
        meshRefs.current.clear();
        lineRefs.current.forEach((line) => {
            scene.remove(line);
            line.geometry.dispose();
            if (Array.isArray(line.material)) {
                line.material.forEach(m => m.dispose());
            }
            else {
                line.material.dispose();
            }
        });
        lineRefs.current.clear();
        glowLightRefs.current.forEach((light) => {
            scene.remove(light);
        });
        glowLightRefs.current.clear();
        // Remove existing labels
        labelRefs.current.forEach((label) => {
            if (label.parentElement) {
                label.parentElement.removeChild(label);
            }
        });
        labelRefs.current.clear();
        // Calculate node positions based on view mode
        const nodePositions = new Map();
        const depthMap = new Map();
        const childrenMap = new Map();
        const roots = [];
        visualizationData.nodes.forEach((node) => {
            if (node.parentId) {
                if (!childrenMap.has(node.parentId)) {
                    childrenMap.set(node.parentId, []);
                }
                childrenMap.get(node.parentId).push(node);
            }
            else {
                roots.push(node);
            }
        });
        if (!roots.length && visualizationData.nodes.length) {
            roots.push(visualizationData.nodes[0]);
        }
        // Layout algorithm
        if (viewMode === 'structure') {
            const baseOrbit = 4.0;
            const verticalSpacing = 2.0;
            const placeNode = (node, position, depth) => {
                nodePositions.set(node.id, position);
                depthMap.set(node.id, depth);
                const children = childrenMap.get(node.id);
                if (!children || children.length === 0)
                    return;
                const orbit = baseOrbit * Math.max(0.5, Math.pow(0.7, depth)) + children.length * 0.3;
                children.forEach((child, index) => {
                    const angle = (index / children.length) * Math.PI * 2;
                    const childPos = new THREE.Vector3(position.x + Math.cos(angle) * orbit, position.y - verticalSpacing, position.z + Math.sin(angle) * orbit);
                    placeNode(child, childPos, depth + 1);
                });
            };
            roots.forEach((root, index) => {
                const angle = roots.length > 1 ? (index / roots.length) * Math.PI * 2 : 0;
                const radius = 8;
                const position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
                placeNode(root, position, 0);
            });
        }
        else {
            // Flow view - simplified force-directed layout
            const positions = new Map();
            visualizationData.nodes.forEach((node, index) => {
                const angle = (index / visualizationData.nodes.length) * Math.PI * 2;
                const radius = 5 + Math.random() * 3;
                positions.set(node.id, new THREE.Vector3(Math.cos(angle) * radius, (Math.random() - 0.5) * 4, Math.sin(angle) * radius));
            });
            // Simple force-directed layout (optimized)
            for (let iter = 0; iter < 15; iter++) {
                const forces = new Map();
                visualizationData.nodes.forEach(node => {
                    forces.set(node.id, new THREE.Vector3(0, 0, 0));
                });
                visualizationData.nodes.forEach((node1, i) => {
                    visualizationData.nodes.slice(i + 1).forEach(node2 => {
                        const pos1 = positions.get(node1.id);
                        const pos2 = positions.get(node2.id);
                        const diff = new THREE.Vector3().subVectors(pos1, pos2);
                        const distance = Math.max(diff.length(), 0.1);
                        const force = 0.1 / (distance * distance);
                        diff.normalize().multiplyScalar(force);
                        forces.get(node1.id).add(diff);
                        forces.get(node2.id).sub(diff);
                    });
                });
                visualizationData.edges.forEach(edge => {
                    const pos1 = positions.get(edge.from);
                    const pos2 = positions.get(edge.to);
                    if (pos1 && pos2 && forces.has(edge.from) && forces.has(edge.to)) {
                        const diff = new THREE.Vector3().subVectors(pos2, pos1);
                        const distance = diff.length();
                        const force = distance * 0.02;
                        diff.normalize().multiplyScalar(force);
                        forces.get(edge.from).add(diff);
                        // Create a new vector for the opposite direction to avoid modifying diff
                        const oppositeForce = diff.clone().multiplyScalar(-1);
                        forces.get(edge.to).add(oppositeForce);
                    }
                });
                forces.forEach((force, nodeId) => {
                    const pos = positions.get(nodeId);
                    force.multiplyScalar(0.1);
                    pos.add(force);
                });
            }
            positions.forEach((pos, nodeId) => {
                nodePositions.set(nodeId, pos);
                depthMap.set(nodeId, 0);
            });
        }
        // Ensure all nodes have positions
        visualizationData.nodes.forEach((node) => {
            if (!nodePositions.has(node.id)) {
                nodePositions.set(node.id, new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10));
            }
        });
        // Create node meshes with optimized geometries
        const geometryCache = new Map();
        visualizationData.nodes.forEach((node) => {
            const position = nodePositions.get(node.id);
            const depth = depthMap.get(node.id) ?? 0;
            const nodeType = node.type;
            const baseSize = NODE_SIZES[nodeType] || 1.0;
            const depthScale = Math.max(0.4, Math.pow(0.75, depth));
            const size = baseSize * depthScale;
            // Use cached geometry or create new one
            const geometryKey = `${nodeType}-${size.toFixed(2)}`;
            let baseGeometry = geometryCache.get(geometryKey);
            if (!baseGeometry) {
                baseGeometry = createNodeGeometry(nodeType, size, 12); // Reduced detail for performance
                geometryCache.set(geometryKey, baseGeometry);
            }
            // Clone geometry for each mesh to avoid disposal issues
            const geometry = baseGeometry.clone();
            const colorConfig = NODE_COLORS[nodeType] || NODE_COLORS.function || { main: 0x7c3aed, glow: 0xa855f7, label: 'Function' };
            const material = createGlowMaterial(colorConfig.main, colorConfig.glow, 0.3);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = {
                nodeId: node.id,
                nodeName: node.name,
                nodeType: nodeType,
                node: node
            };
            // Add glow light for important nodes
            if (nodeType === 'module' || nodeType === 'class') {
                const glowLight = new THREE.PointLight(colorConfig.glow, 0.6, 6);
                glowLight.position.copy(position);
                scene.add(glowLight);
                glowLightRefs.current.set(node.id, glowLight);
            }
            scene.add(mesh);
            meshRefs.current.set(node.id, mesh);
            // Create HTML label
            if (containerRef.current) {
                const label = document.createElement('div');
                label.className = 'node-label';
                label.textContent = node.name;
                label.style.color = `#${colorConfig.main.toString(16).padStart(6, '0')}`;
                containerRef.current.appendChild(label);
                labelRefs.current.set(node.id, label);
            }
        });
        // Create edges
        visualizationData.edges.forEach((edge) => {
            const fromPos = nodePositions.get(edge.from);
            const toPos = nodePositions.get(edge.to);
            if (!fromPos || !toPos)
                return;
            // Neon Circuit: Gradient between cyan (#00FFF5) and magenta (#FF2E63)
            const cyanColor = new THREE.Color(0x00FFF5);
            const magentaColor = new THREE.Color(0xFF2E63);
            let edgeWidth = 2.5;
            // Determine color based on edge type
            let startColor;
            let endColor;
            switch (edge.type) {
                case 'call':
                    startColor = cyanColor;
                    endColor = magentaColor;
                    edgeWidth = 2.5;
                    break;
                case 'data':
                    startColor = new THREE.Color(0xFF9F1C); // Control Lines (Orange)
                    endColor = new THREE.Color(0xFF9F1C);
                    edgeWidth = 2;
                    break;
                case 'control':
                    startColor = cyanColor;
                    endColor = magentaColor;
                    edgeWidth = 2;
                    break;
                default:
                    startColor = cyanColor;
                    endColor = magentaColor;
            }
            let curve;
            if (viewMode === 'flow') {
                curve = createCurvedEdge(fromPos, toPos, edge.type, 0x00FFF5);
            }
            else {
                curve = new THREE.LineCurve3(fromPos, toPos);
            }
            const points = curve.getPoints(50); // More points for smoother gradient
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            // Create gradient colors for vertices
            const colors = [];
            for (let i = 0; i < points.length; i++) {
                const t = i / (points.length - 1);
                const color = startColor.clone().lerp(endColor, t);
                colors.push(color.r, color.g, color.b);
            }
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                opacity: 0.8,
                transparent: true,
                linewidth: edgeWidth,
            });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            lineRefs.current.set(edge.id, line);
        });
        // Add subtle grid with Neon Circuit colors (only once)
        if (!gridHelperRef.current) {
            const gridHelper = new THREE.GridHelper(30, 30, 0x00FFF520, 0x00FFF510);
            gridHelper.position.y = -5;
            scene.add(gridHelper);
            gridHelperRef.current = gridHelper;
        }
    }, [visualizationData, viewMode]);
    // Handle node hover
    useEffect(() => {
        if (!containerRef.current || !sceneRef.current || !cameraRef.current || !visualizationData)
            return;
        const container = containerRef.current;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const onMouseMoveHover = (e) => {
            if (controlsRef.current?.enableRotate) {
                const rect = container.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouse, cameraRef.current);
                const intersects = raycaster.intersectObjects(Array.from(meshRefs.current.values()), true);
                if (intersects.length > 0) {
                    const [firstIntersection] = intersects;
                    if (firstIntersection) {
                        const mesh = firstIntersection.object;
                        const nodeId = mesh.userData.nodeId;
                        setHoveredNode(nodeId);
                        container.style.cursor = 'pointer';
                    }
                }
                else {
                    setHoveredNode(null);
                    container.style.cursor = 'default';
                }
            }
        };
        container.addEventListener('mousemove', onMouseMoveHover, { passive: true });
        return () => {
            container.removeEventListener('mousemove', onMouseMoveHover);
        };
    }, [visualizationData]);
    // Update node appearance
    useEffect(() => {
        meshRefs.current.forEach((mesh, id) => {
            const material = mesh.material;
            const nodeType = mesh.userData.nodeType;
            const colorConfig = NODE_COLORS[nodeType] || NODE_COLORS.function || { main: 0x7c3aed, glow: 0xa855f7, label: 'Function' };
            const isSelected = effectiveSelectedNode === id;
            const isHovered = hoveredNode === id;
            if (isSelected) {
                material.color.setHex(0x00d9ff);
                material.emissive.setHex(0x00d9ff);
                material.emissiveIntensity = 1.0;
                mesh.scale.set(1.4, 1.4, 1.4);
            }
            else if (isHovered) {
                material.color.setHex(colorConfig.glow);
                material.emissive.setHex(colorConfig.glow);
                material.emissiveIntensity = 0.7;
                mesh.scale.set(1.15, 1.15, 1.15);
            }
            else {
                material.color.setHex(colorConfig.main);
                material.emissive.setHex(colorConfig.glow);
                material.emissiveIntensity = 0.3;
                mesh.scale.set(1.0, 1.0, 1.0);
            }
        });
    }, [effectiveSelectedNode, hoveredNode]);
    // Focus camera on selected node
    useEffect(() => {
        if (!effectiveSelectedNode || !controlsRef.current || !cameraRef.current) {
            if (controlsRef.current) {
                controlsRef.current.target.set(0, 0, 0);
                controlsRef.current.update();
            }
            return;
        }
        const mesh = meshRefs.current.get(effectiveSelectedNode);
        if (mesh && controlsRef.current) {
            controlsRef.current.target.copy(mesh.position);
            controlsRef.current.update();
        }
    }, [effectiveSelectedNode]);
    // Handle node clicks
    useEffect(() => {
        if (!containerRef.current || !cameraRef.current)
            return;
        const container = containerRef.current;
        const camera = cameraRef.current;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const handleClick = (event) => {
            if (!visualizationData || !camera)
                return;
            const rect = container.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(Array.from(meshRefs.current.values()), true);
            if (intersects.length > 0) {
                const [firstHit] = intersects;
                if (firstHit) {
                    let target = firstHit.object;
                    while (target && !target.userData?.nodeId) {
                        target = target.parent;
                    }
                    const nodeId = target?.userData?.nodeId;
                    if (nodeId) {
                        setSelectedNode(nodeId);
                        onSelectNode?.(nodeId);
                        return;
                    }
                }
            }
            setSelectedNode(null);
            onSelectNode?.(null);
        };
        container.addEventListener('click', handleClick);
        return () => container.removeEventListener('click', handleClick);
    }, [visualizationData, onSelectNode]);
    return (_jsxs("div", { className: "diagram-container", ref: containerRef, children: [isVisualizing && (_jsx("div", { className: "visualization-loading", children: _jsx("div", { className: "loader", children: "Rendering 3D visualization..." }) })), !visualizationData && !isVisualizing && (_jsxs("div", { className: "canvas-placeholder", children: [_jsx("div", { style: { fontSize: '48px', marginBottom: '15px' } }), _jsx("div", { children: "Enter code and click \"Run Visualization\" to see your code in 3D" })] })), hoveredDetails && (_jsxs("div", { className: "node-tooltip-enhanced", children: [_jsxs("div", { className: "tooltip-header", children: [_jsx("div", { className: "tooltip-name", children: hoveredDetails.name }), _jsx("div", { className: "tooltip-type-badge", "data-type": hoveredDetails.type, children: NODE_COLORS[hoveredDetails.type]?.label || hoveredDetails.type })] }), hoveredDetails.codeSnippet && (_jsx("div", { className: "tooltip-code", children: _jsx("pre", { children: hoveredDetails.codeSnippet }) })), hoveredDetails.location && (_jsxs("div", { className: "tooltip-location", children: ["Lines ", hoveredDetails.location.start.line + 1, "-", hoveredDetails.location.end.line + 1] }))] })), visualizationData && (_jsxs("div", { className: "view-mode-toggle", children: [_jsx("button", { className: `view-btn ${viewMode === 'structure' ? 'active' : ''}`, onClick: () => setViewMode('structure'), title: "Hierarchical structure view", children: "Structure" }), _jsx("button", { className: `view-btn ${viewMode === 'flow' ? 'active' : ''}`, onClick: () => setViewMode('flow'), title: "Graph flow view", children: "Flow" })] })), visualizationData && showLegend && (_jsxs("div", { className: "diagram-legend-enhanced", children: [_jsxs("div", { className: "legend-header", children: [_jsx("span", { className: "legend-title", children: "Legend" }), _jsx("button", { className: "legend-close", onClick: () => setShowLegend(false), title: "Hide legend", children: "Close" })] }), _jsxs("div", { className: "legend-content", children: [_jsxs("div", { className: "legend-section", children: [_jsx("div", { className: "legend-section-title", children: "Code Structures" }), Object.entries(NODE_COLORS).map(([type, config]) => (_jsxs("div", { className: "legend-item", children: [_jsx("div", { className: "legend-swatch", style: {
                                                    backgroundColor: `#${config.main.toString(16).padStart(6, '0')}`,
                                                    boxShadow: `0 0 8px #${config.glow.toString(16).padStart(6, '0')}`
                                                } }), _jsx("span", { className: "legend-label", children: config.label })] }, type)))] }), _jsxs("div", { className: "legend-section", children: [_jsx("div", { className: "legend-section-title", children: "Connections" }), _jsxs("div", { className: "legend-item", children: [_jsx("div", { className: "legend-line legend-line--call" }), _jsx("span", { className: "legend-label", children: "Call" })] }), _jsxs("div", { className: "legend-item", children: [_jsx("div", { className: "legend-line legend-line--data" }), _jsx("span", { className: "legend-label", children: "Data" })] }), _jsxs("div", { className: "legend-item", children: [_jsx("div", { className: "legend-line legend-line--control" }), _jsx("span", { className: "legend-label", children: "Control" })] })] })] })] })), visualizationData && !showLegend && (_jsx("button", { className: "show-legend-btn", onClick: () => setShowLegend(true), title: "Show legend", children: "Legend" })), visualizationData && (_jsxs("div", { className: "controls-info", children: [_jsx("div", { className: "controls-title", children: "Controls" }), _jsx("div", { className: "controls-item", children: "Drag: Rotate" }), _jsx("div", { className: "controls-item", children: "Scroll: Zoom" }), _jsx("div", { className: "controls-item", children: "Click: Select" }), _jsx("div", { className: "controls-item", children: "Hover: Details" })] }))] }));
};
export default Diagram;
//# sourceMappingURL=Diagram.js.map