import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface HeroMolecular3DProps {
  className?: string;
}

export const HeroMolecular3D: React.FC<HeroMolecular3DProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setHasWebGL(false);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Test WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 800;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070b14, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 2. Central Molecular / Global Data Core (Icosahedron Geometry)
    const coreGeometry = new THREE.IcosahedronGeometry(7, 2);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, wireframeMaterial);
    scene.add(coreMesh);

    // 3. Inner Concentric Sphere
    const innerGeometry = new THREE.SphereGeometry(4.5, 24, 24);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    scene.add(innerSphere);

    // 4. Strategic Pharmaceutical Intelligence Nodes (Floating spheres at key vertices)
    const nodeCount = 36;
    const nodeGeometry = new THREE.SphereGeometry(0.22, 12, 12);
    const primaryNodeMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const accentNodeMaterial = new THREE.MeshBasicMaterial({ color: 0x34d399 });

    const nodesGroup = new THREE.Group();
    const nodePositions: THREE.Vector3[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const radius = 6.8 + (Math.random() - 0.5) * 1.4;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const pos = new THREE.Vector3(x, y, z);
      nodePositions.push(pos);

      const mat = i % 3 === 0 ? accentNodeMaterial : primaryNodeMaterial;
      const node = new THREE.Mesh(nodeGeometry, mat);
      node.position.copy(pos);
      nodesGroup.add(node);
    }
    scene.add(nodesGroup);

    // 5. Data Flow Arcs / Connections between nearby nodes
    const linesMaterial = new THREE.LineBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.18,
    });
    const linePositions: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodePositions[i].distanceTo(nodePositions[j]);
        if (dist < 4.2) {
          linePositions.push(nodePositions[i].x, nodePositions[i].y, nodePositions[i].z);
          linePositions.push(nodePositions[j].x, nodePositions[j].y, nodePositions[j].z);
        }
      }
    }
    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
    nodesGroup.add(linesMesh);

    // 6. Scientific Ambient Particle Field (Floating signals)
    const particleCount = 180;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 36;
      particlePositions[i + 1] = (Math.random() - 0.5) * 36;
      particlePositions[i + 2] = (Math.random() - 0.5) * 36;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.12,
      transparent: true,
      opacity: 0.45,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 7. Interactive Parallax Mouse Movement
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseX = (event.clientX - windowHalfX) * 0.0003;
      mouseY = (event.clientY - windowHalfY) * 0.0003;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // 9. Animation Loop with Visibility Optimization
    let animationFrameId: number;
    let isVisible = true;

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;

      const elapsedTime = (performance.now() - startTime) * 0.001;

      // Smooth camera interpolation towards mouse
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      coreMesh.rotation.y = elapsedTime * 0.08 + targetX * 2;
      coreMesh.rotation.x = elapsedTime * 0.05 + targetY * 2;

      innerSphere.rotation.y = -elapsedTime * 0.12;
      innerSphere.rotation.z = elapsedTime * 0.06;

      nodesGroup.rotation.y = elapsedTime * 0.08 + targetX * 2;
      nodesGroup.rotation.x = elapsedTime * 0.05 + targetY * 2;

      particles.rotation.y = elapsedTime * 0.02;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();

      // Clean up GPU resources
      coreGeometry.dispose();
      wireframeMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      nodeGeometry.dispose();
      primaryNodeMaterial.dispose();
      accentNodeMaterial.dispose();
      linesGeometry.dispose();
      linesMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Three.js Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Accessible 2D Fallback / Decorative Canvas when WebGL is unavailable */}
      {!hasWebGL && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/40 p-8">
          <div className="relative w-72 h-72 rounded-full border border-sky-500/20 bg-sky-500/5 flex items-center justify-center animate-pulse">
            <div className="w-48 h-48 rounded-full border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border border-sky-400/40 bg-sky-400/10 flex items-center justify-center text-sky-400 text-xs font-mono">
                BDIQ MESH
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Telemetry Overlay Badges */}
      <div className="absolute top-8 right-8 z-10 flex flex-col gap-2.5 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg px-3.5 py-2 shadow-xl flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-slate-300">SYSTEM STATUS: OPTIMAL</span>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg px-3.5 py-2 shadow-xl flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-sans">Global Market Nodes:</span>
          <span className="text-xs font-mono font-semibold text-sky-400">42 JURISDICTIONS</span>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg px-3.5 py-2 shadow-xl flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-sans">Validated Molecules:</span>
          <span className="text-xs font-mono font-semibold text-emerald-400">1,850+ ASSETS</span>
        </div>
      </div>

      {/* Bottom Mission / Identity Text */}
      <div className="absolute bottom-10 left-10 right-10 z-10 pointer-events-none">
        <div className="bg-slate-950/60 backdrop-blur-md border border-white/10 rounded-xl p-5 max-w-md shadow-2xl">
          <p className="text-xs font-mono text-sky-400 tracking-wider uppercase mb-1">
            Pharmaceutical Business Intelligence
          </p>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">
            BDIQ orchestrates drug portfolio opportunities, market evaluations, regulatory pathways, and commercial pipelines with auditable scientific precision.
          </p>
        </div>
      </div>
    </div>
  );
};
