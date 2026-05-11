import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface Transaction3DProps {
  type: 'sale' | 'credit' | 'payment' | 'refund';
  amount: number;
  timestamp: string;
}

/**
 * 3D Spinning Cube for transaction visualization
 */
const TransactionCube: React.FC<{ color: string }> = ({ color }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.015;
      meshRef.current.rotation.y += 0.02;
      meshRef.current.rotation.z += 0.01;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[1.8, 1.8, 1.8]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.3}
        metalness={0.8}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};

const getColorByType = (type: string): string => {
  switch (type) {
    case 'sale':
      return '#10b981';
    case 'credit':
      return '#3b82f6';
    case 'payment':
      return '#f59e0b';
    case 'refund':
      return '#ef4444';
    default:
      return '#6366f1';
  }
};

const getLabel = (type: string): string => {
  switch (type) {
    case 'sale':
      return '💰 Sale';
    case 'credit':
      return '📋 Credit';
    case 'payment':
      return '💳 Payment';
    case 'refund':
      return '↩️ Refund';
    default:
      return 'Transaction';
  }
};

export const Transaction3DCube: React.FC<Transaction3DProps> = ({
  type,
  amount,
  timestamp,
}) => {
  const color = getColorByType(type);
  const label = getLabel(type);

  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition">
      <div className="relative w-full h-48 bg-gradient-to-br from-gray-800 to-gray-900">
        <Canvas>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />
          <pointLight position={[-10, -10, 10]} intensity={0.4} color="#ff00ff" />
          <TransactionCube color={color} />
        </Canvas>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold">{label}</span>
          <span className="text-xs text-gray-500">{new Date(timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="text-3xl font-bold mt-3" style={{ color }}>
          ZWL {amount.toFixed(2)}
        </p>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">{new Date(timestamp).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};
