import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface Product3DProps {
  name: string;
  price: number;
  color?: string;
}

/**
 * 3D Rotating Product Box
 * Displays a product as a rotating 3D box with price information
 */
const RotatingBox: React.FC<{ color?: string }> = ({ color = '#3b82f6' }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.005;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshPhongMaterial color={color} shininess={100} />
    </mesh>
  );
};

export const Product3DCard: React.FC<Product3DProps> = ({ 
  name, 
  price, 
  color = '#10b981' 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="relative w-full h-64 bg-gradient-to-br from-gray-900 to-gray-800">
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />
          <RotatingBox color={color} />
        </Canvas>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-800">{name}</h3>
        <p className="text-2xl font-bold text-green-600 mt-2">
          ZWL {price.toFixed(2)}
        </p>
        <button className="w-full mt-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition">
          Add to Cart
        </button>
      </div>
    </div>
  );
};
