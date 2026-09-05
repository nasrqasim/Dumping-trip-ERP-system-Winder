import React, { useEffect, useState } from 'react';
import { calculateLiveBalances, LiveBalances } from '../db/transactions';
import { getAllRecords, DBTrip, DBSale, DBPurchase, DBGeneralExpense, DBOtherIncome, DBItem, DBCustomer, DBVendor, DBVoucher, DBLedgerEntry } from '../db/indexedDB';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Wallet, Landmark, ArrowUpRight, ArrowDownRight, Truck, TrendingUp, AlertTriangle, PackageOpen, Printer } from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [sales, setSales] = useState<DBSale[]>([]);
  const [purchases, setPurchases] = useState<DBPurchase[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<DBGeneralExpense[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<DBOtherIncome[]>([]);
  const [ledgers, setLedgers] = useState<DBLedgerEntry[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const bal = await calculateLiveBalances();
        setBalances(bal);

        const allTrips = await getAllRecords<DBTrip>('trips');
        setTrips(allTrips);

        const allSales = await getAllRecords<DBSale>('sales');
        setSales(allSales);

        const allPurchases = await getAllRecords<DBPurchase>('purchases');
        setPurchases(allPurchases);

        const allGeneralExpenses = await getAllRecords<DBGeneralExpense>('general_expenses');
        setGeneralExpenses(allGeneralExpenses);

        const allOtherIncomes = await getAllRecords<DBOtherIncome>('other_incomes');
        setOtherIncomes(allOtherIncomes);

        const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
        setLedgers(allLedgers);

        const allItems = await getAllRecords<DBItem>('items');
        setItems(allItems);

        const allCustomers = await getAllRecords<DBCustomer>('customers');
        setCustomers(allCustomers);

        const allVendors = await getAllRecords<DBVendor>('vendors');
        setVendors(allVendors);

        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      }
    }
    loadData();
  }, []);

  if (loading || !balances) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  // Get current date string in local time (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  // Today's calculations
  const todayTrips = trips.filter(t => t.date === todayStr);
  const todaySales = sales.filter(s => s.date === todayStr);
  const todayIncomes = otherIncomes.filter(i => i.date === todayStr);
  const todayExp = generalExpenses.filter(e => e.date === todayStr);

  // Kamai = POS Sales + Trip Material + Trip Charges + Other Income
  const todayTripKamai = todayTrips.reduce((sum, t) => sum + t.materialTotal + t.vehicleCharges, 0);
  const todayPOSKamai = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayOtherIncomeTotal = todayIncomes.reduce((sum, i) => sum + i.amount, 0);
  const todayKamai = todayTripKamai + todayPOSKamai + todayOtherIncomeTotal;

  // Expenses = Trip Expenses + General Expenses
  const todayTripExpenses = todayTrips.reduce((sum, t) => sum + t.totalExpenses, 0);
  const todayGeneralExpensesTotal = todayExp.reduce((sum, e) => sum + e.amount, 0);
  const todayExpenses = todayTripExpenses + todayGeneralExpensesTotal;

  const todayNetProfit = todayKamai - todayExpenses;

  // Alerts calculations
  const lowStockItems = items.filter(item => {
    const stock = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
    return stock <= item.minStock;
  });

  // Check 30 days overdue parties
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const overdueCustomers = customers.filter(cust => {
    const cBal = balances.customerBalances[cust.id];
    if (!cBal || cBal.outstanding <= 0) return false;
    
    // Find oldest unpaid debit transaction
    const custLedger = ledgers.filter(l => l.accountId === cust.id && l.debit > 0);
    if (custLedger.length === 0) return false;
    
    const oldestDate = new Date(custLedger.reduce((oldest, current) => {
      return new Date(current.date) < new Date(oldest) ? current.date : oldest;
    }, custLedger[0].date));

    return oldestDate < thirtyDaysAgo;
  });

  const overdueVendors = vendors.filter(vend => {
    const vBal = balances.vendorBalances[vend.id];
    if (!vBal || vBal.outstanding <= 0) return false;

    // Find oldest unpaid credit purchase
    const vendLedger = ledgers.filter(l => l.accountId === vend.id && l.credit > 0);
    if (vendLedger.length === 0) return false;

    const oldestDate = new Date(vendLedger.reduce((oldest, current) => {
      return new Date(current.date) < new Date(oldest) ? current.date : oldest;
    }, vendLedger[0].date));

    return oldestDate < thirtyDaysAgo;
  });

  // Calculate 30-day graph data
  const graphData: { date: string; kamai: number; expenses: number; profit: number }[] = [];
  const dateMap: { [date: string]: { kamai: number; expenses: number } } = {};

  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    dateMap[dStr] = { kamai: 0, expenses: 0 };
  }

  // Populate data from trips
  for (const t of trips) {
    if (dateMap[t.date]) {
      dateMap[t.date].kamai += (t.materialTotal + t.vehicleCharges);
      dateMap[t.date].expenses += t.totalExpenses;
    }
  }

  // Populate data from POS sales
  for (const s of sales) {
    if (dateMap[s.date]) {
      dateMap[s.date].kamai += s.total;
    }
  }

  // Populate other income
  for (const inc of otherIncomes) {
    if (dateMap[inc.date]) {
      dateMap[inc.date].kamai += inc.amount;
    }
  }

  // Populate general expenses
  for (const exp of generalExpenses) {
    if (dateMap[exp.date]) {
      dateMap[exp.date].expenses += exp.amount;
    }
  }

  // Build array
  for (const date in dateMap) {
    const k = dateMap[date].kamai;
    const e = dateMap[date].expenses;
    graphData.push({
      date: date.substring(5), // YYYY-MM-DD to MM-DD
      kamai: k,
      expenses: e,
      profit: k - e,
    });
  }

  // Calculate Receivables & Payables & Advances
  let totalReceivables = 0;
  let totalPayables = 0;
  let totalCustomerAdvance = 0;
  let totalVendorAdvance = 0;

  for (const cid in balances.customerBalances) {
    totalReceivables += balances.customerBalances[cid].outstanding;
    totalCustomerAdvance += balances.customerBalances[cid].advance;
  }
  for (const vid in balances.vendorBalances) {
    totalPayables += balances.vendorBalances[vid].outstanding;
    totalVendorAdvance += balances.vendorBalances[vid].advance;
  }

  // Aggregated Business Totals
  const currentMonthStr = todayStr.substring(0, 7);
  const totalSalesRevenue = trips.reduce((sum, t) => sum + t.materialTotal + t.vehicleCharges, 0) + sales.reduce((sum, s) => sum + s.total, 0);
  const totalPurchasesCost = purchases.reduce((sum, p) => sum + p.total, 0);
  const totalExpensesCost = trips.reduce((sum, t) => sum + t.totalExpenses, 0) + generalExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPOSSalesAmount = sales.reduce((sum, s) => sum + s.total, 0);

  // Today and Monthly Trips & Freight Metrics
  const monthlyTrips = trips.filter(t => t.date && t.date.startsWith(currentMonthStr));
  const todayTripFreight = todayTrips.reduce((sum, t) => sum + (t.vehicleCharges || 0), 0);
  const monthlyTripFreight = monthlyTrips.reduce((sum, t) => sum + (t.vehicleCharges || 0), 0);

  // Sales & Purchases Totals
  const monthlySales = sales.filter(s => s.date && s.date.startsWith(currentMonthStr));
  const todayPurchases = purchases.filter(p => p.date === todayStr);
  const monthlyPurchases = purchases.filter(p => p.date && p.date.startsWith(currentMonthStr));

  const todayGrossSales = todaySales.reduce((sum, s) => sum + s.total, 0) + todayTrips.reduce((sum, t) => sum + t.materialTotal, 0);
  const monthlyGrossSales = monthlySales.reduce((sum, s) => sum + s.total, 0) + monthlyTrips.reduce((sum, t) => sum + t.materialTotal, 0);
  const todayPurchasesTotal = todayPurchases.reduce((sum, p) => sum + p.total, 0);
  const monthlyPurchasesTotal = monthlyPurchases.reduce((sum, p) => sum + p.total, 0);

  // Cash Received & Cash Paid Today from Ledgers
  const todayCashReceived = ledgers.filter(l => l.date === todayStr && l.accountId === 'cash' && l.debit > 0).reduce((sum, l) => sum + l.debit, 0);
  const todayCashPaid = ledgers.filter(l => l.date === todayStr && l.accountId === 'cash' && l.credit > 0).reduce((sum, l) => sum + l.credit, 0);

  // Customer Receipts & Vendor Payments Today
  const todayCustomerReceipts = ledgers.filter(l => l.date === todayStr && customers.some(c => c.id === l.accountId) && l.credit > 0).reduce((sum, l) => sum + l.credit, 0);
  const todayVendorPayments = ledgers.filter(l => l.date === todayStr && vendors.some(v => v.id === l.accountId) && l.debit > 0).reduce((sum, l) => sum + l.debit, 0);

  // Inventory Valuation
  const totalInventoryValuation = items.reduce((sum, item) => {
    const stock = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
    return sum + (stock * item.purchaseRate);
  }, 0);

  // Net Profit & Executive Summary Total (Cash & Banks + Receivables - Payables)
  const netProfitPosition = todayNetProfit;
  const executiveSummaryTotal = balances.cashBalance + balances.totalBankBalance + totalReceivables - totalPayables;
  
  // Inventory Counts
  let totalStockQuantity = 0;
  let outOfStockCount = 0;
  for (const item of items) {
    const stock = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
    totalStockQuantity += stock;
    if (stock <= 0) outOfStockCount++;
  }

  return (
    <div className="space-y-6">
      {/* Top Header with Print Summary Button */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Executive Dashboard & Analytics</h2>
          <p className="text-sm text-slate-500">Live operational overview, financial statistics, and inventory health</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Printer className="h-4 w-4" />
          <span>Print Summary</span>
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Financial Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Cash in Hand</p>
              <h3 className="text-2xl font-bold text-slate-800">Rs. {balances.cashBalance.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Bank Balance</p>
              <h3 className="text-2xl font-bold text-slate-800">Rs. {balances.totalBankBalance.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Receivables</p>
              <h3 className="text-2xl font-bold text-slate-800">Rs. {totalReceivables.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
              <ArrowDownRight className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Payables</p>
              <h3 className="text-2xl font-bold text-slate-800">Rs. {totalPayables.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Activity Cards */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Today's Transport & Sales Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 text-white p-5 rounded-lg shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-slate-700 text-slate-200 rounded-full">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Today's Trips</p>
              <h3 className="text-2xl font-bold">{todayTrips.length} Trips</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Today Sales / Kamai</p>
              <h3 className="text-2xl font-bold text-slate-800">Rs. {todayKamai.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-full">
              <ArrowDownRight className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Today Trip Expenses</p>
              <h3 className="text-2xl font-bold text-slate-800">Rs. {todayTripExpenses.toLocaleString()}</h3>
            </div>
          </div>

          <div className={`p-5 rounded-lg shadow-sm border flex items-center space-x-4 ${todayNetProfit >= 0 ? 'bg-emerald-50/50 border-emerald-100 text-slate-800' : 'bg-rose-50/50 border-rose-100 text-slate-800'}`}>
            <div className={`p-3 rounded-full ${todayNetProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Today Net Profit</p>
              <h3 className={`text-2xl font-bold ${todayNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                Rs. {todayNetProfit.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Section Graph & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Financial Trends (Last 30 Days)</h3>
          <div className="h-80 w-100">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graphData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKamai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="kamai" name="Sales/Kamai" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorKamai)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>ERP Critical Alerts</span>
            </h3>
            
            <div className="space-y-4 overflow-y-auto max-h-72 pr-1">
              {/* Overdue Customers */}
              {overdueCustomers.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Customers Overdue &gt; 30 Days</p>
                  <div className="space-y-1">
                    {overdueCustomers.slice(0, 3).map(cust => (
                      <div key={cust.id} className="flex justify-between text-sm">
                        <span className="font-medium text-slate-700">{cust.name}</span>
                        <span className="font-bold text-amber-700">Rs. {balances.customerBalances[cust.id].outstanding.toLocaleString()}</span>
                      </div>
                    ))}
                    {overdueCustomers.length > 3 && (
                      <p className="text-xs text-slate-500 text-right mt-1">+ {overdueCustomers.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Overdue Vendors */}
              {overdueVendors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                  <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider mb-1">Vendors Unpaid &gt; 30 Days</p>
                  <div className="space-y-1">
                    {overdueVendors.slice(0, 3).map(vend => (
                      <div key={vend.id} className="flex justify-between text-sm">
                        <span className="font-medium text-slate-700">{vend.name}</span>
                        <span className="font-bold text-rose-700">Rs. {balances.vendorBalances[vend.id].outstanding.toLocaleString()}</span>
                      </div>
                    ))}
                    {overdueVendors.length > 3 && (
                      <p className="text-xs text-slate-500 text-right mt-1">+ {overdueVendors.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Low Stock */}
              {lowStockItems.length > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                  <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider mb-1">Low Stock Items</p>
                  <div className="space-y-1">
                    {lowStockItems.slice(0, 3).map(item => {
                      const stock = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
                      return (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="font-medium text-slate-700">{item.name}</span>
                          <span className="font-bold text-orange-700">{stock} {item.unit} (Min: {item.minStock})</span>
                        </div>
                      );
                    })}
                    {lowStockItems.length > 3 && (
                      <p className="text-xs text-slate-500 text-right mt-1">+ {lowStockItems.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}

              {overdueCustomers.length === 0 && overdueVendors.length === 0 && lowStockItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <PackageOpen className="h-10 w-10 mb-2 stroke-1" />
                  <p className="text-sm font-medium">All accounts and stocks are healthy!</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 flex justify-between text-xs text-slate-400">
            <span>Live Sync Active</span>
            <span>Date: {todayStr}</span>
          </div>
        </div>
      </div>

      {/* Printable Dashboard Summary Document (Print-Only matching Image 1) */}
      <div className="hidden print:block print-a4 print-container space-y-4">
        <div className="text-center pb-3">
          <h1 className="text-2xl font-black tracking-wide text-[#800000] uppercase font-serif">
            AL MADINA BUILDING MATERIAL UTHAL
          </h1>
          <h2 className="text-sm font-extrabold tracking-wider text-[#800000] uppercase mt-0.5 font-serif">
            EXECUTIVE DASHBOARD & CASH / BANK / BALANCES SUMMARY
          </h2>
          <p className="text-[11px] text-slate-600 font-medium mt-1">
            Phone: 03351279963 <span className="mx-1 text-slate-400">|</span> Address: Main Bazaar, Uthal, District Lasbela, Balochistan
          </p>
          <div className="flex justify-center items-center text-[11px] font-semibold text-slate-600 space-x-3 mt-0.5">
            <span>Printed Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-slate-400">|</span>
            <span>Total Records: 16</span>
          </div>
        </div>

        <table className="min-w-full text-xs border-collapse border border-slate-300">
          <thead className="bg-[#800000] text-white uppercase text-[11px]">
            <tr>
              <th className="px-4 py-2.5 text-left font-bold tracking-wider border border-slate-300">CATEGORY / METRIC</th>
              <th className="px-4 py-2.5 text-left font-bold tracking-wider border border-slate-300">DESCRIPTION & STATUS</th>
              <th className="px-4 py-2.5 text-right font-bold tracking-wider border border-slate-300">AMOUNT / COUNT (PKR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">CASH & BANKS BALANCE</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Current Cash Counter & Bank Funds Position</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {(balances.cashBalance + balances.totalBankBalance).toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">CASH RECEIVED TODAY</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Total Receipts Recorded Today</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {todayCashReceived.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">CASH PAID TODAY</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Total Payments Made Today</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {todayCashPaid.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">TOTAL CUSTOMER RECEIVABLES</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Outstanding Amount Owed by Customers</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {totalReceivables.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">CUSTOMER RECEIPTS TODAY</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Collections Recorded Today from Customers</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {todayCustomerReceipts.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">TOTAL VENDOR PAYABLES</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Outstanding Amount Owed to Suppliers / Vendors</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {totalPayables.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">VENDOR PAYMENTS TODAY</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Supplier Payments Recorded Today</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {todayVendorPayments.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">SALES TODAY</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Gross Sales Invoiced Today</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {todayGrossSales.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">PURCHASES TODAY</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Inventory Purchases Invoiced Today</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {todayPurchasesTotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">MONTHLY SALES</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Cumulative Sales for Current Month</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {monthlyGrossSales.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">MONTHLY PURCHASES</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Cumulative Purchases for Current Month</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {monthlyPurchasesTotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">TRIPS DISPATCHED TODAY</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Material Dispatch Logistics Trips Today</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">{todayTrips.length} Trips (Kamai: Rs. {todayTripFreight.toLocaleString()})</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">MONTHLY TRIPS (LOGISTICS)</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Cumulative Dispatches & Logistics Freight This Month</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">{monthlyTrips.length} Trips (Kamai: Rs. {monthlyTripFreight.toLocaleString()})</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">TOTAL INVENTORY VALUE</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Current Valuation of Stock In Hand</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {totalInventoryValuation.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-bold text-slate-900 border border-slate-300">NET PROFIT POSITION</td>
              <td className="px-4 py-2 text-slate-600 border border-slate-300">Calculated Revenue Less Cost & Expenses</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 border border-slate-300">Rs. {todayNetProfit.toLocaleString()}</td>
            </tr>
            <tr className="bg-[#e0f2fe] border-t-2 border-slate-400">
              <td className="px-4 py-2.5 font-black text-slate-900 border border-slate-300 text-[12px]">EXECUTIVE SUMMARY TOTAL</td>
              <td className="px-4 py-2.5 font-bold text-slate-800 border border-slate-300 text-[11px]">Net Liquidity & Receivables less Payables</td>
              <td className="px-4 py-2.5 text-right font-black text-slate-950 border border-slate-300 text-[13px]">Rs. {executiveSummaryTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
          Software by Roonjha Developer - 03152914836
        </div>
      </div>
    </div>
  );
}
