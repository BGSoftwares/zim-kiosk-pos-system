import React from 'react';
import { useProducts, useSales, useDebtors, useBranches } from '../services';

/**
 * Development-only API smoke-test component.
 * It now exercises the Django REST API backed by MySQL.
 */
export const DatabaseTestComponent: React.FC = () => {
  const { products, loading: productsLoading, getProductByBarcode, createProduct } = useProducts();
  const { sales, getDailySalesSummary } = useSales();
  const { debtors, createDebtor } = useDebtors();
  const { branches } = useBranches();

  const handleTestBarcode = async () => {
    const product = await getProductByBarcode('6001234567890');
    console.log('Django API barcode result:', product);
    alert(`Found: ${product?.name || 'Not found'}`);
  };

  const handleCreateTestProduct = async () => {
    const result = await createProduct({
      name: 'Test Product', barcode: `TEST-${Date.now()}`, sku: `SKU-${Date.now()}`,
      buying_price: 10, selling_price: 15, wholesale_price: 12, stock: 0,
      reorder_level: 0, category: '', supplier: '',
    });
    alert(`Product created: ${result?.name || 'Failed'}`);
  };

  const handleCreateTestDebtor = async () => {
    const result = await createDebtor({ name: `Test Debtor ${Date.now()}`, phone: '+263 77 123 4567', total_owed: 0, branch_id: '', address: '', notes: '' });
    alert(`Debtor created: ${result?.name || 'Failed'}`);
  };

  const handleDailySummary = async () => {
    const summary = await getDailySalesSummary(new Date().toISOString().split('T')[0]);
    alert(`Total Sales: ${summary?.totalSales || 0}\nMethods: ${JSON.stringify(summary?.byPaymentMethod || {})}`);
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h2>Django + MySQL API Smoke Tests</h2>
      <p>Use only in development. Tests call the Django REST API; no Supabase dependency remains.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <button onClick={handleTestBarcode}>Test Barcode</button>
        <button onClick={handleCreateTestProduct}>Create Test Product</button>
        <button onClick={handleCreateTestDebtor}>Create Test Debtor</button>
        <button onClick={handleDailySummary}>Daily Sales Summary</button>
      </div>
      <div style={{ marginTop: 20 }}>
        <p><strong>Products:</strong> {productsLoading ? 'Loading...' : products.length}</p>
        <p><strong>Sales:</strong> {sales.length}</p>
        <p><strong>Debtors:</strong> {debtors.length}</p>
        <p><strong>Branches:</strong> {branches.length}</p>
      </div>
    </div>
  );
};

export default DatabaseTestComponent;
