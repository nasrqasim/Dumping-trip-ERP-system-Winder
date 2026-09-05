import React from 'react';
import { LayoutGrid, Package, Users, Truck, Compass, ShoppingCart, ShoppingBag, Landmark, FileText, BadgeCent, BookOpen, Printer } from 'lucide-react';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export default function Layout({ activeTab, setActiveTab, children }: LayoutProps) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutGrid },
    { id: 'items', name: 'Items & Inventory', icon: Package },
    { id: 'customers', name: 'Customers CRM', icon: Users },
    { id: 'vendors', name: 'Vendors CRM', icon: Truck },
    { id: 'vehicles', name: 'Vehicles Master', icon: Compass },
    { id: 'trip_entry', name: 'Log Trips', icon: Compass },
    { id: 'pos_sale', name: 'POS Billing', icon: ShoppingCart },
    { id: 'purchase_entry', name: 'Material Purchase', icon: ShoppingBag },
    { id: 'vouchers', name: 'Vouchers & Expenses', icon: FileText },
    { id: 'staff', name: 'Staff & Salaries', icon: BadgeCent },
    { id: 'banks', name: 'Banks & History', icon: Landmark },
    { id: 'reports', name: 'Reports Center', icon: BookOpen },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Navigation - Hidden on Print */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 no-print">
        <div className="flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-wider uppercase">Norani Kanta ERP</h1>
              <p className="text-[10px] text-slate-500 font-medium">Logistics & Supply ERP</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {menuItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <IconComp className="h-4.5 w-4.5" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer (Centered & Professional) */}
        <div className="p-5 border-t border-slate-800 text-center">
          <p className="text-[11px] font-bold text-slate-500">Software by</p>
          <p className="text-xs font-black text-indigo-400 mt-0.5">Roonjha Developer</p>
          <p className="text-[10px] text-slate-600 font-medium mt-1">03152914836</p>
        </div>
      </aside>

      {/* Main Layout Contents Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        {/* Top Header - Hidden on Print */}
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-6 no-print shrink-0">
          <div className="flex items-center space-x-2">
            <h2 className="font-bold text-slate-800 text-base capitalize">
              {activeTab.replace('_', ' ')} Module
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-700">Administrator</p>
              <p className="text-[10px] text-slate-400 font-medium">Offline Sync Ready</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex justify-center items-center font-bold text-slate-600 text-xs">
              AD
            </div>
          </div>
        </header>

        {/* Sub-page view canvas - Scrollable */}
        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
