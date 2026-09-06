import React, { useEffect, useState } from 'react';
import { getAllRecords, DBLedgerEntry, DBItem, DBCustomer, DBVendor, DBVehicle, DBStaff, DBTrip, DBPurchase, DBSale, DBGeneralExpense, DBOtherIncome, DBBank, DBInventoryLedgerEntry, DBVoucher } from '../db/firestore';
import { calculateLiveBalances, LiveBalances } from '../db/transactions';
import { Printer, Calendar, Search, FileSpreadsheet, Percent, Columns, X } from 'lucide-react';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'inventory' | 'financial' | 'salary' | 'transport'>('sales');
  const [activeReport, setActiveReport] = useState<string>('sales-summary');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterItemId, setFilterItemId] = useState('all');
  const [filterCustomerId, setFilterCustomerId] = useState('all');
  const [filterVendorId, setFilterVendorId] = useState('all');
  const [filterVehicleId, setFilterVehicleId] = useState('all');
  const [filterStaffId, setFilterStaffId] = useState('all');
  const [filterBankId, setFilterBankId] = useState('all');

  // Database Data
  const [ledgers, setLedgers] = useState<DBLedgerEntry[]>([]);
  const [inventoryLedger, setInventoryLedger] = useState<DBInventoryLedgerEntry[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [purchases, setPurchases] = useState<DBPurchase[]>([]);
  const [sales, setSales] = useState<DBSale[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<DBGeneralExpense[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<DBOtherIncome[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [vouchers, setVouchers] = useState<DBVoucher[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
      setLedgers(allLedgers);

      const allInv = await getAllRecords<DBInventoryLedgerEntry>('inventory_ledger');
      setInventoryLedger(allInv);

      const allItems = await getAllRecords<DBItem>('items');
      setItems(allItems);

      const allCust = await getAllRecords<DBCustomer>('customers');
      setCustomers(allCust);

      const allVend = await getAllRecords<DBVendor>('vendors');
      setVendors(allVend);

      const allVeh = await getAllRecords<DBVehicle>('vehicles');
      setVehicles(allVeh);

      const allStaff = await getAllRecords<DBStaff>('staff');
      setStaff(allStaff);

      const allTrips = await getAllRecords<DBTrip>('trips');
      setTrips(allTrips);

      const allPurchases = await getAllRecords<DBPurchase>('purchases');
      setPurchases(allPurchases);

      const allSales = await getAllRecords<DBSale>('sales');
      setSales(allSales);

      const allExp = await getAllRecords<DBGeneralExpense>('general_expenses');
      setGeneralExpenses(allExp);

      const allInc = await getAllRecords<DBOtherIncome>('other_incomes');
      setOtherIncomes(allInc);

      const allBanks = await getAllRecords<DBBank>('banks');
      setBanks(allBanks);

      const allVouchers = await getAllRecords<DBVoucher>('vouchers');
      setVouchers(allVouchers);

      const live = await calculateLiveBalances();
      setBalances(live);

      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrintReport = () => {
    window.print();
  };

  if (loading || !balances) {
    return <div className="text-center py-6">Loading reports framework...</div>;
  }

  // Common Date Filtering Helper
  const isWithinDateRange = (dateStr: string) => {
    return dateStr >= startDate && dateStr <= endDate;
  };

  // ==========================================
  // REPORT CALCULATIONS
  // ==========================================

  // 1. Sales Register Rows (POS sales & Trip dispatches)
  const salesRegisterRows: {
    date: string;
    invoiceNo: string;
    customer: string;
    item: string;
    qty: number;
    unit: string;
    rate: number;
    freight: number;
    total: number;
    payment: string;
  }[] = [];

  // Add POS Sales
  for (const s of sales) {
    const itmObj = items.find(i => i.id === s.itemId);
    if (isWithinDateRange(s.date) && (filterCustomerId === 'all' || s.customerId === filterCustomerId) && (filterItemId === 'all' || s.itemId === filterItemId) && (filterUnit === 'all' || itmObj?.unit === filterUnit)) {
      const custName = customers.find(c => c.id === s.customerId)?.name || (s.customerId === 'walk-in' ? 'Walk-in Customer' : s.customerId);
      const itemName = itmObj?.name || s.itemId;
      const itemUnit = itmObj?.unit || '';

      salesRegisterRows.push({
        date: s.date,
        invoiceNo: s.id.substring(0, 8).toUpperCase(),
        customer: custName,
        item: itemName,
        qty: s.quantity,
        unit: itemUnit,
        rate: s.rate,
        freight: 0,
        total: s.total,
        payment: s.paymentType,
      });
    }
  }

  // Add Trip material dispatches
  for (const t of trips) {
    const itmObj = items.find(i => i.id === t.itemId);
    if (isWithinDateRange(t.date) && (filterCustomerId === 'all' || t.customerId === filterCustomerId) && (filterItemId === 'all' || t.itemId === filterItemId) && (filterVehicleId === 'all' || t.vehicleId === filterVehicleId) && (filterUnit === 'all' || itmObj?.unit === filterUnit)) {
      const custName = customers.find(c => c.id === t.customerId)?.name || (t.customerId === 'walk-in' ? 'Walk-in Customer' : t.customerId);
      const itemName = itmObj?.name || t.itemId;
      const itemUnit = itmObj?.unit || '';

      salesRegisterRows.push({
        date: t.date,
        invoiceNo: t.id.substring(0, 8).toUpperCase(),
        customer: custName,
        item: itemName,
        qty: t.quantity,
        unit: itemUnit,
        rate: t.rate,
        freight: t.vehicleCharges,
        total: t.grandTotal,
        payment: t.paymentType,
      });
    }
  }

  salesRegisterRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 2. Purchase Register Rows
  const purchaseRegisterRows: {
    date: string;
    billNo: string;
    vendor: string;
    item: string;
    qty: number;
    unit: string;
    rate: number;
    total: number;
    payment: string;
  }[] = [];

  for (const p of purchases) {
    if (!isWithinDateRange(p.date)) continue;
    if (filterVendorId !== 'all' && p.vendorId !== filterVendorId) continue;
    const vendName = vendors.find(v => v.id === p.vendorId)?.name || (p.vendorId === 'walk-in-vendor' ? 'Walk-in Vendor (Spot)' : p.vendorId);

    if (p.items && p.items.length > 0) {
      for (const itm of p.items) {
        const itmObj = items.find(i => i.id === itm.itemId);
        if (filterItemId !== 'all' && itm.itemId !== filterItemId) continue;
        if (filterUnit !== 'all' && (itm.unit || itmObj?.unit) !== filterUnit) continue;

        purchaseRegisterRows.push({
          date: p.date,
          billNo: p.id.substring(0, 8).toUpperCase(),
          vendor: vendName,
          item: itm.itemName || itmObj?.name || itm.itemId,
          qty: itm.quantity,
          unit: itm.unit || itmObj?.unit || '',
          rate: itm.rate,
          total: itm.amount,
          payment: p.paymentType,
        });
      }
    } else {
      const itmObj = items.find(i => i.id === p.itemId);
      if (filterItemId !== 'all' && p.itemId !== filterItemId) continue;
      if (filterUnit !== 'all' && itmObj?.unit !== filterUnit) continue;

      purchaseRegisterRows.push({
        date: p.date,
        billNo: p.id.substring(0, 8).toUpperCase(),
        vendor: vendName,
        item: itmObj?.name || p.itemId,
        qty: p.quantity,
        unit: itmObj?.unit || '',
        rate: p.rate,
        total: p.total,
        payment: p.paymentType,
      });
    }
  }

  purchaseRegisterRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 3. Profit & Loss Report
  // Revenues: Sales Revenue + Trip Revenue + Other Income
  // Costs: Purchase Cost + Trip Expenses + General Expenses + Staff Salaries
  let plSalesRevenue = 0;
  let plTripRevenue = 0;
  let plOtherIncome = 0;
  let plPurchaseCost = 0;
  let plTripExpenses = 0;
  let plGeneralExpenses = 0;
  let plSalaryExpense = 0;

  for (const entry of ledgers) {
    if (isWithinDateRange(entry.date)) {
      if (entry.accountId === 'sales_revenue') {
        plSalesRevenue += (entry.credit - entry.debit);
      } else if (entry.accountId === 'trip_revenue') {
        plTripRevenue += (entry.credit - entry.debit);
      } else if (entry.accountId === 'other_income_revenue') {
        plOtherIncome += (entry.credit - entry.debit);
      } else if (entry.accountId === 'purchase_cost') {
        plPurchaseCost += (entry.debit - entry.credit);
      } else if (entry.accountId === 'expenses_trip') {
        plTripExpenses += (entry.debit - entry.credit);
      } else if (entry.accountId === 'expenses_general') {
        plGeneralExpenses += (entry.debit - entry.credit);
      } else if (entry.accountId === 'salary_expense') {
        plSalaryExpense += (entry.debit - entry.credit);
      }
    }
  }

  const plTotalRevenue = plSalesRevenue + plTripRevenue + plOtherIncome;
  const plTotalExpenses = plPurchaseCost + plTripExpenses + plGeneralExpenses + plSalaryExpense;
  const plNetProfit = plTotalRevenue - plTotalExpenses;

  // 4. Balance Sheet
  // Calculated live. 
  // Assets: Cash + Banks + Receivables + Stock Value + Staff Advances
  // Liabilities: Payables
  let bsCash = balances.cashBalance;
  let bsBanks = balances.totalBankBalance;
  
  let bsReceivables = 0;
  for (const cid in balances.customerBalances) {
    bsReceivables += balances.customerBalances[cid].outstanding;
  }
  
  let bsPayables = 0;
  for (const vid in balances.vendorBalances) {
    bsPayables += balances.vendorBalances[vid].outstanding;
  }

  let bsStaffAdvances = 0;
  for (const sid in balances.staffBalances) {
    bsStaffAdvances += Math.max(0, balances.staffBalances[sid].advanceLoanBalance);
  }

  // Stock value = sum(qty * purchaseRate)
  let bsStockValue = 0;
  for (const item of items) {
    const qty = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
    bsStockValue += (qty * item.purchaseRate);
  }

  const bsTotalAssets = bsCash + bsBanks + bsReceivables + bsStockValue + bsStaffAdvances;
  const bsTotalLiabilities = bsPayables;
  
  // Equity = Assets - Liabilities
  const bsEquity = bsTotalAssets - bsTotalLiabilities;

  // 5. Vehicle-Wise Profitability Matrix
  const vehicleReportRows: {
    vehicleNo: string;
    tripsCount: number;
    totalQty: number;
    kamai: number;
    expensesBreakdown: { [category: string]: number };
    totalExp: number;
    profit: number;
  }[] = [];

  const expenseCategories = [
    'Load Tax',
    'Kanta',
    'Laiki / Arai',
    'Commission',
    'Roti / Food',
    'Maintenance / Mistri',
    'Diesel',
    'Loader Diesel',
    'Munshi / Clerk',
    'Driver'
  ];

  for (const veh of vehicles) {
    const vehTrips = trips.filter(t => t.vehicleId === veh.id && isWithinDateRange(t.date));
    
    // Initialize expenses map
    const expMap: { [cat: string]: number } = {};
    for (const cat of expenseCategories) {
      expMap[cat] = 0;
    }

    let totalQty = 0;
    let totalFreight = 0;
    let totalExp = 0;

    for (const t of vehTrips) {
      totalQty += t.quantity;
      totalFreight += t.vehicleCharges;
      totalExp += t.totalExpenses;

      for (const exp of t.expenses) {
        if (expMap[exp.category] !== undefined) {
          expMap[exp.category] += exp.amount;
        } else {
          // Fallback if dynamic custom category
          expMap[exp.category] = exp.amount;
        }
      }
    }

    vehicleReportRows.push({
      vehicleNo: veh.number,
      tripsCount: vehTrips.length,
      totalQty,
      kamai: totalFreight,
      expensesBreakdown: expMap,
      totalExp,
      profit: totalFreight - totalExp,
    });
  }

  // 6. Cash Ledger (Running Book)
  const cashLedgerRows: {
    date: string;
    type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }[] = [];

  const cashEntries = ledgers.filter(l => l.accountId === 'cash');
  cashEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  let cashRunningBal = 0;
  for (const entry of cashEntries) {
    cashRunningBal += (entry.debit - entry.credit);
    if (isWithinDateRange(entry.date)) {
      let displayRef = entry.referenceId || '—';
      if (displayRef.startsWith('rcpt-') || displayRef.startsWith('vch-')) {
        const match = vouchers.find(v => v.id === entry.referenceId || v.reference === entry.referenceId);
        displayRef = match ? match.id : (entry.description.toLowerCase().includes('bank') ? 'bank-001' : 'cash-001');
      } else if (displayRef.startsWith('pymt-')) {
        const match = vouchers.find(v => v.id === entry.referenceId || v.reference === entry.referenceId);
        displayRef = match ? match.id : (entry.description.toLowerCase().includes('bank') ? 'bank-001' : 'pay-001');
      }

      cashLedgerRows.push({
        date: entry.date,
        type: entry.type.toUpperCase(),
        reference: displayRef,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit,
        balance: cashRunningBal,
      });
    }
  }
  cashLedgerRows.reverse(); // Latest first for view

  // 7. Inventory Ledger Report Rows
  const inventoryLedgerRows: {
    date: string;
    item: string;
    itemId: string;
    unit: string;
    type: string;
    reference: string;
    qtyIn: number;
    qtyOut: number;
    runningStock: number;
    rate: number;
    value: number;
    description: string;
  }[] = [];

  // Chronologically sort all inventory movements to calculate per-item running stock accurately
  const sortedInv = [...inventoryLedger].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const itemRunningBalances: Record<string, number> = {};

  for (const entry of sortedInv) {
    const itm = items.find(i => i.id === entry.itemId);
    if (!itm) continue;

    if (itemRunningBalances[entry.itemId] === undefined) {
      itemRunningBalances[entry.itemId] = 0;
    }
    itemRunningBalances[entry.itemId] += (entry.qtyIn - entry.qtyOut);

    const matchesDate = isWithinDateRange(entry.date);
    const matchesItem = filterItemId === 'all' || entry.itemId === filterItemId;
    const matchesUnit = filterUnit === 'all' || itm.unit === filterUnit;

    if (matchesDate && matchesItem && matchesUnit) {
      let displayRef = entry.referenceId || '—';
      if (displayRef.startsWith('rcpt-') || displayRef.startsWith('vch-')) {
        const match = vouchers.find(v => v.id === entry.referenceId || v.reference === entry.referenceId);
        displayRef = match ? match.id : 'cash-001';
      } else if (displayRef.startsWith('pymt-')) {
        const match = vouchers.find(v => v.id === entry.referenceId || v.reference === entry.referenceId);
        displayRef = match ? match.id : 'pay-001';
      }

      let desc = '';
      if (entry.type === 'purchase') {
        const purch = purchases.find(p => p.id === entry.referenceId);
        const vend = purch ? vendors.find(v => v.id === purch.vendorId) : null;
        desc = `Purchase from ${vend?.name || (purch?.vendorId === 'walk-in-vendor' ? 'Walk-in Vendor' : 'Supplier')}`;
      } else if (entry.type === 'sale') {
        const sl = sales.find(s => s.id === entry.referenceId);
        const cust = sl ? customers.find(c => c.id === sl.customerId) : null;
        desc = `Counter sale to ${cust?.name || (sl?.customerId === 'walk-in' ? 'Walk-in Customer' : 'Customer')}`;
      } else if (entry.type === 'trip') {
        const trp = trips.find(t => t.id === entry.referenceId);
        const cust = trp ? customers.find(c => c.id === trp.customerId) : null;
        desc = `Trip dispatch to ${cust?.name || (trp?.customerId === 'walk-in' ? 'Walk-in Customer' : 'Customer')}`;
      }

      inventoryLedgerRows.push({
        date: entry.date,
        item: itm.name,
        itemId: itm.id,
        unit: itm.unit,
        type: entry.type.toUpperCase(),
        reference: displayRef,
        qtyIn: entry.qtyIn,
        qtyOut: entry.qtyOut,
        runningStock: itemRunningBalances[entry.itemId],
        rate: entry.rate,
        value: entry.value,
        description: desc,
      });
    }
  }
  inventoryLedgerRows.reverse(); // Latest first for ledger view

  // Global search filtering helper
  const cleanSearch = searchQuery.toLowerCase().trim();

  // Filtered Sales Register
  const filteredSalesRegisterRows = salesRegisterRows.filter(row => {
    if (!cleanSearch) return true;
    const custObj = customers.find(c => c.name.toLowerCase() === row.customer.toLowerCase());
    const phone = custObj?.phone || '';
    const custId = custObj?.id || '';
    return (
      row.invoiceNo.toLowerCase().includes(cleanSearch) ||
      row.customer.toLowerCase().includes(cleanSearch) ||
      row.item.toLowerCase().includes(cleanSearch) ||
      row.date.toLowerCase().includes(cleanSearch) ||
      row.payment.toLowerCase().includes(cleanSearch) ||
      phone.toLowerCase().includes(cleanSearch) ||
      custId.toLowerCase().includes(cleanSearch)
    );
  });

  // Filtered Customer Balances
  const filteredCustomers = customers.filter(cust => {
    if (!cleanSearch) return true;
    return (
      cust.name.toLowerCase().includes(cleanSearch) ||
      cust.id.toLowerCase().includes(cleanSearch) ||
      (cust.phone && cust.phone.toLowerCase().includes(cleanSearch)) ||
      (cust.area && cust.area.toLowerCase().includes(cleanSearch))
    );
  });

  // Filtered Purchase Register
  const filteredPurchaseRegisterRows = purchaseRegisterRows.filter(row => {
    if (!cleanSearch) return true;
    const vendObj = vendors.find(v => v.name.toLowerCase() === row.vendor.toLowerCase());
    const phone = vendObj?.phone || '';
    const vendId = vendObj?.id || '';
    return (
      row.billNo.toLowerCase().includes(cleanSearch) ||
      row.vendor.toLowerCase().includes(cleanSearch) ||
      row.item.toLowerCase().includes(cleanSearch) ||
      row.date.toLowerCase().includes(cleanSearch) ||
      row.payment.toLowerCase().includes(cleanSearch) ||
      phone.toLowerCase().includes(cleanSearch) ||
      vendId.toLowerCase().includes(cleanSearch)
    );
  });

  // Filtered Vendor Balances
  const filteredVendors = vendors.filter(vend => {
    if (!cleanSearch) return true;
    return (
      vend.name.toLowerCase().includes(cleanSearch) ||
      vend.id.toLowerCase().includes(cleanSearch) ||
      (vend.phone && vend.phone.toLowerCase().includes(cleanSearch)) ||
      (vend.address && vend.address.toLowerCase().includes(cleanSearch))
    );
  });

  // Filtered Inventory Ledger Movements
  const filteredInventoryLedgerRows = inventoryLedgerRows.filter(row => {
    if (!cleanSearch) return true;
    return (
      row.item.toLowerCase().includes(cleanSearch) ||
      row.itemId.toLowerCase().includes(cleanSearch) ||
      row.unit.toLowerCase().includes(cleanSearch) ||
      row.type.toLowerCase().includes(cleanSearch) ||
      row.reference.toLowerCase().includes(cleanSearch) ||
      row.description.toLowerCase().includes(cleanSearch) ||
      row.date.toLowerCase().includes(cleanSearch)
    );
  });

  // Filtered Inventory Stock Balances
  const filteredItems = items.filter(item => {
    if (filterUnit !== 'all' && item.unit !== filterUnit) return false;
    if (filterItemId !== 'all' && item.id !== filterItemId) return false;
    if (!cleanSearch) return true;
    return (
      item.name.toLowerCase().includes(cleanSearch) ||
      item.id.toLowerCase().includes(cleanSearch) ||
      item.unit.toLowerCase().includes(cleanSearch)
    );
  });

  // Filtered Low Stock
  const filteredLowStockItems = items.filter(item => {
    if (filterUnit !== 'all' && item.unit !== filterUnit) return false;
    if (filterItemId !== 'all' && item.id !== filterItemId) return false;
    const qty = balances ? (balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock) : item.currentStock;
    if (qty > item.minStock) return false;
    if (!cleanSearch) return true;
    return (
      item.name.toLowerCase().includes(cleanSearch) ||
      item.id.toLowerCase().includes(cleanSearch) ||
      item.unit.toLowerCase().includes(cleanSearch)
    );
  });

  // Filtered Cash Ledger
  const filteredCashLedgerRows = cashLedgerRows.filter(row => {
    if (!cleanSearch) return true;
    return (
      row.date.toLowerCase().includes(cleanSearch) ||
      row.type.toLowerCase().includes(cleanSearch) ||
      row.reference.toLowerCase().includes(cleanSearch) ||
      row.description.toLowerCase().includes(cleanSearch)
    );
  });

  // Filtered Staff
  const filteredStaff = staff.filter(st => {
    if (!cleanSearch) return true;
    return (
      st.name.toLowerCase().includes(cleanSearch) ||
      st.id.toLowerCase().includes(cleanSearch) ||
      (st.designation && st.designation.toLowerCase().includes(cleanSearch)) ||
      (st.phone && st.phone.toLowerCase().includes(cleanSearch))
    );
  });

  // Filtered Vehicle Matrix
  const filteredVehicleReportRows = vehicleReportRows.filter(row => {
    if (!cleanSearch) return true;
    const vehObj = vehicles.find(v => v.number.toLowerCase() === row.vehicleNo.toLowerCase());
    return (
      row.vehicleNo.toLowerCase().includes(cleanSearch) ||
      (vehObj?.type && vehObj.type.toLowerCase().includes(cleanSearch))
    );
  });

  const standardUnits = ['KG', 'Ton', 'Trip', 'Truck', 'Piece', 'Liter'];
  const availableUnits = Array.from(new Set([...standardUnits, ...items.map(i => i.unit).filter(Boolean)]));

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Report Navigation - hidden on print */}
      <div className="w-full lg:w-64 bg-white rounded-lg shadow-sm border border-slate-100 p-4 space-y-4 no-print shrink-0">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reports Modules</h3>
        
        {/* Module selection Tabs */}
        <div className="space-y-1">
          <button
            onClick={() => { setActiveTab('sales'); setActiveReport('sales-summary'); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'sales' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Sales Reports
          </button>
          <button
            onClick={() => { setActiveTab('purchases'); setActiveReport('purchase-register'); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'purchases' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Purchase Reports
          </button>
          <button
            onClick={() => { setActiveTab('inventory'); setActiveReport('inventory-ledger'); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'inventory' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Inventory Reports
          </button>
          <button
            onClick={() => { setActiveTab('financial'); setActiveReport('profit-loss'); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'financial' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Financial Reports
          </button>
          <button
            onClick={() => { setActiveTab('salary'); setActiveReport('staff-salaries'); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'salary' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Salary Reports
          </button>
          <button
            onClick={() => { setActiveTab('transport'); setActiveReport('vehicle-profitability'); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'transport' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Transport Reports
          </button>
        </div>

        <hr className="border-slate-100" />
        
        {/* Specific report lists based on active module tab */}
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Reports</h3>
        <div className="space-y-1">
          {activeTab === 'sales' && (
            <>
              <button
                onClick={() => setActiveReport('sales-summary')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'sales-summary' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Sales Summary & Register
              </button>
              <button
                onClick={() => setActiveReport('customer-balances')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'customer-balances' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Customer Outstanding Balances
              </button>
            </>
          )}

          {activeTab === 'purchases' && (
            <>
              <button
                onClick={() => setActiveReport('purchase-register')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'purchase-register' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Purchase Register
              </button>
              <button
                onClick={() => setActiveReport('vendor-balances')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'vendor-balances' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Vendor Balances Report
              </button>
            </>
          )}

          {activeTab === 'inventory' && (
            <>
              <button
                onClick={() => setActiveReport('inventory-ledger')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'inventory-ledger' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Inventory Movement Ledger
              </button>
              <button
                onClick={() => setActiveReport('inventory-balances')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'inventory-balances' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Inventory Stock Balances
              </button>
              <button
                onClick={() => setActiveReport('low-stock')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'low-stock' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Low Stock Alert Report
              </button>
            </>
          )}

          {activeTab === 'financial' && (
            <>
              <button
                onClick={() => setActiveReport('profit-loss')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'profit-loss' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Profit & Loss Account
              </button>
              <button
                onClick={() => setActiveReport('balance-sheet')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'balance-sheet' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Balance Sheet Statement
              </button>
              <button
                onClick={() => setActiveReport('cash-ledger')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'cash-ledger' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Cash General Ledger
              </button>
            </>
          )}

          {activeTab === 'salary' && (
            <>
              <button
                onClick={() => setActiveReport('staff-salaries')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'staff-salaries' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Salary Staff Report
              </button>
              <button
                onClick={() => setActiveReport('staff-loans')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'staff-loans' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Staff Loans & Advances
              </button>
            </>
          )}

          {activeTab === 'transport' && (
            <>
              <button
                onClick={() => setActiveReport('vehicle-profitability')}
                className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition ${activeReport === 'vehicle-profitability' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Vehicle Profitability Matrix
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Report Workspace Area */}
      <div className="flex-1 space-y-6">
        {/* Date Filter & Control Bar - hidden on print */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />

            {/* Functional Search Bar */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-7 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 absolute right-2 top-2 p-0.5 rounded"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Unit Filter */}
            <div className="flex items-center space-x-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Unit:</span>
              <select
                value={filterUnit}
                onChange={e => setFilterUnit(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="all">All Units ({availableUnits.length})</option>
                {availableUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Material Filter */}
            <div className="flex items-center space-x-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Material:</span>
              <select
                value={filterItemId}
                onChange={e => setFilterItemId(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white max-w-[150px]"
              >
                <option value="all">All Materials</option>
                {items.filter(i => filterUnit === 'all' || i.unit === filterUnit).map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            {(filterUnit !== 'all' || filterItemId !== 'all') && (
              <button
                type="button"
                onClick={() => { setFilterUnit('all'); setFilterItemId('all'); }}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 underline whitespace-nowrap"
              >
                Reset Filters
              </button>
            )}
          </div>

          <button
            onClick={handlePrintReport}
            className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex-shrink-0"
          >
            <Printer className="h-4 w-4" />
            <span>Print Ledger</span>
          </button>
        </div>

        {/* Printable Report Canvas */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 print-a4 print-container space-y-6">
          {/* Printable Document Header */}
          <div className="hidden print:block text-center border-b-2 border-slate-300 pb-4 mb-6">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">
              {activeReport.replace('-', ' ').toUpperCase()}
            </h3>
            <p className="text-xs font-mono font-bold text-slate-700 mt-2">Period: {startDate} to {endDate} | Printed: {new Date().toLocaleDateString('en-GB')}</p>
          </div>

          {/* ======================================================== */}
          {/* SALES REGISTER REPORT */}
          {/* ======================================================== */}
          {activeReport === 'sales-summary' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Sales Summary Register</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Invoice No</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Material Item</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Freight Charges</th>
                      <th className="px-4 py-3 text-right">Grand Total</th>
                      <th className="px-4 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSalesRegisterRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{row.invoiceNo}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.customer}</td>
                        <td className="px-4 py-3 text-slate-600">{row.item}</td>
                        <td className="px-4 py-3 text-right font-semibold">{row.qty} {row.unit}</td>
                        <td className="px-4 py-3 text-right">Rs. {row.freight.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">Rs. {row.total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-semibold uppercase">{row.payment}</td>
                      </tr>
                    ))}
                    {filteredSalesRegisterRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching sales found for "${searchQuery}".` : 'No sales logged in this period.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredSalesRegisterRows.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-black">Filtered Sales Total ({filteredSalesRegisterRows.length} entries):</td>
                        <td className="px-4 py-3 text-right text-indigo-300 font-black">
                          {filteredSalesRegisterRows.reduce((sum, r) => sum + r.qty, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-300">
                          Rs. {filteredSalesRegisterRows.reduce((sum, r) => sum + r.freight, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-300 font-black">
                          Rs. {filteredSalesRegisterRows.reduce((sum, r) => sum + r.total, 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CUSTOMER OUTSTANDING BALANCES */}
          {/* ======================================================== */}
          {activeReport === 'customer-balances' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Customer Balances Ledger Report</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-3">Customer Name</th>
                      <th className="px-6 py-3 text-right">Total Billing Sales</th>
                      <th className="px-6 py-3 text-right">Total Payments Received</th>
                      <th className="px-6 py-3 text-right">Outstanding Debit (Receivable)</th>
                      <th className="px-6 py-3 text-right">Outstanding Credit (Advance)</th>
                      <th className="px-6 py-3 text-right">Net Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map(cust => {
                      const bal = balances.customerBalances[cust.id] || {
                        outstanding: 0,
                        advance: 0,
                        totalSales: 0,
                        totalReceived: 0,
                        netBalance: 0,
                      };

                      return (
                        <tr key={cust.id}>
                          <td className="px-6 py-3 font-semibold text-slate-700">{cust.name}</td>
                          <td className="px-6 py-3 text-right">Rs. {bal.totalSales.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-emerald-600 font-medium">Rs. {bal.totalReceived.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-rose-600 font-bold">
                            {bal.outstanding > 0 ? `Rs. ${bal.outstanding.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-3 text-right text-indigo-600 font-bold">
                            {bal.advance > 0 ? `Rs. ${bal.advance.toLocaleString()}` : '—'}
                          </td>
                          <td className={`px-6 py-3 text-right font-black ${bal.netBalance >= 0 ? 'text-slate-800' : 'text-indigo-700'}`}>
                            Rs. {Math.abs(bal.netBalance).toLocaleString()} {bal.netBalance >= 0 ? 'Dr' : 'Cr'}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching customers found for "${searchQuery}".` : 'No customer balance records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredCustomers.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                      <tr>
                        <td className="px-6 py-3 font-black">Grand Totals ({filteredCustomers.length} Customers):</td>
                        <td className="px-6 py-3 text-right text-indigo-300">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances.customerBalances[c.id]?.totalSales || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-emerald-300">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances.customerBalances[c.id]?.totalReceived || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-rose-300 font-black">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances.customerBalances[c.id]?.outstanding || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-indigo-300 font-black">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances.customerBalances[c.id]?.advance || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-emerald-300 font-black">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances.customerBalances[c.id]?.netBalance || 0), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PURCHASE REGISTER REPORT */}
          {/* ======================================================== */}
          {activeReport === 'purchase-register' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Purchases Register</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Bill No</th>
                      <th className="px-4 py-3">Supplier Vendor</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Purchase Rate</th>
                      <th className="px-4 py-3 text-right">Grand Total</th>
                      <th className="px-4 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPurchaseRegisterRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{row.billNo}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.vendor}</td>
                        <td className="px-4 py-3 text-slate-600">{row.item}</td>
                        <td className="px-4 py-3 text-right font-semibold">{row.qty} {row.unit}</td>
                        <td className="px-4 py-3 text-right">Rs. {row.rate.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">Rs. {row.total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-semibold uppercase">{row.payment}</td>
                      </tr>
                    ))}
                    {filteredPurchaseRegisterRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching purchases found for "${searchQuery}".` : 'No purchases recorded in this period.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredPurchaseRegisterRows.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-black">Filtered Purchases Total ({filteredPurchaseRegisterRows.length} entries):</td>
                        <td className="px-4 py-3 text-right text-indigo-300 font-black">
                          {filteredPurchaseRegisterRows.reduce((sum, r) => sum + r.qty, 0).toLocaleString()}
                        </td>
                        <td></td>
                        <td className="px-4 py-3 text-right text-emerald-300 font-black">
                          Rs. {filteredPurchaseRegisterRows.reduce((sum, r) => sum + r.total, 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VENDOR BALANCES REPORT */}
          {/* ======================================================== */}
          {activeReport === 'vendor-balances' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Vendor Balances Ledger Report</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-3">Vendor Supplier</th>
                      <th className="px-6 py-3 text-right">Total Purchases Bill</th>
                      <th className="px-6 py-3 text-right">Total Payments Disbursed</th>
                      <th className="px-6 py-3 text-right">Outstanding Credit (Payable)</th>
                      <th className="px-6 py-3 text-right">Outstanding Debit (Advance)</th>
                      <th className="px-6 py-3 text-right">Net Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVendors.map(vend => {
                      const bal = balances.vendorBalances[vend.id] || {
                        outstanding: 0,
                        advance: 0,
                        totalPurchases: 0,
                        totalPaid: 0,
                        netBalance: 0,
                      };

                      return (
                        <tr key={vend.id}>
                          <td className="px-6 py-3 font-semibold text-slate-700">{vend.name}</td>
                          <td className="px-6 py-3 text-right">Rs. {bal.totalPurchases.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-emerald-600 font-medium">Rs. {bal.totalPaid.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-rose-600 font-bold">
                            {bal.outstanding > 0 ? `Rs. ${bal.outstanding.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-3 text-right text-indigo-600 font-bold">
                            {bal.advance > 0 ? `Rs. ${bal.advance.toLocaleString()}` : '—'}
                          </td>
                          <td className={`px-6 py-3 text-right font-black ${bal.netBalance >= 0 ? 'text-slate-800' : 'text-indigo-700'}`}>
                            Rs. {Math.abs(bal.netBalance).toLocaleString()} {bal.netBalance >= 0 ? 'Cr' : 'Dr'}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredVendors.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching vendors found for "${searchQuery}".` : 'No vendor balance records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredVendors.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                      <tr>
                        <td className="px-6 py-3 font-black">Grand Totals ({filteredVendors.length} Vendors):</td>
                        <td className="px-6 py-3 text-right text-indigo-300">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances.vendorBalances[v.id]?.totalPurchases || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-emerald-300">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances.vendorBalances[v.id]?.totalPaid || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-rose-300 font-black">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances.vendorBalances[v.id]?.outstanding || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-indigo-300 font-black">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances.vendorBalances[v.id]?.advance || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-emerald-300 font-black">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances.vendorBalances[v.id]?.netBalance || 0), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* INVENTORY MOVEMENT LEDGER REPORT */}
          {/* ======================================================== */}
          {activeReport === 'inventory-ledger' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Inventory Movement Ledger</h3>
                  <p className="text-xs text-slate-500">Itemized chronological movements (Purchases In, Sales/Trips Out, and Stock Adjustments)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                    Unit: {filterUnit === 'all' ? 'All Units' : filterUnit}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
                    {filteredInventoryLedgerRows.length} Movements
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Material Item</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Movement Type</th>
                      <th className="px-4 py-3">Reference / Slip</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">In (+)</th>
                      <th className="px-4 py-3 text-right">Out (-)</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Value (Rs.)</th>
                      <th className="px-4 py-3 text-right">Running Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventoryLedgerRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.item}</td>
                        <td className="px-4 py-3 font-medium text-slate-500">
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                            {row.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.type === 'PURCHASE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            row.type === 'SALE' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            row.type === 'TRIP' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.reference}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{row.description || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {row.qtyIn > 0 ? `+${row.qtyIn.toLocaleString()} ${row.unit}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600">
                          {row.qtyOut > 0 ? `-${row.qtyOut.toLocaleString()} ${row.unit}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 font-mono">
                          {row.rate > 0 ? `Rs. ${row.rate.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          Rs. {row.value.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 font-mono">
                          {row.runningStock.toLocaleString()} {row.unit}
                        </td>
                      </tr>
                    ))}
                    {filteredInventoryLedgerRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-slate-400">
                          {searchQuery || filterUnit !== 'all' || filterItemId !== 'all'
                            ? `No inventory movements found matching the active filters.`
                            : 'No inventory movements recorded in selected date range.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredInventoryLedgerRows.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right font-black">
                          Total Movement Summary:
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-300 font-black">
                          +{filteredInventoryLedgerRows.reduce((sum, r) => sum + r.qtyIn, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-300 font-black">
                          -{filteredInventoryLedgerRows.reduce((sum, r) => sum + r.qtyOut, 0).toLocaleString()}
                        </td>
                        <td></td>
                        <td className="px-4 py-3 text-right text-indigo-300 font-black">
                          Rs. {filteredInventoryLedgerRows.reduce((sum, r) => sum + r.value, 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* INVENTORY BALANCES REPORT */}
          {/* ======================================================== */}
          {activeReport === 'inventory-balances' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Material Inventory Stock Balances</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-3">Material Name</th>
                      <th className="px-6 py-3 font-semibold">Unit</th>
                      <th className="px-6 py-3 text-right">Purchase Rate</th>
                      <th className="px-6 py-3 text-right">Sale Rate</th>
                      <th className="px-6 py-3 text-right">Min Stock Limit</th>
                      <th className="px-6 py-3 text-right">Current Available Stock</th>
                      <th className="px-6 py-3 text-right">Stock Valuation Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map(item => {
                      const qty = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
                      const valuation = qty * item.purchaseRate;

                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-3 font-semibold text-slate-700">{item.name}</td>
                          <td className="px-6 py-3 font-medium text-slate-500">{item.unit}</td>
                          <td className="px-6 py-3 text-right">Rs. {item.purchaseRate.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-emerald-600">Rs. {item.saleRate.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-slate-500">{item.minStock}</td>
                          <td className={`px-6 py-3 text-right font-bold ${qty <= item.minStock ? 'text-rose-600' : 'text-slate-800'}`}>
                            {qty.toLocaleString()} {item.unit}
                          </td>
                          <td className="px-6 py-3 text-right font-black text-slate-800">Rs. {valuation.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching inventory items found for "${searchQuery}".` : 'No inventory items recorded.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredItems.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                      <tr>
                        <td colSpan={5} className="px-6 py-3 font-black">Filtered Inventory Total ({filteredItems.length} Materials):</td>
                        <td className="px-6 py-3 text-right text-emerald-300 font-black">
                          {filteredItems.reduce((sum, item) => sum + (balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock), 0).toLocaleString()} Units
                        </td>
                        <td className="px-6 py-3 text-right text-indigo-300 font-black">
                          Rs. {filteredItems.reduce((sum, item) => {
                            const qty = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
                            return sum + (qty * item.purchaseRate);
                          }, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* LOW STOCK REPORT */}
          {/* ======================================================== */}
          {activeReport === 'low-stock' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Low Stock Items Alert Log</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-3">Material Name</th>
                      <th className="px-6 py-3">Unit</th>
                      <th className="px-6 py-3 text-right">Reorder Threshold</th>
                      <th className="px-6 py-3 text-right">Current Available Stock</th>
                      <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLowStockItems.map(item => {
                      const qty = balances.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;

                      return (
                        <tr key={item.id} className="bg-rose-50/20">
                          <td className="px-6 py-3 font-semibold text-slate-700">{item.name}</td>
                          <td className="px-6 py-3 text-slate-500">{item.unit}</td>
                          <td className="px-6 py-3 text-right text-slate-600 font-medium">{item.minStock}</td>
                          <td className="px-6 py-3 text-right font-bold text-rose-600">{qty}</td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                              Needs Reorder
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredLowStockItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No low stock items match "${searchQuery}".` : 'All materials maintain adequate stock levels.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PROFIT & LOSS ACCOUNT */}
          {/* ======================================================== */}
          {activeReport === 'profit-loss' && (
            <div className="space-y-6 max-w-xl mx-auto border border-slate-100 rounded-lg p-6 bg-slate-50">
              <h3 className="text-center font-black text-slate-800 text-lg border-b pb-3 border-slate-200 uppercase">Statement of Income & Profit</h3>
              
              <div className="space-y-4">
                {/* Revenues */}
                <div>
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-1 uppercase tracking-wider text-indigo-700">Operating Revenue</h4>
                  <div className="space-y-2 text-sm mt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Material Sales Revenue (POS & Trips):</span>
                      <span className="font-medium">Rs. {plSalesRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vehicle Logistics Income (Freight):</span>
                      <span className="font-medium">Rs. {plTripRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Other Business Income (Kanta, commission etc):</span>
                      <span className="font-medium">Rs. {plOtherIncome.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-700 border-t border-slate-200 pt-1">
                      <span>Total Revenue:</span>
                      <span>Rs. {plTotalRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Operating Expenses */}
                <div>
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-1 uppercase tracking-wider text-rose-700">Operating Expenses & Cost of Sales</h4>
                  <div className="space-y-2 text-sm mt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Material Cost of Goods (Purchases):</span>
                      <span className="font-medium">Rs. {plPurchaseCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vehicle Trip Expenses (Fuel, kanta, driver slip):</span>
                      <span className="font-medium">Rs. {plTripExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">General & Administrative Expenses:</span>
                      <span className="font-medium">Rs. {plGeneralExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Staff Salaries & Payout Expenses:</span>
                      <span className="font-medium">Rs. {plSalaryExpense.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-700 border-t border-slate-200 pt-1">
                      <span>Total Operating Costs:</span>
                      <span>Rs. {plTotalExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Net Income */}
                <div className={`p-4 rounded-lg flex justify-between items-baseline font-black ${plNetProfit >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                  <span className="text-sm uppercase tracking-wider">Net Operating Profit:</span>
                  <span className="text-xl">Rs. {plNetProfit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BALANCE SHEET */}
          {/* ======================================================== */}
          {activeReport === 'balance-sheet' && (
            <div className="space-y-6 max-w-2xl mx-auto border border-slate-100 rounded-lg p-6 bg-slate-50">
              <h3 className="text-center font-black text-slate-800 text-lg border-b pb-3 border-slate-200 uppercase">Balance Sheet</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                {/* Assets */}
                <div className="space-y-4">
                  <h4 className="font-bold border-b border-slate-200 pb-1 uppercase tracking-wider text-indigo-700">Assets (Current Assets)</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cash in Hand:</span>
                      <span className="font-medium">Rs. {bsCash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bank Balances:</span>
                      <span className="font-medium">Rs. {bsBanks.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer Outstanding Receivables:</span>
                      <span className="font-medium">Rs. {bsReceivables.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Inventory Stock Valuation (Cost):</span>
                      <span className="font-medium">Rs. {bsStockValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Staff Loan & Advance Assets:</span>
                      <span className="font-medium">Rs. {bsStaffAdvances.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-black text-slate-800 border-t border-slate-200 pt-2 text-base">
                      <span>Total Assets:</span>
                      <span>Rs. {bsTotalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold border-b border-slate-200 pb-1 uppercase tracking-wider text-rose-700">Liabilities</h4>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Vendor Supplier Outstanding Payables:</span>
                        <span className="font-medium">Rs. {bsPayables.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-700 border-t border-slate-200 pt-1">
                        <span>Total Liabilities:</span>
                        <span>Rs. {bsTotalLiabilities.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold border-b border-slate-200 pb-1 uppercase tracking-wider text-slate-700">Owner's Equity</h4>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Accumulated Retained Earnings (Profit):</span>
                        <span className="font-medium">Rs. {bsEquity.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-700 border-t border-slate-200 pt-1">
                        <span>Total Equity:</span>
                        <span>Rs. {bsEquity.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-300 pt-3">
                    <div className="flex justify-between font-black text-slate-800 text-base">
                      <span>Total Liabilities & Equity:</span>
                      <span>Rs. {(bsTotalLiabilities + bsEquity).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {bsTotalAssets === (bsTotalLiabilities + bsEquity) ? (
                <p className="text-[10px] text-emerald-600 font-bold text-center mt-4">✓ Balance sheet accounts match and align perfectly.</p>
              ) : (
                <p className="text-[10px] text-rose-600 font-bold text-center mt-4">⚠️ Balance sheet discrepancy detected in capital configuration.</p>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* CASH LEDGER REPORT */}
          {/* ======================================================== */}
          {activeReport === 'cash-ledger' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Cash General Ledger Statement</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Description Details</th>
                      <th className="px-4 py-3 text-right">Debit (In)</th>
                      <th className="px-4 py-3 text-right">Credit (Out)</th>
                      <th className="px-4 py-3 text-right">Running Cash Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCashLedgerRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3 font-semibold text-xs text-indigo-600 uppercase">{row.type}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.reference}</td>
                        <td className="px-4 py-3 text-slate-700">{row.description}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                          {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-600 font-semibold">
                          {row.credit > 0 ? `Rs. ${row.credit.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">Rs. {row.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                    {filteredCashLedgerRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching cash transactions found for "${searchQuery}".` : 'No cash transactions in this date range.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SALARY STAFF REPORT */}
          {/* ======================================================== */}
          {activeReport === 'staff-salaries' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Salary Staff Report</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-3">Employee Name</th>
                      <th className="px-6 py-3">Designation</th>
                      <th className="px-6 py-3 text-right">Base Basic Salary</th>
                      <th className="px-6 py-3 text-right">Total Salary Paid (Period)</th>
                      <th className="px-6 py-3 text-right">Advance Debt Adjusted</th>
                      <th className="px-6 py-3 text-right">Actual Paid (Cash/Bank)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map(st => {
                      // Filter salary payments for this staff member in date range
                      const stSalaryPayments = ledgers.filter(l => 
                        l.accountId === 'salary_expense' && 
                        l.description.includes(`staff: ID ${st.id}`) &&
                        isWithinDateRange(l.date)
                      );
                      
                      // Calculate values from ledger or staff payments table
                      const totalGross = stSalaryPayments.reduce((sum, p) => sum + p.debit, 0);
                      
                      // Find direct staff payment slips to pull advanceAdjusted
                      const paymentSlips = ledgers.filter(l => l.accountId === st.id && l.type === 'salary_payment' && isWithinDateRange(l.date));
                      const totalAdvAdjusted = paymentSlips.reduce((sum, p) => sum + p.credit, 0);
                      const netPaid = totalGross - totalAdvAdjusted;

                      return (
                        <tr key={st.id}>
                          <td className="px-6 py-3 font-semibold text-slate-700">{st.name}</td>
                          <td className="px-6 py-3 text-slate-500">{st.designation || 'Staff'}</td>
                          <td className="px-6 py-3 text-right">Rs. {st.basicSalary.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right font-medium">Rs. {totalGross.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-indigo-600 font-semibold">
                            {totalAdvAdjusted > 0 ? `Rs. ${totalAdvAdjusted.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-3 text-right font-black text-slate-800">Rs. {netPaid.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching staff members found for "${searchQuery}".` : 'No staff records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAFF LOANS & ADVANCES */}
          {/* ======================================================== */}
          {activeReport === 'staff-loans' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 no-print">Staff Loan & Advance Outstanding Balances</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-6 py-3">Employee Name</th>
                      <th className="px-6 py-3 font-semibold">Designation</th>
                      <th className="px-6 py-3 text-right">Opening Advances Given</th>
                      <th className="px-6 py-3 text-right">Total Advance Adjusted</th>
                      <th className="px-6 py-3 text-right">Current Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map(st => {
                      const loanBal = balances.staffBalances[st.id]?.advanceLoanBalance || 0;
                      
                      // Calculate advances and adjustments in period
                      const advancesGiven = ledgers
                        .filter(l => l.accountId === st.id && l.debit > 0 && isWithinDateRange(l.date))
                        .reduce((sum, l) => sum + l.debit, 0);

                      const advancesAdjusted = ledgers
                        .filter(l => l.accountId === st.id && l.credit > 0 && isWithinDateRange(l.date))
                        .reduce((sum, l) => sum + l.credit, 0);

                      return (
                        <tr key={st.id}>
                          <td className="px-6 py-3 font-semibold text-slate-700">{st.name}</td>
                          <td className="px-6 py-3 text-slate-500">{st.designation || 'Staff'}</td>
                          <td className="px-6 py-3 text-right text-amber-600 font-medium">Rs. {advancesGiven.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-emerald-600 font-medium">Rs. {advancesAdjusted.toLocaleString()}</td>
                          <td className={`px-6 py-3 text-right font-black ${loanBal > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            Rs. {loanBal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching staff members found for "${searchQuery}".` : 'No staff loan records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VEHICLE-WISE DETAILED PROFITABILITY (FREIGHT MATRIX) */}
          {/* ======================================================== */}
          {activeReport === 'vehicle-profitability' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-lg font-black text-slate-800 no-print">Vehicle-Wise Income & detailed Expenses Matrix</h3>
                <span className="text-xs text-slate-400 no-print">Horizontal Scroll enabled for full categories audit</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs table-fixed">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b-2 border-slate-200">
                    <tr>
                      <th className="px-2 py-3 w-28 whitespace-nowrap bg-slate-100 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Vehicle No</th>
                      <th className="px-2 py-3 w-16 text-right">Trips</th>
                      <th className="px-2 py-3 w-24 text-right">Tot Qty</th>
                      <th className="px-2 py-3 w-28 text-right bg-emerald-50 text-emerald-800 font-extrabold">Vehicle Charges</th>
                      
                      {/* Detailed expense columns */}
                      {expenseCategories.map(cat => (
                        <th key={cat} className="px-2 py-3 w-24 text-right whitespace-nowrap font-medium text-slate-600">{cat}</th>
                      ))}
                      
                      <th className="px-2 py-3 w-28 text-right bg-rose-50 text-rose-800 font-extrabold">Total Exp</th>
                      <th className="px-2 py-3 w-28 text-right bg-indigo-50 text-indigo-800 font-black">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredVehicleReportRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-2 py-3 font-bold text-slate-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] whitespace-nowrap">
                          {row.vehicleNo}
                        </td>
                        <td className="px-2 py-3 text-right font-medium text-slate-500">{row.tripsCount}</td>
                        <td className="px-2 py-3 text-right text-slate-600 font-semibold">{row.totalQty.toLocaleString()}</td>
                        <td className="px-2 py-3 text-right font-extrabold bg-emerald-50/30 text-emerald-700">Rs. {row.kamai.toLocaleString()}</td>
                        
                        {/* Expense columns */}
                        {expenseCategories.map(cat => {
                          const amt = row.expensesBreakdown[cat] || 0;
                          return (
                            <td key={cat} className="px-2 py-3 text-right text-slate-500 font-medium">
                              {amt > 0 ? `Rs. ${amt.toLocaleString()}` : '—'}
                            </td>
                          );
                        })}

                        <td className="px-2 py-3 text-right font-extrabold bg-rose-50/30 text-rose-700">Rs. {row.totalExp.toLocaleString()}</td>
                        <td className={`px-2 py-3 text-right font-black bg-indigo-50/30 ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          Rs. {row.profit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {filteredVehicleReportRows.length === 0 && (
                      <tr>
                        <td colSpan={17} className="text-center py-8 text-slate-400">
                          {searchQuery ? `No matching vehicles found for "${searchQuery}".` : 'No vehicles logged.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredVehicleReportRows.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs font-mono">
                      <tr>
                        <td className="px-2 py-3 font-black bg-slate-900 sticky left-0 z-10">Filtered Totals ({filteredVehicleReportRows.length}):</td>
                        <td className="px-2 py-3 text-right text-indigo-300">
                          {filteredVehicleReportRows.reduce((sum, r) => sum + r.tripsCount, 0)}
                        </td>
                        <td className="px-2 py-3 text-right text-indigo-300">
                          {filteredVehicleReportRows.reduce((sum, r) => sum + r.totalQty, 0).toLocaleString()}
                        </td>
                        <td className="px-2 py-3 text-right text-emerald-300 font-black">
                          Rs. {filteredVehicleReportRows.reduce((sum, r) => sum + r.kamai, 0).toLocaleString()}
                        </td>
                        <td colSpan={expenseCategories.length}></td>
                        <td className="px-2 py-3 text-right text-rose-300 font-black">
                          Rs. {filteredVehicleReportRows.reduce((sum, r) => sum + r.totalExp, 0).toLocaleString()}
                        </td>
                        <td className="px-2 py-3 text-right text-emerald-300 font-black">
                          Rs. {filteredVehicleReportRows.reduce((sum, r) => sum + r.profit, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
          
          {/* Centered printing footer */}
          <div className="print-footer text-center">
            Software by Roonjha Developer - 03152914836
          </div>
        </div>
      </div>
    </div>
  );
}
