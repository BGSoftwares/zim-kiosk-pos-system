import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface SalesPyramidProps {
  day: string;
  sales: number;
}

/**
 * 3D Pyramid representing sales data
 */
const PyramidShape: React.FC<{ height: number }> = ({ height }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.008;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <coneGeometry args={[2, height, 4]} />
      <meshPhongMaterial 
        color="#f59e0b" 
        shininess={100}
        emissive="#d97706"
        emissiveIntensity={0.3}
      />
    </mesh>
  );
};

export const Sales3DPyramid: React.FC<SalesPyramidProps> = ({ day, sales }) => {
  const pyramidHeight = Math.min(5, (sales / 1000) * 3 + 1);

  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
      <div className="relative w-full h-72 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
        <Canvas camera={{ position: [0, 0, 8] }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[5, 5, 5]} intensity={1} />
          <pointLight position={[-5, -5, 5]} intensity={0.5} color="#ff6b6b" />
          <PyramidShape height={pyramidHeight} />
        </Canvas>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">{day}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ZWL {sales.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-600 font-semibold">↑ +12%</p>
            <p className="text-xs text-gray-500 mt-1">vs yesterday</p>
          </div>
        </div>
      </div>
    </div>
  );
};
