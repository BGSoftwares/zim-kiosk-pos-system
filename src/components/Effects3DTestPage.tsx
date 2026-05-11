import React, { useState, useEffect } from 'react';
import { Product3DCard, Sales3DPyramid, Transaction3DCube, Dashboard3DSphere } from '../3D';
import { motion } from 'framer-motion';
import { Sparkles, RotateCw, Zap } from 'lucide-react';

export const Effects3DTestPage: React.FC = () => {
  const [products3D] = useState([
    { name: 'Maize Meal 10kg', price: 9.99, color: '#3b82f6' },
    { name: 'Cooking Oil 5L', price: 8.49, color: '#10b981' },
    { name: 'Sugar 2kg', price: 2.85, color: '#f59e0b' },
  ]);

  const [salesData3D] = useState([
    { day: 'Monday', sales: 2400 },
    { day: 'Tuesday', sales: 2210 },
    { day: 'Wednesday', sales: 2290 },
  ]);

  const [transactions3D] = useState([
    { type: 'sale' as const, amount: 150.50, timestamp: new Date().toISOString() },
    { type: 'credit' as const, amount: 75.25, timestamp: new Date(Date.now() - 3600000).toISOString() },
    { type: 'payment' as const, amount: 200.00, timestamp: new Date(Date.now() - 7200000).toISOString() },
    { type: 'refund' as const, amount: 25.75, timestamp: new Date(Date.now() - 10800000).toISOString() },
  ]);

  const [metrics3D] = useState([
    { label: 'Total Sales', value: 12456, unit: 'ZWL', color: '#10b981' },
    { label: 'Transactions', value: 324, unit: 'count', color: '#3b82f6' },
    { label: 'Stock Items', value: 542, unit: 'units', color: '#f59e0b' },
    { label: 'Debtors', value: 18, unit: 'customers', color: '#ef4444' },
  ]);

  const [activeTab, setActiveTab] = useState('all');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <motion.div
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8 px-6 shadow-2xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={32} />
            <h1 className="text-4xl font-bold">3D Effects Showcase</h1>
          </div>
          <p className="text-blue-100">Interactive 3D visualizations for your POS system</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <motion.div
          className="flex gap-2 mb-8 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {['all', 'products', 'sales', 'transactions', 'metrics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        <motion.div
          className="space-y-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Products 3D Section */}
          {(activeTab === 'all' || activeTab === 'products') && (
            <motion.section variants={itemVariants} className="space-y-6">
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-400" size={24} />
                <h2 className="text-3xl font-bold text-white">3D Product Cards</h2>
              </div>
              <p className="text-gray-400">
                Rotating 3D product displays with real-time rendering
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {products3D.map((product, idx) => (
                  <motion.div key={idx} variants={itemVariants}>
                    <Product3DCard
                      name={product.name}
                      price={product.price}
                      color={product.color}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Sales 3D Section */}
          {(activeTab === 'all' || activeTab === 'sales') && (
            <motion.section variants={itemVariants} className="space-y-6">
              <div className="flex items-center gap-2">
                <RotateCw className="text-green-400" size={24} />
                <h2 className="text-3xl font-bold text-white">3D Sales Pyramids</h2>
              </div>
              <p className="text-gray-400">
                3D pyramid visualization of daily sales data
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {salesData3D.map((sale, idx) => (
                  <motion.div key={idx} variants={itemVariants}>
                    <Sales3DPyramid day={sale.day} sales={sale.sales} />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Transactions 3D Section */}
          {(activeTab === 'all' || activeTab === 'transactions') && (
            <motion.section variants={itemVariants} className="space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple-400" size={24} />
                <h2 className="text-3xl font-bold text-white">3D Transaction Cubes</h2>
              </div>
              <p className="text-gray-400">
                Rotating 3D cubes representing different transaction types
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {transactions3D.map((transaction, idx) => (
                  <motion.div key={idx} variants={itemVariants}>
                    <Transaction3DCube
                      type={transaction.type}
                      amount={transaction.amount}
                      timestamp={transaction.timestamp}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Metrics 3D Section */}
          {(activeTab === 'all' || activeTab === 'metrics') && (
            <motion.section variants={itemVariants} className="space-y-6">
              <div className="flex items-center gap-2">
                <Zap className="text-cyan-400" size={24} />
                <h2 className="text-3xl font-bold text-white">3D Dashboard Metrics</h2>
              </div>
              <p className="text-gray-400">
                Floating 3D spheres displaying key business metrics
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics3D.map((metric, idx) => (
                  <motion.div key={idx} variants={itemVariants}>
                    <Dashboard3DSphere
                      label={metric.label}
                      value={metric.value}
                      unit={metric.unit}
                      color={metric.color}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>

        {/* Info Box */}
        <motion.div
          className="mt-16 bg-gray-800 border border-blue-500 rounded-lg p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-xl font-bold text-white mb-3">✨ 3D Effects Features</h3>
          <ul className="text-gray-300 space-y-2">
            <li>✓ Real-time 3D rendering using Three.js & React Three Fiber</li>
            <li>✓ Smooth animations with Framer Motion integration</li>
            <li>✓ Performance optimized for all devices</li>
            <li>✓ Interactive rotating/floating objects</li>
            <li>✓ Dynamic lighting and shadows</li>
            <li>✓ Responsive canvas sizing</li>
            <li>✓ Touch and mouse support</li>
          </ul>
        </motion.div>

        {/* Usage Guide */}
        <motion.div
          className="mt-8 bg-gray-800 border border-purple-500 rounded-lg p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-xl font-bold text-white mb-4">📚 How to Use in Your App</h3>
          <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm">
{`import { 
  Product3DCard, 
  Sales3DPyramid, 
  Transaction3DCube, 
  Dashboard3DSphere 
} from './components/3D';

// Use in your components
<Product3DCard 
  name="Product Name" 
  price={9.99} 
  color="#3b82f6" 
/>

<Sales3DPyramid day="Monday" sales={2400} />

<Transaction3DCube 
  type="sale" 
  amount={150.50} 
  timestamp={new Date().toISOString()} 
/>

<Dashboard3DSphere 
  label="Total Sales" 
  value={12456} 
  unit="ZWL" 
  color="#10b981" 
/>`}
          </pre>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="mt-16 bg-gray-900 border-t border-gray-700 py-8 px-6 text-center text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <p>🚀 Ready to revolutionize your POS system with 3D effects!</p>
        <p className="text-sm mt-2">All 3D components are fully integrated and production-ready</p>
      </motion.div>
    </div>
  );
};

export default Effects3DTestPage;
