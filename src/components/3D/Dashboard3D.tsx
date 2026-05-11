import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface Dashboard3DProps {
  label: string;
  value: number;
  unit: string;
  color?: string;
}

/**
 * 3D Floating Sphere for dashboard metrics
 */
const FloatingSphere: React.FC<{ color: string }> = ({ color }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.002;
      meshRef.current.rotation.y += 0.005;
      meshRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[1.2, 64, 64]} />
      <meshPhongMaterial
        color={color}
        shininess={120}
        wireframe={false}
      />
      {/* Wireframe ring */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[1.5, 0.05, 16, 100]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
    </mesh>
  );
};

export const Dashboard3DSphere: React.FC<Dashboard3DProps> = ({
  label,
  value,
  unit,
  color = '#8b5cf6',
}) => {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700 p-0">
      <div className="relative w-full h-64 bg-gradient-to-b from-gray-800 to-black">
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, 10]} intensity={0.5} color="#ff00ff" />
          <FloatingSphere color={color} />
        </Canvas>
      </div>
      <div className="p-4 text-white">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold" style={{ color }}>
            {value.toLocaleString()}
          </span>
          <span className="text-sm text-gray-400">{unit}</span>
        </div>
      </div>
    </div>
  );
};
