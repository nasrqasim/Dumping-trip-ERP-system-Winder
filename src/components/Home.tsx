'use client';

import React, { useState } from 'react';
import { 
  Truck, 
  Layers, 
  Receipt, 
  ShieldCheck, 
  BarChart3, 
  Users, 
  ArrowRight, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Building2, 
  Lock 
} from 'lucide-react';
import LoginModal from './LoginModal';
import { useAuth } from '../lib/auth';

interface HomeProps {
  onEnterApp: () => void;
}

export default function Home({ onEnterApp }: HomeProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const handleActionClick = () => {
    if (isAuthenticated) {
      onEnterApp();
    } else {
      setIsLoginOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center space-x-3.5 py-3">
            <div className="h-11 w-11 rounded-xl bg-white p-1 shadow-lg shadow-indigo-950/40 flex items-center justify-center border border-slate-700">
              <img src="/logo.jpeg" alt="Al-Madina Logo" className="h-full w-full object-contain rounded" />
            </div>
            <div>
              <span className="text-sm sm:text-base font-black tracking-wider uppercase text-white block">
                AL-MADINA CONSTRUCTION COMPANY
              </span>
              <span className="text-xs text-indigo-400 font-medium">Haji Gul &amp; Son's • Winder</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <span className="hidden sm:inline-block text-xs text-slate-300 font-medium">
                  Logged in as <strong className="text-indigo-400 font-bold">{user?.name}</strong> ({user?.role})
                </span>
                <button
                  onClick={onEnterApp}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 transition"
                >
                  <span>Open ERP Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 transition"
              >
                <Lock className="h-4 w-4" />
                <span>Sign In to ERP</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center">
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))] pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-6 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Enterprise Logistics, Weighbridge &amp; Dumping ERP System</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-none mb-6">
              Precision Logistics &amp; Real-Time Accounting for <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200">
                Al-Madina Construction Company
              </span>
            </h1>

            <p className="text-sm sm:text-lg text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
              Unified enterprise platform designed for Norani Kanta Weighbridge, dumping trips management, multi-ledger accounting, customer/vendor balances, staff payroll, and 80mm thermal receipt printing.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleActionClick}
                className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 text-sm sm:text-base flex items-center justify-center space-x-2 transition transform hover:-translate-y-0.5"
              >
                <span>{isAuthenticated ? 'Go to ERP Portal' : 'Access Staff Portal'}</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              <a
                href="tel:03152914836"
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-xl text-sm flex items-center justify-center space-x-2 transition"
              >
                <Phone className="h-4 w-4 text-indigo-400" />
                <span>Technical Support: 03152914836</span>
              </a>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="py-12 bg-slate-900/50 border-t border-b border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
                Key System Capabilities
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Optimized for high transaction volume, instant search, and zero data discrepancy
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center mb-4">
                  <Truck className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Trip &amp; Dumping Management</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Log dump truck dispatches, track gross/tare/net weight, material rates, commission, load tax, diesel, and driver expenses with automated net profit calculation.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-4">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Double-Entry Ledger Accounting</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Complete multi-ledger accounting for Customers, Vendors, Banks, and Staff with instant debit/credit balance reconciliation and zero sync delay.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-sky-950 text-sky-400 flex items-center justify-center mb-4">
                  <Receipt className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">80mm High-Contrast Thermal Slips</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Standard 80mm thermal receipts with high readability, company logo, breakdown of commission &amp; driver expenses, and customer balance summaries.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Executive Reports &amp; Analytics</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generate instant P&amp;L Statements, Cash Flows, Vehicle Freight Analysis, Item Movement, and date-range filtered transaction ledgers.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Role-Based Access Control</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Superadmin, Manager, and Operator roles with salted SHA-256 password hashing, user management, and session control.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition">
                <div className="w-12 h-12 rounded-xl bg-rose-950 text-rose-400 flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Multi-Device &amp; Fast Pagination</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Built to effortlessly scale to thousands of transactions with snappy pagination (25/50/100 records) and intelligent offline local caching.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold text-slate-300">
              AL-MADINA CONSTRUCTION COMPANY — HAJI GUL &amp; SON'S
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Weighbridge &amp; Material Supply • Winder, Balochistan
            </p>
          </div>

          <div className="text-center sm:text-right">
            <p className="text-[11px] text-slate-400 font-medium">
              ERP Developed by <strong className="text-indigo-400 font-bold">Roonjha Developers</strong>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
              Contact: 03152914836
            </p>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => {
          setIsLoginOpen(false);
          onEnterApp();
        }}
      />
    </div>
  );
}
