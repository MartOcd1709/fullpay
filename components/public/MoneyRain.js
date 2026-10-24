"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Ambient ₹ particles behind the landing hero: real 3D meshes (thin extruded planes, lit, continuously
// rotating) rendered with react-three-fiber, not a 2D sprite trick. Fixed + pointer-events-none + negative
// z-index so it never intercepts clicks or taps and always paints behind normal-flow page content (a fixed,
// negative-z-index element still sits above the page's own background per the CSS stacking order — see the
// z-10 note below) while reacting to scroll for the "falling/accelerating" feel.
const DESKTOP_COUNT = 16;
const MOBILE_COUNT = 7;

function rupeeTexture(color) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = `bold ${size * 0.72}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("₹", size / 2, size / 2 + size * 0.04);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Symbols({ count, scrollRef }) {
  const groupRef = useRef(null);
  const texture = useMemo(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#8aa0f5";
    return rupeeTexture(accent);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  const items = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        start: [(Math.random() - 0.5) * 16, Math.random() * 14 - 4, (Math.random() - 0.5) * 6 - 2],
        fallSpeed: 0.25 + Math.random() * 0.4,
        drift: (Math.random() - 0.5) * 0.3,
        spin: [(Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6],
        scale: 0.5 + Math.random() * 0.7,
      })),
    [count],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const scrollBoost = 1 + scrollRef.current * 2.2;
    group.children.forEach((mesh, i) => {
      const item = items[i];
      mesh.position.y -= item.fallSpeed * scrollBoost * delta;
      mesh.position.x += Math.sin(state.clock.elapsedTime * 0.3 + i) * item.drift * delta;
      if (mesh.position.y < -8) mesh.position.y = 8 + Math.random() * 2;
      mesh.rotation.x += item.spin[0] * delta;
      mesh.rotation.y += item.spin[1] * delta;
      mesh.rotation.z += item.spin[2] * delta;
    });
    group.rotation.x = scrollRef.current * 0.3;
  });

  return (
    <group ref={groupRef}>
      {items.map((item, i) => (
        <mesh key={i} position={item.start} scale={item.scale}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial map={texture} transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export default function MoneyRain() {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(DESKTOP_COUNT);
  const scrollRef = useRef(0);
  const opacityRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
    setCount(window.innerWidth < 640 ? MOBILE_COUNT : DESKTOP_COUNT);

    function onScroll() {
      scrollRef.current = Math.min(window.scrollY / (window.innerHeight * 1.1), 1.4);
      if (opacityRef.current) {
        const fade = Math.max(0, 1 - window.scrollY / (window.innerHeight * 1.6));
        opacityRef.current.style.opacity = fade.toFixed(2);
      }
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!enabled) return null;

  return (
    <div ref={opacityRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 8], fov: 50 }} gl={{ alpha: true, antialias: false }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={0.8} />
        <Symbols count={count} scrollRef={scrollRef} />
      </Canvas>
    </div>
  );
}
