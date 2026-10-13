import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface MarketNodeData {
  id: string;
  name: string;
  region: string;
  authority: string;
  opportunitiesCount: number;
  marketValueUSD: string;
  coordinates: [number, number, number];
}

const STRATEGIC_MARKETS: MarketNodeData[] = [
  { id: 'US', name: 'United States', region: 'North America', authority: 'US FDA', opportunitiesCount: 14, marketValueUSD: '$4.2B', coordinates: [-3.2, 2.5, 4.8] },
  { id: 'EU', name: 'European Union', region: 'Europe', authority: 'EMA / National', opportunitiesCount: 18, marketValueUSD: '$3.1B', coordinates: [0.8, 3.2, 5.0] },
  { id: 'JP', name: 'Japan', region: 'Asia-Pacific', authority: 'PMDA', opportunitiesCount: 6, marketValueUSD: '$1.4B', coordinates: [5.2, 2.1, 2.8] },
  { id: 'UK', name: 'United Kingdom', region: 'Europe', authority: 'MHRA', opportunitiesCount: 9, marketValueUSD: '$890M', coordinates: [-0.2, 3.8, 4.6] },
  { id: 'BR', name: 'Brazil', region: 'Latin America', authority: 'ANVISA', opportunitiesCount: 5, marketValueUSD: '$720M', coordinates: [-2.4, -1.8, 5.2] },
  { id: 'APAC', name: 'Singapore & APAC', region: 'Asia-Pacific', authority: 'HSA / Regional', opportunitiesCount: 8, marketValueUSD: '$1.1B', coordinates: [4.5, 0.4, 4.1] },
];

export const IntelligenceNetwork3D: React.FC<{ className?: string }> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketNodeData>(STRATEGIC_MARKETS[0]);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    if (viewMode === '2d') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setHasWebGL(false);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 340;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Globe Base Wireframe (Latitude & Longitude rings)
    const globeRadius = 5.8;
    const globeGeometry = new THREE.SphereGeometry(globeRadius, 28, 28);
    const globeMaterial = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globeMesh);

    // Core glow sphere
    const glowGeometry = new THREE.SphereGeometry(globeRadius * 0.96, 20, 20);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x0369a1,
      transparent: true,
      opacity: 0.08,
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    // Market Hub Nodes Group
    const marketGroup = new THREE.Group();
    const nodeGeometry = new THREE.SphereGeometry(0.28, 16, 16);

    STRATEGIC_MARKETS.forEach((market) => {
      const pos = new THREE.Vector3(...market.coordinates).normalize().multiplyScalar(globeRadius);
      const nodeMaterial = new THREE.MeshBasicMaterial({
        color: market.id === 'US' || market.id === 'EU' ? 0x38bdf8 : 0x34d399,
      });
      const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      nodeMesh.position.copy(pos);
      marketGroup.add(nodeMesh);

      // Orbital pulsing ring for each hub
      const ringGeo = new THREE.RingGeometry(0.38, 0.44, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(0, 0, 0);
      marketGroup.add(ringMesh);
    });
    scene.add(marketGroup);

    // Connection Arcs across Strategic Hubs
    const arcsMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
    });
    const curveLines: THREE.Line[] = [];

    for (let i = 0; i < STRATEGIC_MARKETS.length; i++) {
      for (let j = i + 1; j < STRATEGIC_MARKETS.length; j++) {
        const p1 = new THREE.Vector3(...STRATEGIC_MARKETS[i].coordinates).normalize().multiplyScalar(globeRadius);
        const p2 = new THREE.Vector3(...STRATEGIC_MARKETS[j].coordinates).normalize().multiplyScalar(globeRadius);
        
        // Quadratic bezier arc lifting above sphere surface
        const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const distance = p1.distanceTo(p2);
        midPoint.normalize().multiplyScalar(globeRadius + distance * 0.25);

        const curve = new THREE.QuadraticBezierCurve3(p1, midPoint, p2);
        const points = curve.getPoints(24);
        const curveGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(curveGeometry, arcsMaterial);
        scene.add(line);
        curveLines.push(line);
      }
    }

    // Interactive Drag to Rotate
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      globeMesh.rotation.y += deltaX * 0.006;
      globeMesh.rotation.x += deltaY * 0.006;
      marketGroup.rotation.y += deltaX * 0.006;
      marketGroup.rotation.x += deltaY * 0.006;
      curveLines.forEach(line => {
        line.rotation.y += deltaX * 0.006;
        line.rotation.x += deltaY * 0.006;
      });

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const containerEl = renderer.domElement;
    containerEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    let animId: number;
    let isVisible = true;

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      if (!isDragging) {
        globeMesh.rotation.y += 0.0025;
        marketGroup.rotation.y += 0.0025;
        curveLines.forEach(line => {
          line.rotation.y += 0.0025;
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      containerEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();

      // Dispose
      globeGeometry.dispose();
      globeMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      nodeGeometry.dispose();
      arcsMaterial.dispose();
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [viewMode]);

  return (
    <div className={`relative rounded-xl border border-slate-800 bg-slate-950/70 backdrop-blur-xl overflow-hidden shadow-2xl ${className}`}>
      {/* Top Header / Mode Switcher */}
      <div className="absolute top-4 left-5 right-5 z-20 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-medium tracking-wider text-slate-300 uppercase">
            Global Market Intelligence Mesh
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
            className="px-2.5 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white hover:border-slate-600 transition"
          >
            {viewMode === '3d' ? 'Switch to 2D Map' : 'Switch to 3D Globe'}
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      {viewMode === '3d' && hasWebGL ? (
        <div ref={containerRef} className="w-full h-80 cursor-grab active:cursor-grabbing" />
      ) : (
        /* Accessible 2D Fallback Map */
        <div className="w-full h-80 flex flex-col justify-center p-6 bg-slate-950/90">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {STRATEGIC_MARKETS.map(market => (
              <button
                key={market.id}
                onClick={() => setSelectedMarket(market)}
                className={`p-3 rounded-lg border text-left transition ${
                  selectedMarket.id === market.id
                    ? 'border-cyan-500 bg-cyan-950/30 text-white'
                    : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-mono text-cyan-400">{market.authority}</div>
                <div className="text-sm font-semibold">{market.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {market.opportunitiesCount} Opportunities · {market.marketValueUSD}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Region Telemetry Inspector Bar */}
      <div className="border-t border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">Select Region:</span>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGIC_MARKETS.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMarket(m)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                  selectedMarket.id === m.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {m.id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400 mr-1.5">Jurisdiction:</span>
            <span className="font-semibold text-slate-200">{selectedMarket.name} ({selectedMarket.authority})</span>
          </div>
          <div>
            <span className="text-slate-400 mr-1.5">Active BD Opportunities:</span>
            <span className="font-mono font-semibold text-cyan-400">{selectedMarket.opportunitiesCount}</span>
          </div>
          <div>
            <span className="text-slate-400 mr-1.5">Target Addressable Value:</span>
            <span className="font-mono font-semibold text-emerald-400">{selectedMarket.marketValueUSD}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
