import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
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
 * Neon Circuit color scheme - Futuristic + Glowing
 */
const NODE_COLORS: Record<string, { main: number; glow: number; label: string }> = {
  module: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Module' },           // Primary Accent (Cyan)
  function: { main: 0x845EC2, glow: 0x845EC2, label: 'Function' },       // Tertiary Accent (Purple)
  class: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Class' },             // Primary Accent (Cyan)
  variable: { main: 0xA8B2D1, glow: 0xA8B2D1, label: 'Variable' },       // Text Secondary
  loop: { main: 0xFF9F1C, glow: 0xFF9F1C, label: 'Loop' },               // Control Lines (Orange)
  conditional: { main: 0xFF2E63, glow: 0xFF2E63, label: 'Conditional' }, // Secondary Accent (Magenta)
  namespace: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Namespace' },     // Primary Accent (Cyan)
  interface: { main: 0x845EC2, glow: 0x845EC2, label: 'Interface' },     // Tertiary Accent (Purple)
  struct: { main: 0x00FFF5, glow: 0x00FFF5, label: 'Struct' },           // Primary Accent (Cyan)
  property: { main: 0xA8B2D1, glow: 0xA8B2D1, label: 'Property' },       // Text Secondary
  import: { main: 0x1F2833, glow: 0x1F2833, label: 'Import' },           // Graph Outline
};

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
 * Creates optimized geometries with proper detail levels
 */
function createNodeGeometry(type: string, size: number, detail: number = 16): THREE.BufferGeometry {
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
function createGlowMaterial(color: number, glowColor: number, intensity: number = 0.3): THREE.MeshStandardMaterial {
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
function createCurvedEdge(
  from: THREE.Vector3,
  to: THREE.Vector3,
  type: 'data' | 'control' | 'call',
  color: number
): THREE.Curve<THREE.Vector3> {
  const midPoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const distance = from.distanceTo(to);
  const controlOffset = distance * 0.3;
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
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const lineRefs = useRef<Map<string, THREE.Line>>(new Map());
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const glowLightRefs = useRef<Map<string, THREE.PointLight>>(new Map());
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  
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

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

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

    // Add subtle grid
    if (!gridHelperRef.current) {
      const gridHelper = new THREE.GridHelper(30, 30, 0x00FFF520, 0x00FFF510);
      gridHelper.position.y = -5;
      scene.add(gridHelper);
      gridHelperRef.current = gridHelper;
    }

    // Enhanced lighting with futuristic colors
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Main directional light with neon blue tint
    const mainLight = new THREE.DirectionalLight(0x00d9ff, 1.2);
    mainLight.position.set(15, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
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

    // OrbitControls with damping
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
    controls.maxPolarAngle = Math.PI / 1.8;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
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
    
    // Initial resize to ensure proper sizing
    handleResize();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (gridHelperRef.current) {
        scene.remove(gridHelperRef.current);
        gridHelperRef.current.dispose();
        gridHelperRef.current = null;
      }
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update visualization when data changes
  useEffect(() => {
    if (!visualizationData || !sceneRef.current) return;

    const scene = sceneRef.current;

    // Clear existing objects
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

    // Add nodes
    visualizationData.nodes.forEach((node) => {
      const nodeType = node.type;
      const size = NODE_SIZES[nodeType] || 1.0;
      const geometry = createNodeGeometry(nodeType, size);
      const colorConfig = NODE_COLORS[nodeType];
      
      if (colorConfig) {
        const material = createGlowMaterial(colorConfig.main, colorConfig.glow);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        );
        mesh.userData = { nodeId: node.id };
        scene.add(mesh);
        meshRefs.current.set(node.id, mesh);
      }
    });

    // Add edges with different colors based on type
    visualizationData.edges.forEach((edge) => {
      const fromMesh = meshRefs.current.get(edge.from);
      const toMesh = meshRefs.current.get(edge.to);
      if (fromMesh && toMesh) {
        const points = [fromMesh.position, toMesh.position];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Determine color based on edge type
        let edgeColor: number;
        switch (edge.type) {
          case 'call':
            edgeColor = 0x00FFF5; // Cyan for call
            break;
          case 'data':
            edgeColor = 0xFF9F1C; // Orange for data
            break;
          case 'control':
            edgeColor = 0x845EC2; // Purple for control
            break;
          default:
            edgeColor = 0x845EC2; // Default to purple
        }
        
        const material = new THREE.LineBasicMaterial({
          color: edgeColor,
          opacity: 0.6,
          transparent: true,
        });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        lineRefs.current.set(edge.id, line);
      }
    });

  }, [visualizationData]);

  // Handle node selection
  useEffect(() => {
    meshRefs.current.forEach((mesh, id) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = id === effectiveSelectedNode;
      material.emissiveIntensity = isSelected ? 1.0 : 0.3;
      mesh.scale.setScalar(isSelected ? 1.2 : 1.0);
    });
  }, [effectiveSelectedNode]);

  return (
    <div className="diagram-container" ref={containerRef}>
      {isVisualizing && (
        <div className="visualization-loading">
          <div className="loader">Rendering 3D visualization...</div>
        </div>
      )}
      {!visualizationData && !isVisualizing && (
        <div className="canvas-placeholder">
          <div>Enter code and click "Run Visualization" to see your code in 3D</div>
        </div>
      )}
      
      {hoveredDetails && (
        <div className="node-tooltip-enhanced">
          <div className="tooltip-header">
            <div className="tooltip-name">{hoveredDetails.name}</div>
            <div className="tooltip-type-badge">
              {NODE_COLORS[hoveredDetails.type]?.label || hoveredDetails.type}
            </div>
          </div>
          {hoveredDetails.codeSnippet && (
            <div className="tooltip-code">
              <pre>{hoveredDetails.codeSnippet}</pre>
            </div>
          )}
        </div>
      )}

      {visualizationData && showLegend && (
        <div className="diagram-legend-enhanced">
          <div className="legend-header">
            <span className="legend-title">Legend</span>
            <button 
              className="legend-close"
              onClick={() => setShowLegend(false)}
              title="Hide legend"
            >
              ×
            </button>
          </div>
          <div className="legend-content">
            <div className="legend-section">
              <div className="legend-section-title">Code Structures</div>
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

      {visualizationData && !showLegend && (
        <button 
          className="show-legend-btn"
          onClick={() => setShowLegend(true)}
          title="Show legend"
        >
          Legend
        </button>
      )}

      <div className="view-mode-toggle">
        <button 
          className={`view-btn ${viewMode === 'structure' ? 'active' : ''}`}
          onClick={() => setViewMode('structure')}
        >
          Structure
        </button>
        <button 
          className={`view-btn ${viewMode === 'flow' ? 'active' : ''}`}
          onClick={() => setViewMode('flow')}
        >
          Flow
        </button>
      </div>
    </div>
  );
};

export default Diagram;