'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../lib/auth';
import Layout from '../components/Layout';
import Home from '../components/Home';
import Settings from '../components/Settings';
import Dashboard from '../components/Dashboard';
import InventoryMaster from '../components/InventoryMaster';
import Customers from '../components/Customers';
import Vendors from '../components/Vendors';
import Vehicles from '../components/Vehicles';
import TripEntry from '../components/TripEntry';
import POSCounter from '../components/POSCounter';
import PurchaseEntry from '../components/PurchaseEntry';
import DirectPurchases from '../components/DirectPurchases';
import DieselManagement from '../components/DieselManagement';
import VehicleMaintenance from '../components/VehicleMaintenance';
import Vouchers from '../components/Vouchers';
import StaffManagement from '../components/StaffManagement';
import Banks from '../components/Banks';
import Reports from '../components/Reports';
import { migrateItemIds } from '../db/firestore';
import { Loader2 } from 'lucide-react';

function ERPAppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [viewMode, setViewMode] = useState<'home' | 'portal'>('home');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Cross-navigation hooks
  const [preselectedCustomerId, setPreselectedCustomerId] = useState('');
  const [preselectedVendorId, setPreselectedVendorId] = useState('');

  useEffect(() => {
    migrateItemIds();
  }, []);

  // When auth state finishes loading, if user is logged in, default viewMode to portal
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setViewMode('portal');
      } else {
        setViewMode('home');
      }
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-14 h-14 bg-white rounded-2xl p-1.5 shadow-2xl mb-4 flex items-center justify-center animate-pulse">
          <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-contain rounded" />
        </div>
        <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Starting ERP &amp; Syncing Secure Session...</span>
        </div>
      </div>
    );
  }

  // If user is on the public landing page, or is unauthenticated and tries to access portal
  if (viewMode === 'home' || !isAuthenticated) {
    return (
      <Home 
        onEnterApp={() => {
          if (isAuthenticated) {
            setViewMode('portal');
          }
        }} 
      />
    );
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onGoToHome={() => setViewMode('home')}
    >
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
      {activeTab === 'diesel' && <DieselManagement />}
      {activeTab === 'vehicle_maintenance' && <VehicleMaintenance />}
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
      {activeTab === 'direct_purchases' && <DirectPurchases />}
      {activeTab === 'vouchers' && <Vouchers />}
      {activeTab === 'staff' && <StaffManagement />}
      {activeTab === 'banks' && <Banks />}
      {activeTab === 'reports' && <Reports />}
      {activeTab === 'settings' && (
        <Settings onLogoutSuccess={() => setViewMode('home')} />
      )}
    </Layout>
  );
}

export default function RootPage() {
  return (
    <AuthProvider>
      <ERPAppContent />
    </AuthProvider>
  );
}
