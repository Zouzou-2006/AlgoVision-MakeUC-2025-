import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import type { VisualizationData } from '../core/ir';
import './Diagram.css';

type DiagramProps = {
  visualizationData: VisualizationData | null;
  isVisualizing: boolean;
};

// Color scheme for different node types
const NODE_COLORS: Record<string, number> = {
  module: 0x00ffff,      // Cyan
  function: 0x00ff00,    // Green
  class: 0xff6600,       // Orange
  variable: 0xffff00,    // Yellow
  loop: 0xff00ff,        // Magenta
  conditional: 0xff0000, // Red
  namespace: 0x0099ff,   // Blue
  interface: 0x9900ff,   // Purple
  struct: 0xff9900,      // Dark Orange
  property: 0x00ff99,    // Turquoise
  import: 0x999999,      // Gray
};

// Shape sizes for different node types
const NODE_SIZES: Record<string, number> = {
  module: 2.0,
  class: 1.5,
  function: 1.0,
  variable: 0.6,
  loop: 0.8,
  conditional: 0.8,
  namespace: 1.3,
  interface: 1.2,
  struct: 1.4,
  property: 0.7,
  import: 0.5,
};

// Helper function to create 3D shape based on node type
function createNodeGeometry(type: string, size: number): THREE.BufferGeometry {
  switch (type) {
    case 'class':
      return new THREE.BoxGeometry(size, size, size);
    case 'function':
      return new THREE.CylinderGeometry(size * 0.7, size * 0.7, size * 1.2, 8);
    case 'variable':
      return new THREE.SphereGeometry(size, 8, 8);
    case 'loop':
      return new THREE.TorusGeometry(size * 0.7, size * 0.3, 8, 16);
    case 'conditional':
      return new THREE.ConeGeometry(size * 0.8, size * 1.2, 6);
    case 'module':
      return new THREE.OctahedronGeometry(size);
    default:
      return new THREE.SphereGeometry(size, 8, 8);
  }
}

const Diagram: React.FC<DiagramProps> = ({ visualizationData, isVisualizing }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const lineRefs = useRef<Map<string, THREE.Line>>(new Map());
  const isDraggingRef = useRef<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const hoveredDetails = useMemo(() => {
    if (!hoveredNode || !visualizationData) return null;
    return visualizationData.nodes.find((n) => n.id === hoveredNode) ?? null;
  }, [hoveredNode, visualizationData]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 5, 15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00ffff, 0.5, 100);
    pointLight.position.set(-10, 10, -10);
    scene.add(pointLight);

    // Simple orbit controls (manual implementation for compatibility)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraAngleX = 0;
    let cameraAngleY = 0;
    let cameraDistance = 15;

    const onMouseDown = (e: MouseEvent) => {
      // Only start dragging on left mouse button
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
      cameraDistance += e.deltaY * 0.01;
      cameraDistance = Math.max(5, Math.min(30, cameraDistance));
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMoveDrag);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp); // Stop dragging when mouse leaves
    container.addEventListener('wheel', onWheel);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Update camera position based on controls
      if (cameraRef.current) {
        const x = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        const y = Math.sin(cameraAngleX) * cameraDistance;
        const z = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        cameraRef.current.position.set(x, y, z);
        cameraRef.current.lookAt(0, 0, 0);
      }

      // Rotate nodes slightly for visual appeal
      meshRefs.current.forEach((mesh) => {
        mesh.rotation.y += 0.005;
      });

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
      
      // Clean up meshes and lines
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

      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Update visualization when data changes
  useEffect(() => {
    if (!visualizationData || !sceneRef.current) return;

    const scene = sceneRef.current;

    // Clear existing meshes and lines
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

    // Calculate hierarchical layout based on node types
    const nodeCount = visualizationData.nodes.length;
    const radius = Math.max(6, Math.min(12, nodeCount * 0.6));
    const nodePositions = new Map<string, THREE.Vector3>();

    // Group nodes by type for better organization
    const nodesByType = new Map<string, typeof visualizationData.nodes>();
    visualizationData.nodes.forEach(node => {
      if (!nodesByType.has(node.type)) {
        nodesByType.set(node.type, []);
      }
      nodesByType.get(node.type)!.push(node);
    });

    // Position nodes in layers by type
    const typeLayers: Record<string, number> = {
      module: 3,
      namespace: 2.5,
      class: 2,
      interface: 1.8,
      function: 1,
      variable: 0.5,
      loop: 0.3,
      conditional: 0.3,
    };

    visualizationData.nodes.forEach((node) => {
      const layerY = typeLayers[node.type] || 0;
      const nodesInLayer = nodesByType.get(node.type) || [];
      const indexInLayer = nodesInLayer.indexOf(node);
      const nodesInLayerCount = nodesInLayer.length;
      
      // Arrange in a circle within the layer
      const angle = nodesInLayerCount > 1 
        ? (indexInLayer / nodesInLayerCount) * Math.PI * 2 
        : 0;
      
      // Vary radius slightly based on layer
      const layerRadius = radius * (1 - layerY * 0.15);
      const x = Math.cos(angle) * layerRadius;
      const z = Math.sin(angle) * layerRadius;
      const y = layerY;
      
      const position = new THREE.Vector3(x, y, z);
      nodePositions.set(node.id, position);

      // Create geometry and material
      const size = NODE_SIZES[node.type] || 1.0;
      const geometry = createNodeGeometry(node.type, size);
      const color = NODE_COLORS[node.type] || 0xffffff;
      const material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.2,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { nodeId: node.id, nodeName: node.name, nodeType: node.type };

      // Add wireframe for better visibility
      const wireframe = new THREE.WireframeGeometry(geometry);
      const line = new THREE.LineSegments(
        wireframe,
        new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true })
      );
      mesh.add(line);

      scene.add(mesh);
      meshRefs.current.set(node.id, mesh);

      // Add label (simple sprite approach)
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = 256;
        canvas.height = 64;
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff';
        context.font = '20px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(node.name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(0, size + 1, 0);
        sprite.scale.set(2, 0.5, 1);
        mesh.add(sprite);
      }
    });

    // Create edges
    visualizationData.edges.forEach((edge) => {
      const fromPos = nodePositions.get(edge.from);
      const toPos = nodePositions.get(edge.to);

      if (!fromPos || !toPos) return;

      const points = [fromPos, toPos];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      const edgeColor = edge.type === 'call' ? 0x00ff00 : 
                       edge.type === 'data' ? 0xffff00 : 
                       0xff00ff;
      
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        opacity: 0.5,
        transparent: true,
        linewidth: 2,
      });

      const line = new THREE.Line(geometry, material);
      scene.add(line);
      lineRefs.current.set(edge.id, line);
    });

    // Add subtle grid helper for depth perception
    const gridHelper = new THREE.GridHelper(radius * 2.5, 10, 0x333333, 0x1a1a1a);
    scene.add(gridHelper);

  }, [visualizationData]);

  // Handle node hover (separate from drag controls)
  useEffect(() => {
    if (!containerRef.current || !sceneRef.current || !cameraRef.current || !visualizationData) return;

    const container = containerRef.current;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMoveHover = (e: MouseEvent) => {
      // Don't update hover while dragging
      if (isDraggingRef.current) return;

      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current!);
      const intersects = raycaster.intersectObjects(Array.from(meshRefs.current.values()));

      if (intersects.length > 0) {
        const [firstIntersection] = intersects;
        if (!firstIntersection) {
          return;
        }
        const mesh = firstIntersection.object as THREE.Mesh;
        const nodeId = mesh.userData.nodeId;
        setHoveredNode(nodeId);
        container.style.cursor = 'pointer';
        
        // Highlight hovered node
        meshRefs.current.forEach((m, id) => {
          if (id === nodeId) {
            (m.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.6;
            m.scale.set(1.15, 1.15, 1.15);
          } else {
            (m.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.2;
            m.scale.set(1, 1, 1);
          }
        });
      } else {
        setHoveredNode(null);
        container.style.cursor = 'default';
        meshRefs.current.forEach((m) => {
          (m.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.2;
          m.scale.set(1, 1, 1);
        });
      }
    };

    container.addEventListener('mousemove', onMouseMoveHover, { passive: true });
    
    return () => {
      container.removeEventListener('mousemove', onMouseMoveHover);
    };
  }, [visualizationData]);

  return (
    <div className="diagram-container" ref={containerRef}>
      {isVisualizing && (
        <div className="visualization-loading">
          <div className="loader">Rendering 3D visualization...</div>
        </div>
      )}
      {!visualizationData && !isVisualizing && (
        <div className="canvas-placeholder">
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>🎨</div>
          <div>Enter code and click "Run Visualization" to see your code in 3D</div>
        </div>
      )}
      {hoveredDetails && (
        <div className="node-tooltip">
          <div className="tooltip-name">{hoveredDetails.name}</div>
          <div className="tooltip-type">Type: {hoveredDetails.type}</div>
        </div>
      )}
      {visualizationData ? (
        <div className="controls-info">
          <div className="controls-title">Controls</div>
          <div className="controls-item">🖱️ Drag: Rotate view</div>
          <div className="controls-item">🔍 Scroll: Zoom in/out</div>
          <div className="controls-item">👆 Hover: See details</div>
        </div>
      ) : null}
    </div>
  );
};

export default Diagram;
