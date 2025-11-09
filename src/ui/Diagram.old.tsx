import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import type { VisualizationData, OutlineNode } from '../core/ir';
import './Diagram.css';

type DiagramProps = {
  visualizationData: VisualizationData | null;
  isVisualizing: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
  code?: string;
};

type ViewMode = 'structure' | 'flow';

/**
 * Improved color scheme with better visual hierarchy and readability
 * Colors are chosen to be intuitive and provide clear distinction
 */
const NODE_COLORS: Record<string, { main: number; glow: number; label: string }> = {
  module: { main: 0x4a9eff, glow: 0x6bb5ff, label: 'Module' },        // Blue - Container
  function: { main: 0x4ade80, glow: 0x6ee7b7, label: 'Function' },     // Green - Action
  class: { main: 0xf59e0b, glow: 0xfbbf24, label: 'Class' },           // Amber - Structure
  variable: { main: 0x8b5cf6, glow: 0xa78bfa, label: 'Variable' },     // Purple - Data
  loop: { main: 0xec4899, glow: 0xf472b6, label: 'Loop' },             // Pink - Iteration
  conditional: { main: 0xef4444, glow: 0xf87171, label: 'Conditional' }, // Red - Decision
  namespace: { main: 0x06b6d4, glow: 0x22d3ee, label: 'Namespace' },   // Cyan - Scope
  interface: { main: 0x14b8a6, glow: 0x2dd4bf, label: 'Interface' },   // Teal - Contract
  struct: { main: 0xf97316, glow: 0xfb923c, label: 'Struct' },         // Orange - Structure
  property: { main: 0x10b981, glow: 0x34d399, label: 'Property' },     // Emerald - Attribute
  import: { main: 0x6b7280, glow: 0x9ca3af, label: 'Import' },         // Gray - External
};

/**
 * Size hierarchy - larger nodes represent more important/complex entities
 */
const NODE_SIZES: Record<string, number> = {
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
 * Creates intuitive 3D geometries based on node type
 * - Classes: Boxes (solid structures)
 * - Functions: Cylinders (processes/actions)
 * - Variables: Spheres (data points)
 * - Loops: Torus (cyclic processes)
 * - Conditionals: Cone (decision points)
 * - Modules: Octahedron (containers)
 */
function createNodeGeometry(type: string, size: number): THREE.BufferGeometry {
  switch (type) {
    case 'class':
    case 'struct':
      return new THREE.BoxGeometry(size, size * 1.2, size, 2, 2, 2);
    case 'function':
      return new THREE.CylinderGeometry(size * 0.6, size * 0.6, size * 1.4, 16);
    case 'variable':
    case 'property':
      return new THREE.SphereGeometry(size, 16, 16);
    case 'loop':
      return new THREE.TorusGeometry(size * 0.6, size * 0.25, 16, 32);
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
      return new THREE.SphereGeometry(size, 16, 16);
  }
}

/**
 * Creates a glowing effect around nodes using emissive materials and additional lights
 */
function createGlowMaterial(color: number, glowColor: number, intensity: number = 0.3): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color: color,
    emissive: glowColor,
    emissiveIntensity: intensity,
    shininess: 100,
    transparent: true,
    opacity: 0.95,
    specular: new THREE.Color(glowColor),
  });
}

/**
 * Creates smooth curved edges between nodes for better visual flow
 */
function createCurvedEdge(
  from: THREE.Vector3,
  to: THREE.Vector3,
  type: 'data' | 'control' | 'call',
  color: number
): THREE.Curve<THREE.Vector3> {
  const midPoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const distance = from.distanceTo(to);
  const controlOffset = distance * 0.3;
  
  // Add vertical offset for better visibility
  midPoint.y += controlOffset;
  
  return new THREE.QuadraticBezierCurve3(from, midPoint, to);
}

const Diagram: React.FC<DiagramProps> = ({ 
  visualizationData, 
  isVisualizing, 
  onSelectNode, 
  selectedNodeId,
  code = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const lineRefs = useRef<Map<string, THREE.Line>>(new Map());
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const glowLightRefs = useRef<Map<string, THREE.PointLight>>(new Map());
  const isDraggingRef = useRef<boolean>(false);
  const focusPointRef = useRef(new THREE.Vector3(0, 0, 0));
  const cameraTargetRef = useRef(new THREE.Vector3(0, 5, 15));
  const cameraLerpSpeed = 0.05;
  
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('structure');
  const [showLegend, setShowLegend] = useState(true);
  
  const effectiveSelectedNode = selectedNodeId ?? selectedNode;
  
  useEffect(() => {
    if (selectedNodeId !== undefined) {
      setSelectedNode(selectedNodeId);
    }
  }, [selectedNodeId]);

  const hoveredDetails = useMemo(() => {
    if (!hoveredNode || !visualizationData) return null;
    const node = visualizationData.nodes.find((n) => n.id === hoveredNode);
    if (!node) return null;
    
    // Extract code snippet for tooltip
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

  // Initialize Three.js scene with enhanced lighting and effects
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;

    // Create scene with gradient background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1a);
    scene.fog = new THREE.FogExp2(0x0f0f1a, 0.08);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 8, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer with better quality settings
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Enhanced lighting setup
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Main directional light with shadows
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(15, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x4a9eff, 0.3);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    // Rim light for depth
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, -10, -15);
    scene.add(rimLight);

    // Camera controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraAngleX = 0.3;
    let cameraAngleY = 0;
    let cameraDistance = 20;
    const minDistance = 5;
    const maxDistance = 50;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging = true;
        isDraggingRef.current = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      }
    };

    const onMouseMoveDrag = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      cameraAngleY += deltaX * 0.01;
      cameraAngleX += deltaY * 0.01;
      cameraAngleX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraAngleX));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
      isDraggingRef.current = false;
      container.style.cursor = 'default';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance += e.deltaY * 0.02;
      cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance));
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMoveDrag);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Update label positions based on camera
    const updateLabelPositions = () => {
      if (!cameraRef.current || !containerRef.current) return;
      labelRefs.current.forEach((label, nodeId) => {
        const mesh = meshRefs.current.get(nodeId);
        if (!mesh) return;

        const vector = mesh.position.clone();
        vector.project(cameraRef.current!);

        const x = (vector.x * 0.5 + 0.5) * container.clientWidth;
        const y = (vector.y * -0.5 + 0.5) * container.clientHeight;

        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.style.display = vector.z < 1 ? 'block' : 'none';
      });
    };

    // Smooth camera animation loop with performance optimizations
    let lastLabelUpdate = 0;
    const LABEL_UPDATE_INTERVAL = 100; // Update labels every 100ms for performance
    
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();

      // Smooth camera movement
      if (cameraRef.current) {
        const focus = focusPointRef.current;
        const targetX = focus.x + Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        const targetY = focus.y + Math.sin(cameraAngleX) * cameraDistance + 5;
        const targetZ = focus.z + Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;

        cameraRef.current.position.lerp(
          new THREE.Vector3(targetX, targetY, targetZ),
          cameraLerpSpeed
        );
        cameraRef.current.lookAt(focus);
      }

      // Subtle rotation for visual appeal (slower than before)
      // Only rotate if not dragging for better performance
      if (!isDraggingRef.current && meshRefs.current.size > 0) {
        meshRefs.current.forEach((mesh) => {
          mesh.rotation.y += 0.002;
        });
      }

      // Update label positions (throttled for performance)
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
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight || 600;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMoveDrag);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Clean up meshes
      meshRefs.current.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
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
        } else {
          line.material.dispose();
        }
      });
      lineRefs.current.clear();

      // Clean up lights
      glowLightRefs.current.forEach((light) => {
        scene.remove(light);
      });
      glowLightRefs.current.clear();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update visualization when data or view mode changes
  useEffect(() => {
    if (!visualizationData || !sceneRef.current) return;

    const scene = sceneRef.current;

    // Clear existing meshes, lines, and labels
    meshRefs.current.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    meshRefs.current.clear();

    lineRefs.current.forEach((line) => {
      scene.remove(line);
      line.geometry.dispose();
      if (Array.isArray(line.material)) {
        line.material.forEach(m => m.dispose());
      } else {
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
    const nodePositions = new Map<string, THREE.Vector3>();
    const depthMap = new Map<string, number>();
    const childrenMap = new Map<string, OutlineNode[]>();
    const roots: OutlineNode[] = [];

    visualizationData.nodes.forEach((node) => {
      if (node.parentId) {
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, []);
        }
        childrenMap.get(node.parentId)!.push(node);
      } else {
        roots.push(node);
      }
    });

    if (!roots.length && visualizationData.nodes.length) {
      roots.push(visualizationData.nodes[0]!);
    }

    // Layout algorithm - different for structure vs flow view
    if (viewMode === 'structure') {
      // Hierarchical tree layout
      const baseOrbit = 4.0;
      const verticalSpacing = 2.0;

      const placeNode = (node: OutlineNode, position: THREE.Vector3, depth: number) => {
        nodePositions.set(node.id, position);
        depthMap.set(node.id, depth);
        const children = childrenMap.get(node.id);
        if (!children || children.length === 0) return;
        
        const orbit = baseOrbit * Math.max(0.5, Math.pow(0.7, depth)) + children.length * 0.3;
        children.forEach((child, index) => {
          const angle = (index / children.length) * Math.PI * 2;
          const childPos = new THREE.Vector3(
            position.x + Math.cos(angle) * orbit,
            position.y - verticalSpacing,
            position.z + Math.sin(angle) * orbit
          );
          placeNode(child, childPos, depth + 1);
        });
      };

      roots.forEach((root, index) => {
        const angle = roots.length > 1 ? (index / roots.length) * Math.PI * 2 : 0;
        const radius = 8;
        const position = new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        placeNode(root, position, 0);
      });
    } else {
      // Flow view - graph layout with force-directed positioning
      const nodeMap = new Map(visualizationData.nodes.map(n => [n.id, n]));
      const positions = new Map<string, THREE.Vector3>();
      
      // Initialize positions
      visualizationData.nodes.forEach((node, index) => {
        const angle = (index / visualizationData.nodes.length) * Math.PI * 2;
        const radius = 5 + Math.random() * 3;
        positions.set(node.id, new THREE.Vector3(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 4,
          Math.sin(angle) * radius
        ));
      });

      // Simple force-directed layout
      for (let iter = 0; iter < 20; iter++) {
        const forces = new Map<string, THREE.Vector3>();
        visualizationData.nodes.forEach(node => {
          forces.set(node.id, new THREE.Vector3(0, 0, 0));
        });

        // Repulsion between all nodes
        visualizationData.nodes.forEach((node1, i) => {
          visualizationData.nodes.slice(i + 1).forEach(node2 => {
            const pos1 = positions.get(node1.id)!;
            const pos2 = positions.get(node2.id)!;
            const diff = new THREE.Vector3().subVectors(pos1, pos2);
            const distance = Math.max(diff.length(), 0.1);
            const force = 0.1 / (distance * distance);
            diff.normalize().multiplyScalar(force);
            
            forces.get(node1.id)!.add(diff);
            forces.get(node2.id)!.sub(diff);
          });
        });

        // Attraction along edges
        visualizationData.edges.forEach(edge => {
          const pos1 = positions.get(edge.from);
          const pos2 = positions.get(edge.to);
          if (pos1 && pos2) {
            const diff = new THREE.Vector3().subVectors(pos2, pos1);
            const distance = diff.length();
            const force = distance * 0.02;
            diff.normalize().multiplyScalar(force);
            
            forces.get(edge.from)!.add(diff);
            forces.get(edge.to)!.sub(diff.multiplyScalar(-1));
          }
        });

        // Update positions
        forces.forEach((force, nodeId) => {
          const pos = positions.get(nodeId)!;
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
        nodePositions.set(node.id, new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ));
      }
    });

    // Create node meshes with enhanced visuals
    visualizationData.nodes.forEach((node) => {
      const position = nodePositions.get(node.id)!;
      const depth = depthMap.get(node.id) ?? 0;

      const nodeType = node.type;
      const baseSize = NODE_SIZES[nodeType] || 1.0;
      const depthScale = Math.max(0.4, Math.pow(0.75, depth));
      const size = baseSize * depthScale;
      const geometry = createNodeGeometry(nodeType, size);
      const colorConfig = NODE_COLORS[nodeType] || NODE_COLORS.function || { main: 0x4ade80, glow: 0x6ee7b7, label: 'Function' };
      
      const material = createGlowMaterial(colorConfig.main, colorConfig.glow, 0.25);
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
        const glowLight = new THREE.PointLight(colorConfig.glow, 0.5, 5);
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

    // Create edges with different styles based on type
    visualizationData.edges.forEach((edge) => {
      const fromPos = nodePositions.get(edge.from);
      const toPos = nodePositions.get(edge.to);

      if (!fromPos || !toPos) return;

      let edgeColor = 0x666666;
      let edgeWidth = 1;
      
      switch (edge.type) {
        case 'call':
          edgeColor = 0x4ade80; // Green
          edgeWidth = 2;
          break;
        case 'data':
          edgeColor = 0x8b5cf6; // Purple
          edgeWidth = 1.5;
          break;
        case 'control':
          edgeColor = 0xf59e0b; // Amber
          edgeWidth = 1.5;
          break;
      }

      // Create curved edge for flow view, straight for structure
      let curve: THREE.Curve<THREE.Vector3>;
      if (viewMode === 'flow') {
        curve = createCurvedEdge(fromPos, toPos, edge.type, edgeColor);
      } else {
        curve = new THREE.LineCurve3(fromPos, toPos);
      }

      const points = curve.getPoints(50);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        opacity: 0.4,
        transparent: true,
        linewidth: edgeWidth,
      });

      const line = new THREE.Line(geometry, material);
      scene.add(line);
      lineRefs.current.set(edge.id, line);
    });

    // Add subtle grid for depth reference
    const gridHelper = new THREE.GridHelper(30, 30, 0x2a2a3a, 0x1a1a2a);
    gridHelper.position.y = -5;
    scene.add(gridHelper);

  }, [visualizationData, viewMode]);

  // Handle node hover with raycasting
  useEffect(() => {
    if (!containerRef.current || !sceneRef.current || !cameraRef.current || !visualizationData) return;

    const container = containerRef.current;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMoveHover = (e: MouseEvent) => {
      if (isDraggingRef.current) return;

      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current!);
      const intersects = raycaster.intersectObjects(Array.from(meshRefs.current.values()), true);

      if (intersects.length > 0) {
        const [firstIntersection] = intersects;
        if (firstIntersection) {
          const mesh = firstIntersection.object as THREE.Mesh;
          const nodeId = mesh.userData.nodeId;
          setHoveredNode(nodeId);
          container.style.cursor = 'pointer';
        }
      } else {
        setHoveredNode(null);
        container.style.cursor = 'default';
      }
    };

    container.addEventListener('mousemove', onMouseMoveHover, { passive: true });
    
    return () => {
      container.removeEventListener('mousemove', onMouseMoveHover);
    };
  }, [visualizationData]);

  // Update node appearance based on selection and hover
  useEffect(() => {
    meshRefs.current.forEach((mesh, id) => {
      const material = mesh.material as THREE.MeshPhongMaterial;
      const nodeType = mesh.userData.nodeType as string;
      const colorConfig = NODE_COLORS[nodeType] || NODE_COLORS.function || { main: 0x4ade80, glow: 0x6ee7b7, label: 'Function' };
      const isSelected = effectiveSelectedNode === id;
      const isHovered = hoveredNode === id;

      if (isSelected) {
        material.color.setHex(0xffff00);
        material.emissive.setHex(0xffff00);
        material.emissiveIntensity = 1.0;
        mesh.scale.set(1.4, 1.4, 1.4);
      } else if (isHovered) {
        material.color.setHex(colorConfig.glow);
        material.emissive.setHex(colorConfig.glow);
        material.emissiveIntensity = 0.6;
        mesh.scale.set(1.15, 1.15, 1.15);
      } else {
        material.color.setHex(colorConfig.main);
        material.emissive.setHex(colorConfig.glow);
        material.emissiveIntensity = 0.25;
        mesh.scale.set(1.0, 1.0, 1.0);
      }
    });
  }, [effectiveSelectedNode, hoveredNode]);

  // Update focus point when node is selected
  useEffect(() => {
    if (!effectiveSelectedNode) {
      focusPointRef.current.set(0, 0, 0);
      return;
    }
    const mesh = meshRefs.current.get(effectiveSelectedNode);
    if (mesh) {
      focusPointRef.current.copy(mesh.position);
    }
  }, [effectiveSelectedNode]);

  // Handle node clicks
  useEffect(() => {
    if (!containerRef.current || !cameraRef.current) return;
    const container = containerRef.current;
    const camera = cameraRef.current;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      if (!visualizationData || !camera) return;
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        return;
      }
      
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(meshRefs.current.values()), true);
      
      if (intersects.length > 0) {
        const [firstHit] = intersects;
        if (firstHit) {
          let target: THREE.Object3D | null = firstHit.object;
          while (target && !(target as THREE.Mesh).userData?.nodeId) {
            target = target.parent;
          }
          const nodeId = (target as THREE.Mesh | null)?.userData?.nodeId as string | undefined;
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

  return (
    <div className="diagram-container" ref={containerRef}>
      {isVisualizing && (
        <div className="visualization-loading">
          <div className="loader">Rendering 3D visualization...</div>
        </div>
      )}
      {!visualizationData && !isVisualizing && (
        <div className="canvas-placeholder">
          <div style={{ fontSize: '48px', marginBottom: '15px' }} />
          <div>Enter code and click "Run Visualization" to see your code in 3D</div>
        </div>
      )}
      
      {/* Enhanced tooltip with code snippet */}
      {hoveredDetails && (
        <div className="node-tooltip-enhanced">
          <div className="tooltip-header">
            <div className="tooltip-name">{hoveredDetails.name}</div>
            <div className="tooltip-type-badge" data-type={hoveredDetails.type}>
              {NODE_COLORS[hoveredDetails.type]?.label || hoveredDetails.type}
            </div>
          </div>
          {hoveredDetails.codeSnippet && (
            <div className="tooltip-code">
              <pre>{hoveredDetails.codeSnippet}</pre>
            </div>
          )}
          {hoveredDetails.location && (
            <div className="tooltip-location">
              Lines {hoveredDetails.location.start.line + 1}-{hoveredDetails.location.end.line + 1}
            </div>
          )}
        </div>
      )}

      {/* View mode toggle */}
      {visualizationData && (
        <div className="view-mode-toggle">
          <button 
            className={`view-btn ${viewMode === 'structure' ? 'active' : ''}`}
            onClick={() => setViewMode('structure')}
            title="Hierarchical structure view"
          >
            Structure
          </button>
          <button 
            className={`view-btn ${viewMode === 'flow' ? 'active' : ''}`}
            onClick={() => setViewMode('flow')}
            title="Graph flow view"
          >
            Flow
          </button>
        </div>
      )}

      {/* Legend */}
      {visualizationData && showLegend && (
        <div className="diagram-legend-enhanced">
          <div className="legend-header">
            <span className="legend-title">Legend</span>
            <button 
              className="legend-close"
              onClick={() => setShowLegend(false)}
              title="Hide legend"
            >
              Close
            </button>
          </div>
          <div className="legend-content">
            <div className="legend-section">
              <div className="legend-section-title">Node Types</div>
              {Object.entries(NODE_COLORS).map(([type, config]) => (
                <div key={type} className="legend-item">
                  <div 
                    className="legend-swatch" 
                    style={{ 
                      backgroundColor: `#${config.main.toString(16).padStart(6, '0')}`,
                      boxShadow: `0 0 8px #${config.glow.toString(16).padStart(6, '0')}`
                    }}
                  />
                  <span className="legend-label">{config.label}</span>
                </div>
              ))}
            </div>
            <div className="legend-section">
              <div className="legend-section-title">Connections</div>
              <div className="legend-item">
                <div className="legend-line legend-line--call" />
                <span className="legend-label">Call</span>
              </div>
              <div className="legend-item">
                <div className="legend-line legend-line--data" />
                <span className="legend-label">Data</span>
              </div>
              <div className="legend-item">
                <div className="legend-line legend-line--control" />
                <span className="legend-label">Control</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show legend button when hidden */}
      {visualizationData && !showLegend && (
        <button 
          className="show-legend-btn"
          onClick={() => setShowLegend(true)}
          title="Show legend"
        >
          Legend
        </button>
      )}

      {/* Controls info */}
      {visualizationData && (
        <div className="controls-info">
          <div className="controls-title">Controls</div>
          <div className="controls-item">Drag: Rotate</div>
          <div className="controls-item">Scroll: Zoom</div>
          <div className="controls-item">Click: Select</div>
          <div className="controls-item">Hover: Details</div>
        </div>
      )}
    </div>
  );
};

export default Diagram;
