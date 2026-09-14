import React, { useEffect, useState } from 'react';
import { 
  getAllRecords, 
  putRecord, 
  deleteRecord, 
  DBDirectPurchase, 
  DBVendor, 
  DBVehicle, 
  DBBank, 
  DBDirectPurchaseCategory 
} from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveDirectPurchaseTransaction, deleteDirectPurchaseTransaction } from '../db/transactions';
import { 
  ShoppingCart, Plus, Trash, Edit, Printer, Download, Search, X, 
  Building2, Truck, Wallet, CheckCircle, Calendar, Filter, FileText, AlertCircle
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

export default function DirectPurchases() {
  const [purchases, setPurchases] = useState<DBDirectPurchase[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [categories, setCategories] = useState<DBDirectPurchaseCategory[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal & Print
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activePrintJob, setActivePrintJob] = useState<{ type: 'thermal' | 'a4'; data: DBDirectPurchase } | null>(null);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorId, setVendorId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [category, setCategory] = useState('Diesel / Fuel');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('Litres');
  const [rate, setRate] = useState<number | ''>('');
  const [total, setTotal] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isPaidTouched, setIsPaidTouched] = useState(false);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit'>('Cash');
  const [bankId, setBankId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [notes, setNotes] = useState('');

  const defaultCategories = [
    'Diesel / Fuel',
    'Vehicle Maintenance & Spare Parts',
    'Tyres & Tubes',
    'Workshop & Repair Services',
    'Site Electricity & Utilities',
    'Quarry Machinery Consumables',
    'Office & Admin Expenses',
    'Safety & PPE Equipment',
    'Other Direct Expense'
  ];

  const loadData = async () => {
    try {
      const [allPurchases, allVendors, allVehicles, allBanks, allCats] = await Promise.all([
        getAllRecords<DBDirectPurchase>('direct_purchases'),
        getAllRecords<DBVendor>('vendors'),
        getAllRecords<DBVehicle>('vehicles'),
        getAllRecords<DBBank>('banks'),
        getAllRecords<DBDirectPurchaseCategory>('direct_purchase_categories')
      ]);

      allPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPurchases(allPurchases);
      setVendors(allVendors);
      setVehicles(allVehicles);
      setBanks(allBanks);
      if (allBanks.length > 0 && !bankId) setBankId(allBanks[0].id);
      setCategories(allCats);

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      setLoading(false);
    } catch (err) {
      console.error('Error loading direct purchases:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto calculate total when quantity and rate change
  const handleQtyRateChange = (newQty: number | '', newRate: number | '') => {
    setQuantity(newQty);
    setRate(newRate);
    if (typeof newQty === 'number' && typeof newRate === 'number' && newQty > 0 && newRate > 0) {
      const calcTotal = Math.round(newQty * newRate);
      setTotal(calcTotal);
      if (!isPaidTouched) {
        if (paymentType === 'Cash' || paymentType === 'Bank') setPaidAmount(calcTotal);
      }
    }
  };

  const handleOpenForm = (dp?: DBDirectPurchase) => {
    if (dp) {
      setEditingId(dp.id);
      setDate(dp.date);
      setVendorId(dp.vendorId || '');
      setInvoiceNo(dp.invoiceNo || '');
      setCategory(dp.category || 'Diesel / Fuel');
      setDescription(dp.description || '');
      setQuantity(dp.quantity !== undefined ? dp.quantity : '');
      setUnit(dp.unit || 'Litres');
      setRate(dp.rate !== undefined ? dp.rate : '');
      setTotal(dp.total || 0);
      setPaidAmount(dp.paidAmount !== undefined ? dp.paidAmount : (dp.paymentType === 'Credit' ? 0 : dp.total));
      setIsPaidTouched(true);
      setPaymentType(dp.paymentType || 'Cash');
      setBankId(dp.bankId || (banks.length > 0 ? banks[0].id : ''));
      setVehicleId(dp.vehicleId || '');
      setNotes(dp.notes || '');
    } else {
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setVendorId('');
      setInvoiceNo('');
      setCategory('Diesel / Fuel');
      setDescription('');
      setQuantity('');
      setUnit('Litres');
      setRate('');
      setTotal(0);
      setPaidAmount(0);
      setIsPaidTouched(false);
      setPaymentType('Cash');
      setBankId(banks.length > 0 ? banks[0].id : '');
      setVehicleId('');
      setNotes('');
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      alert('Please select a vendor / supplier.');
      return;
    }
    if (total <= 0) {
      alert('Total amount must be greater than 0.');
      return;
    }

    let dpId = editingId;
    if (!dpId) {
      const prefix = 'dp-';
      const existingIds = purchases.map(p => p.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
      dpId = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }

    const vendor = vendors.find(v => v.id === vendorId);

    const directPurchase: DBDirectPurchase = {
      id: dpId,
      date,
      vendorId,
      vendorName: vendor ? vendor.name : vendorId,
      invoiceNo: invoiceNo.trim() || undefined,
      category,
      description: description.trim() || category,
      quantity: quantity !== '' ? Number(quantity) : undefined,
      unit: unit.trim() || undefined,
      rate: rate !== '' ? Number(rate) : undefined,
      total: Number(total),
      paidAmount: Number(paidAmount) || 0,
      remainingBalance: Math.max(0, Number(total) - (Number(paidAmount) || 0)),
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      vehicleId: vehicleId.trim() || undefined,
      notes: notes.trim() || undefined
    };

    try {
      await saveDirectPurchaseTransaction(directPurchase);
      setIsFormOpen(false);
      await loadData();
      if (confirm('Print Direct Expense / Purchase Slip?')) {
        setActivePrintJob({ type: 'thermal', data: directPurchase });
        setTimeout(() => {
          window.print();
          setActivePrintJob(null);
        }, 150);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to save direct purchase: ' + (err?.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this direct purchase voucher? All financial ledger entries will be reversed.')) {
      await deleteDirectPurchaseTransaction(id);
      loadData();
    }
  };

  // Filtered purchases
  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredPurchases = purchases.filter(p => {
    if (startDate && p.date < startDate) return false;
    if (endDate && p.date > endDate) return false;
    if (selectedVendorId && p.vendorId !== selectedVendorId) return false;
    if (selectedCategory && p.category !== selectedCategory) return false;

    if (!cleanSearch) return true;
    const v = vendors.find(ven => ven.id === p.vendorId);
    const veh = vehicles.find(veh => veh.id === p.vehicleId);

    return (
      p.id.toLowerCase().includes(cleanSearch) ||
      p.date.includes(cleanSearch) ||
      (p.invoiceNo && p.invoiceNo.toLowerCase().includes(cleanSearch)) ||
      (p.category && p.category.toLowerCase().includes(cleanSearch)) ||
      (p.description && p.description.toLowerCase().includes(cleanSearch)) ||
      (v && v.name.toLowerCase().includes(cleanSearch)) ||
      (veh && veh.number.toLowerCase().includes(cleanSearch))
    );
  });

  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalFilteredAmount = filteredPurchases.reduce((s, p) => s + (p.total || 0), 0);
  const totalFilteredPaid = filteredPurchases.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const totalFilteredUnpaid = filteredPurchases.reduce((s, p) => s + (p.remainingBalance || 0), 0);

  const selectedVendor = vendors.find(v => v.id === vendorId);
  const vendorBal = vendorId && balances?.vendorBalances[vendorId] ? balances.vendorBalances[vendorId] : { outstanding: 0, advance: 0 };

  if (loading) {
    return <div className="text-center py-10 font-bold text-slate-500">Loading direct vendor purchases...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 80mm Thermal Receipt Slip */}
      {activePrintJob && activePrintJob.type === 'thermal' && (
        <div className="print-only print-receipt p-2 bg-white text-black font-mono">
          <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
            <div className="flex justify-center mb-1">
              <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain mx-auto" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight text-black">AL-MADINA CONSTRUCTION COMPANY</h2>
            <p className="text-[11px] font-bold text-black mt-0.5">Proprietor: Haji Gul &amp; Son's (03458829298)</p>
            <p className="text-[10px] font-semibold text-black">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WA)</p>
            <div className="border-t border-dashed border-black my-1.5"></div>
            <p className="text-xs font-black uppercase tracking-wider text-black">DIRECT VENDOR PURCHASE / EXPENSE SLIP</p>
            <div className="flex justify-between text-xs font-bold text-black mt-1">
              <span>Voucher #: {activePrintJob.data.id}</span>
              <span>Date: {activePrintJob.data.date}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs font-mono text-black border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between">
              <span className="font-semibold">Supplier/Vendor:</span>
              <span className="font-bold">{vendors.find(v => v.id === activePrintJob.data.vendorId)?.name || activePrintJob.data.vendorId}</span>
            </div>
            {activePrintJob.data.invoiceNo && (
              <div className="flex justify-between">
                <span className="font-semibold">Vendor Inv #:</span>
                <span className="font-bold">{activePrintJob.data.invoiceNo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-semibold">Expense Head:</span>
              <span className="font-bold">{activePrintJob.data.category}</span>
            </div>
            {activePrintJob.data.vehicleId && (
              <div className="flex justify-between">
                <span className="font-semibold">Tagged Vehicle:</span>
                <span className="font-bold">{vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.number || activePrintJob.data.vehicleId}</span>
              </div>
            )}
          </div>

          <div className="py-2 border-b border-dashed border-black text-xs font-mono space-y-1">
            <div className="font-bold">Particulars / Description:</div>
            <p className="text-slate-800">{activePrintJob.data.description || activePrintJob.data.category}</p>
            {activePrintJob.data.quantity && (
              <div className="flex justify-between pt-1">
                <span>Quantity &amp; Rate:</span>
                <span className="font-bold">{activePrintJob.data.quantity} {activePrintJob.data.unit || 'Units'} @ Rs. {(activePrintJob.data.rate || 0).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="space-y-1 text-xs font-mono text-black pt-2">
            <div className="flex justify-between text-sm font-black border-b border-dashed border-black pb-1">
              <span>TOTAL BILL:</span>
              <span>Rs. {activePrintJob.data.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1">
              <span>Payment Mode:</span>
              <span className="font-bold">{activePrintJob.data.paymentType}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Amount Paid:</span>
              <span className="font-black text-emerald-800">Rs. {activePrintJob.data.paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Balance Payable:</span>
              <span className="font-black text-rose-800">Rs. {activePrintJob.data.remainingBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="print-footer text-center mt-4 text-[10px] font-bold font-mono border-t border-dashed border-black pt-2">
            Software by Roonjha Developers - 03152914836
          </div>
        </div>
      )}

      {/* Main UI */}
      <div className={`space-y-6 ${activePrintJob ? 'no-print' : ''}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
              <ShoppingCart className="h-6 w-6 text-indigo-600" />
              <span>Direct Vendor Purchases &amp; Non-Stock Expenses (ڈائریکٹ وینڈر خریداری)</span>
            </h2>
            <p className="text-sm text-slate-500">Log immediate consumption supplies, diesel, workshop repairs, and utilities without inflating warehouse stock</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Log Direct Purchase</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Direct Expenses</p>
            <p className="text-2xl font-black text-slate-900 mt-1">Rs. {totalFilteredAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">{filteredPurchases.length} total direct purchases</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-emerald-600 uppercase">Paid on Spot (Cash / Bank)</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">Rs. {totalFilteredPaid.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Cleared vendor payments</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-rose-600 uppercase">Unpaid (Vendor Payable)</p>
            <p className="text-2xl font-black text-rose-700 mt-1">Rs. {totalFilteredUnpaid.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Added to Vendor Ledger Udhaar</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search vendor, invoice, description, vehicle..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 bg-slate-50/50"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Vendor Filter */}
            <div>
              <select
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- All Vendors / Suppliers --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- All Expense Heads --</option>
                {defaultCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center space-x-1">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
                title="Start Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
                title="End Date"
              />
              {(startDate || endDate || selectedVendorId || selectedCategory || searchQuery) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedVendorId('');
                    setSelectedCategory('');
                    setSearchQuery('');
                  }}
                  className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold"
                  title="Reset Filters"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-3 py-3.5 whitespace-nowrap">Date / ID</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Vendor / Supplier</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Category / Head</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Description / Particulars</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Vehicle Tag</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Bill Amount</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Paid</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Payable Due</th>
                  <th className="px-3 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPurchases.map(p => {
                  const ven = vendors.find(v => v.id === p.vendorId);
                  const veh = vehicles.find(v => v.id === p.vehicleId);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 block">{p.id}</span>
                        <span className="text-xs text-slate-500">{p.date}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{ven?.name || p.vendorName || p.vendorId}</p>
                        {p.invoiceNo && <p className="text-xs text-slate-400 font-mono">Inv: {p.invoiceNo}</p>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-semibold text-slate-700 max-w-xs truncate">{p.description}</p>
                        {p.quantity && (
                          <p className="text-[11px] text-slate-500 font-mono">
                            {p.quantity} {p.unit || 'Units'} @ Rs. {(p.rate || 0).toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {veh ? (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <Truck className="h-3 w-3" />
                            <span>{veh.number}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                        Rs. {p.total.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-emerald-700 font-bold whitespace-nowrap">
                        Rs. {p.paidAmount.toLocaleString()}
                        <span className="block text-[10px] text-slate-400 uppercase font-medium">{p.paymentType}</span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {p.remainingBalance > 0 ? (
                          <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                            Rs. {p.remainingBalance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700 text-xs">✓ Cleared</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap no-print">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => {
                              setActivePrintJob({ type: 'thermal', data: p });
                              setTimeout(() => { window.print(); setActivePrintJob(null); }, 150);
                            }}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Print Voucher"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(p)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                            title="Edit Record"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete Record"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredPurchases.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Modal for Create / Edit */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-base">
                  {editingId ? `Edit Direct Purchase (#${editingId})` : 'Log Direct Vendor Purchase / Expense'}
                </h3>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vendor / Supplier *</label>
                  <SearchableSelect
                    options={vendors.map(v => ({
                      value: v.id,
                      label: v.name,
                      subLabel: `Payable: Rs. ${(balances?.vendorBalances[v.id]?.outstanding || 0).toLocaleString()}`,
                      searchTerms: `${v.name} ${v.phone || ''}`
                    }))}
                    value={vendorId}
                    onChange={val => setVendorId(val)}
                    placeholder="-- Select Vendor --"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vendor Bill / Inv #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9042"
                    value={invoiceNo}
                    onChange={e => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expense Head / Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                  >
                    {defaultCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tagged Vehicle (Optional)</label>
                  <select
                    value={vehicleId}
                    onChange={e => setVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">-- None / General Company Expense --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.number} ({v.type || 'Vehicle'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Item Description / Particulars *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. 200 Litres Diesel purchased for Dumper LEA-5820 at Winder Pump"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Quantity, Unit, Rate Calculation */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Qty"
                    value={quantity}
                    onChange={e => handleQtyRateChange(e.target.value === '' ? '' : Number(e.target.value), rate)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="Litres / Pcs"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Rate (Rs.)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Unit Price"
                    value={rate}
                    onChange={e => handleQtyRateChange(quantity, e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-900 mb-1">Total Bill (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Total Amount"
                    value={total === 0 ? '' : total}
                    onChange={e => {
                      const newTot = e.target.value === '' ? 0 : Number(e.target.value);
                      setTotal(newTot);
                      if (!isPaidTouched && (paymentType === 'Cash' || paymentType === 'Bank')) {
                        setPaidAmount(newTot);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border-2 border-indigo-300 rounded-lg text-xs font-black text-indigo-900 bg-white"
                  />
                </div>
              </div>

              {/* Payment Mode & Amount Paid */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 rounded-xl border border-amber-300 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-amber-950 uppercase">Payment Method</label>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500">Total Bill: </span>
                    <span className="text-xs font-black text-indigo-900">Rs. {total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Cash');
                      if (!isPaidTouched) setPaidAmount(total);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      paymentType === 'Cash' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-amber-200'
                    }`}
                  >
                    💵 Cash Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Credit');
                      if (!isPaidTouched) setPaidAmount(0);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      paymentType === 'Credit' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-amber-200'
                    }`}
                  >
                    📋 Credit (Udhaar)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Bank');
                      if (!isPaidTouched) setPaidAmount(total);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      paymentType === 'Bank' ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-white text-slate-700 border-amber-200'
                    }`}
                  >
                    🏦 Bank Transfer
                  </button>
                </div>

                {paymentType === 'Bank' && (
                  <select
                    value={bankId}
                    onChange={e => setBankId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-cyan-300 rounded-lg text-xs font-semibold"
                  >
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.accountNumber})</option>
                    ))}
                  </select>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-800">Amount Paid Now (Rs.)</label>
                    <div className="space-x-1">
                      <button
                        type="button"
                        onClick={() => { setPaidAmount(total); setIsPaidTouched(true); }}
                        className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold rounded"
                      >
                        Full Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPaidAmount(0); setIsPaidTouched(true); }}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 font-bold rounded"
                      >
                        Zero Paid
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={paidAmount === 0 ? '' : paidAmount}
                    onChange={e => {
                      setPaidAmount(e.target.value === '' ? 0 : Number(e.target.value));
                      setIsPaidTouched(true);
                    }}
                    className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg text-sm font-black text-indigo-900 bg-white"
                  />
                  <div className="pt-2 flex justify-between text-xs font-bold">
                    <span>Balance Due to Vendor:</span>
                    <span className={total - paidAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      Rs. {Math.max(0, total - paidAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Save Direct Purchase</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
