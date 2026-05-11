import React from 'react';
import { useProducts, useSales, useDebtors, useBranches } from '../services';

/**
 * Database Integration Test Component
 * This component demonstrates and tests all database operations
 * Comment/uncomment sections to test different features
 */
export const DatabaseTestComponent: React.FC = () => {
  const { products, loading: productsLoading, getProductByBarcode, createProduct } = useProducts();
  const { sales, createSale, getDailySalesSummary } = useSales();
  const { debtors, createDebtor, addTransaction } = useDebtors();
  const { branches } = useBranches();

  // Test: Fetch product by barcode
  const handleTestBarcode = async () => {
    console.log('Testing barcode scan...');
    const product = await getProductByBarcode('6001234567890');
    console.log('Found product:', product);
    alert(`Found: ${product?.name || 'Not found'}`);
  };

  // Test: Create a test product
  const handleCreateTestProduct = async () => {
    console.log('Creating test product...');
    const result = await createProduct({
      name: 'Test Product',
      barcode: `TEST-${Date.now()}`,
      sku: `SKU-${Date.now()}`,
      buying_price: 10,
      selling_price: 15,
      wholesale_price: 12,
      stock: 100,
      reorder_level: 20,
      category: 'Test',
      supplier: 'Test Supplier',
    });
    console.log('Created product:', result);
    alert(`Product created: ${result?.name || 'Failed'}`);
  };

  // Test: Create a sale
  const handleCreateTestSale = async () => {
    if (!branches.length) {
      alert('No branches available');
      return;
    }

    const testSaleItems = products.slice(0, 2).map(p => ({
      product_id: p.id,
      quantity: 2,
      unit_price: p.selling_price,
      discount: 0,
      subtotal: 2 * p.selling_price,
    }));

    if (testSaleItems.length === 0) {
      alert('No products available to create sale');
      return;
    }

    console.log('Creating test sale...');
    const result = await createSale(
      {
        total_amount: testSaleItems.reduce((sum, item) => sum + item.subtotal, 0),
        payment_method: 'cash',
        currency: 'ZWL',
        cashier_id: 'test-cashier', // Replace with actual user ID
        branch_id: branches[0].id,
        customer_phone: '+263 77 000 0000',
        notes: 'Test sale from integration test',
      },
      testSaleItems
    );
    console.log('Created sale:', result);
    alert(`Sale created: ${result?.id || 'Failed'}`);
  };

  // Test: Create a debtor
  const handleCreateTestDebtor = async () => {
    if (!branches.length) {
      alert('No branches available');
      return;
    }

    console.log('Creating test debtor...');
    const result = await createDebtor({
      name: `Test Debtor ${Date.now()}`,
      phone: '+263 77 123 4567',
      address: '123 Test Street',
      national_id: `ID-${Date.now()}`,
      total_owed: 0,
      branch_id: branches[0].id,
      notes: 'Created from test component',
    });
    console.log('Created debtor:', result);
    alert(`Debtor created: ${result?.name || 'Failed'}`);
  };

  // Test: Add credit transaction
  const handleAddCredit = async () => {
    if (debtors.length === 0) {
      alert('No debtors available. Create one first.');
      return;
    }

    console.log('Adding credit transaction...');
    const result = await addTransaction({
      debtor_id: debtors[0].id,
      transaction_type: 'credit',
      amount: 50,
      notes: 'Test credit transaction',
    });
    console.log('Added transaction:', result);
    alert(`Transaction added: ${result?.id || 'Failed'}`);
  };

  // Test: Get daily sales summary
  const handleDailySummary = async () => {
    const today = new Date().toISOString().split('T')[0];
    console.log('Fetching daily summary for:', today);
    const summary = await getDailySalesSummary(today);
    console.log('Daily summary:', summary);
    alert(
      `Total Sales: ${summary?.totalSales || 0}\n` +
      `Methods: ${JSON.stringify(summary?.byPaymentMethod || {})}`
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Database Integration Tests</h2>
      <p style={{ color: '#666' }}>
        Use the buttons below to test database operations. Check console for detailed logs.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <button onClick={handleTestBarcode} style={{ padding: '10px', cursor: 'pointer' }}>
          Test Barcode Scan
        </button>

        <button onClick={handleCreateTestProduct} style={{ padding: '10px', cursor: 'pointer' }}>
          Create Test Product
        </button>

        <button onClick={handleCreateTestSale} style={{ padding: '10px', cursor: 'pointer' }}>
          Create Test Sale
        </button>

        <button onClick={handleCreateTestDebtor} style={{ padding: '10px', cursor: 'pointer' }}>
          Create Test Debtor
        </button>

        <button onClick={handleAddCredit} style={{ padding: '10px', cursor: 'pointer' }}>
          Add Credit Transaction
        </button>

        <button onClick={handleDailySummary} style={{ padding: '10px', cursor: 'pointer' }}>
          Get Daily Summary
        </button>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5' }}>
        <h3>Current Data Summary:</h3>
        <p>
          <strong>Products:</strong> {productsLoading ? 'Loading...' : products.length} items
        </p>
        <p>
          <strong>Sales:</strong> {sales.length} transactions
        </p>
        <p>
          <strong>Debtors:</strong> {debtors.length} customers
        </p>
        <p>
          <strong>Branches:</strong> {branches.length} locations
        </p>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fff3cd', borderLeft: '4px solid #ffc107' }}>
        <strong>⚠️ Note:</strong> Make sure your Supabase database is set up before running these tests.
        See SUPABASE_SETUP.md for instructions.
      </div>
    </div>
  );
};

export default DatabaseTestComponent;
