import React from 'react';
import { 
  LayoutGrid, 
  Package, 
  Users, 
  Truck, 
  Compass, 
  ShoppingCart, 
  ShoppingBag, 
  Landmark, 
  FileText, 
  BadgeCent, 
  BookOpen, 
  Settings as SettingsIcon, 
  LogOut, 
  Home as HomeIcon,
  ShieldCheck,
  Fuel,
  Wrench,
  Receipt
} from 'lucide-react';
import { useAuth } from '../lib/auth';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onGoToHome?: () => void;
  children: React.ReactNode;
}

export default function Layout({ activeTab, setActiveTab, onGoToHome, children }: LayoutProps) {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutGrid },
    { id: 'trip_entry', name: 'Log Trips & Rentals', icon: Compass },
    { id: 'vehicles', name: 'Vehicles & Fleet', icon: Truck },
    { id: 'diesel', name: 'Diesel & Fuel Accounting', icon: Fuel },
    { id: 'vehicle_maintenance', name: 'Vehicle Maintenance', icon: Wrench },
    { id: 'items', name: 'Items & Inventory', icon: Package },
    { id: 'pos_sale', name: 'POS Billing & Sales', icon: ShoppingCart },
    { id: 'purchase_entry', name: 'Material Purchases', icon: ShoppingBag },
    { id: 'direct_purchases', name: 'Direct Vendor Purchases', icon: Receipt },
    { id: 'customers', name: 'Customers CRM', icon: Users },
    { id: 'vendors', name: 'Vendors CRM', icon: Users },
    { id: 'staff', name: 'Staff & Salaries', icon: BadgeCent },
    { id: 'vouchers', name: 'Vouchers & Expenses', icon: FileText },
    { id: 'banks', name: 'Banks & Cash History', icon: Landmark },
    { id: 'reports', name: 'Reports Center', icon: BookOpen },
    { id: 'settings', name: 'Settings & Security', icon: SettingsIcon },
  ];

  const handleSignOut = () => {
    logout();
    if (onGoToHome) onGoToHome();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Navigation - Hidden on Print */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 no-print">
        <div className="flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/logo.jpeg" alt="Logo" className="h-9 w-9 object-contain rounded bg-white p-0.5" />
              <div>
                <h1 className="font-extrabold text-xs text-white tracking-wider uppercase leading-tight">AL-MADINA CONSTRUCTION</h1>
                <p className="text-[10px] text-slate-400 font-medium">Haji Gul &amp; Son's</p>
              </div>
            </div>
          </div>

          {/* Quick Home / Portal Link */}
          {onGoToHome && (
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={onGoToHome}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-indigo-300 border border-slate-700/60 transition"
              >
                <HomeIcon className="h-3.5 w-3.5" />
                <span>Public Landing Page</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {menuItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <IconComp className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer with Developer Credits & Sign Out */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/30 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out Session</span>
          </button>

          <div className="text-center pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
            <span>Roonjha Developers</span>
            <span className="block text-slate-400 font-semibold">03152914836</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
