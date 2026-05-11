// Example: How to integrate 3D Effects into App.tsx

import Effects3DTestPage from './components/Effects3DTestPage';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Add this to your Router configuration:
export function AppWithEffects() {
  return (
    <Router>
      <Routes>
        {/* Existing routes */}
        <Route path="/" element={<YourDashboard />} />
        
        {/* Add 3D effects demo route */}
        <Route path="/3d-effects" element={<Effects3DTestPage />} />
        
        {/* Other routes */}
      </Routes>
    </Router>
  );
}

// Or use individual components in your dashboard:

import { 
  Product3DCard, 
  Sales3DPyramid, 
  Transaction3DCube, 
  Dashboard3DSphere 
} from './components/3D';

export function EnhancedDashboard() {
  return (
    <div className="space-y-8">
      {/* 3D Metrics Row */}
      <div className="grid grid-cols-4 gap-6">
        <Dashboard3DSphere 
          label="Total Sales" 
          value={12456} 
          unit="ZWL" 
          color="#10b981" 
        />
        <Dashboard3DSphere 
          label="Transactions" 
          value={324} 
          unit="count" 
          color="#3b82f6" 
        />
        <Dashboard3DSphere 
          label="Debtors" 
          value={18} 
          unit="customers" 
          color="#ef4444" 
        />
        <Dashboard3DSphere 
          label="Stock Items" 
          value={542} 
          unit="units" 
          color="#f59e0b" 
        />
      </div>

      {/* 3D Sales Analytics */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Weekly Sales</h2>
        <div className="grid grid-cols-7 gap-4">
          <Sales3DPyramid day="Mon" sales={2400} />
          <Sales3DPyramid day="Tue" sales={2210} />
          <Sales3DPyramid day="Wed" sales={2290} />
          <Sales3DPyramid day="Thu" sales={2000} />
          <Sales3DPyramid day="Fri" sales={2181} />
          <Sales3DPyramid day="Sat" sales={2500} />
          <Sales3DPyramid day="Sun" sales={2100} />
        </div>
      </div>

      {/* 3D Products */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Featured Products</h2>
        <div className="grid grid-cols-3 gap-6">
          <Product3DCard name="Maize Meal 10kg" price={9.99} color="#3b82f6" />
          <Product3DCard name="Cooking Oil 5L" price={8.49} color="#10b981" />
          <Product3DCard name="Sugar 2kg" price={2.85} color="#f59e0b" />
        </div>
      </div>

      {/* 3D Transactions */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Recent Transactions</h2>
        <div className="grid grid-cols-4 gap-4">
          <Transaction3DCube 
            type="sale" 
            amount={150.50} 
            timestamp={new Date().toISOString()} 
          />
          <Transaction3DCube 
            type="credit" 
            amount={75.25} 
            timestamp={new Date().toISOString()} 
          />
          <Transaction3DCube 
            type="payment" 
            amount={200.00} 
            timestamp={new Date().toISOString()} 
          />
          <Transaction3DCube 
            type="refund" 
            amount={25.75} 
            timestamp={new Date().toISOString()} 
          />
        </div>
      </div>
    </div>
  );
}

// Quick navigation button to add to header:
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HeaderWithEffectsButton() {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">POS System</h1>
        <Link 
          to="/3d-effects" 
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Sparkles size={20} />
          View 3D Effects
        </Link>
      </div>
    </header>
  );
}
