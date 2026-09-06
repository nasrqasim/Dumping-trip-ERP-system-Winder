'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';
import InventoryMaster from '../components/InventoryMaster';
import Customers from '../components/Customers';
import Vendors from '../components/Vendors';
import Vehicles from '../components/Vehicles';
import TripEntry from '../components/TripEntry';
import POSCounter from '../components/POSCounter';
import PurchaseEntry from '../components/PurchaseEntry';
import Vouchers from '../components/Vouchers';
import StaffManagement from '../components/StaffManagement';
import Banks from '../components/Banks';
import Reports from '../components/Reports';
import { migrateItemIds } from '../db/firestore';

export default function RootPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Cross-navigation hooks
  const [preselectedCustomerId, setPreselectedCustomerId] = useState('');
  const [preselectedVendorId, setPreselectedVendorId] = useState('');

  useEffect(() => {
    migrateItemIds();
  }, []);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
      {activeTab === 'items' && <InventoryMaster />}
      {activeTab === 'customers' && (
        <Customers 
          onNavigateToPOS={(cid) => {
            setPreselectedCustomerId(cid);
            setActiveTab('pos_sale');
          }} 
        />
      )}
      {activeTab === 'vendors' && (
        <Vendors 
          onNavigateToPurchase={(vid) => {
            setPreselectedVendorId(vid);
            setActiveTab('purchase_entry');
          }} 
        />
      )}
      {activeTab === 'vehicles' && <Vehicles />}
      {activeTab === 'trip_entry' && <TripEntry />}
      {activeTab === 'pos_sale' && (
        <POSCounter 
          preselectedCustomerId={preselectedCustomerId} 
          onClearPreselectedCustomer={() => setPreselectedCustomerId('')} 
        />
      )}
      {activeTab === 'purchase_entry' && (
        <PurchaseEntry 
          preselectedVendorId={preselectedVendorId} 
          onClearPreselectedVendor={() => setPreselectedVendorId('')} 
        />
      )}
      {activeTab === 'vouchers' && <Vouchers />}
      {activeTab === 'staff' && <StaffManagement />}
      {activeTab === 'banks' && <Banks />}
      {activeTab === 'reports' && <Reports />}
    </Layout>
  );
}
