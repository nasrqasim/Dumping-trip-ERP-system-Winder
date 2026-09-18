import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, migrateItemIds, DBItem, DBInventoryLedgerEntry, DBTrip, DBPurchase, DBSale, DBCustomer, DBVendor } from '../db/firestore';
import { calculateLiveBalances, LiveBalances } from '../db/transactions';
import { Edit, Trash, Plus, Package, Info, FileText, Printer, Search, X } from 'lucide-react';
import Pagination from './Pagination';

export default function InventoryMaster() {
  const [items, setItems] = useState<DBItem[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sub-tabs navigation
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'ledger'>('directory');
  const [selectedLedgerItemId, setSelectedLedgerItemId] = useState<string | null>(null);
  const [viewModalItem, setViewModalItem] = useState<DBItem | null>(null);
  
  // Date Filters
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // default to start of month
    return d.toISOString().split('T')[0];
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Lookup data states
  const [inventoryLedger, setInventoryLedger] = useState<DBInventoryLedgerEntry[]>([]);
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [purchases, setPurchases] = useState<DBPurchase[]>([]);
  const [sales, setSales] = useState<DBSale[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'KG' | 'Ton' | 'Trip' | 'Truck' | 'Piece' | 'Liter'>('Ton');
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [saleRate, setSaleRate] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);
  const [minStock, setMinStock] = useState(0);

  const loadData = async () => {
    try {
      await migrateItemIds();
      const [
        allItems,
        allInvLedger,
        allTrips,
        allPurchases,
        allSales,
        allCustomers,
        allVendors
      ] = await Promise.all([
        getAllRecords<DBItem>('items'),
        getAllRecords<DBInventoryLedgerEntry>('inventory_ledger'),
        getAllRecords<DBTrip>('trips'),
        getAllRecords<DBPurchase>('purchases'),
        getAllRecords<DBSale>('sales'),
        getAllRecords<DBCustomer>('customers'),
        getAllRecords<DBVendor>('vendors'),
      ]);

      const liveBal = await calculateLiveBalances({
        items: allItems,
        inventoryEntries: allInvLedger,
        customers: allCustomers,
        vendors: allVendors,
      });

      setItems(allItems);
      setBalances(liveBal);
      setInventoryLedger(allInvLedger);
      setTrips(allTrips);
      setPurchases(allPurchases);
      setSales(allSales);
      setCustomers(allCustomers);
      setVendors(allVendors);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = (item?: DBItem) => {
    if (item) {
      setEditingId(item.id);
      setName(item.name);
      setUnit(item.unit);
      setPurchaseRate(item.purchaseRate);
      setSaleRate(item.saleRate);
      
      const stock = balances?.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
      setCurrentStock(stock);
      setMinStock(item.minStock);
    } else {
      setEditingId(null);
      setName('');
      setUnit('Ton');
      setPurchaseRate(0);
      setSaleRate(0);
      setCurrentStock(0);
      setMinStock(0);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let itemId = editingId;
    if (!itemId) {
      let maxNum = 0;
      const prefix = 'item-';
      for (const itm of items) {
        if (itm.id && itm.id.startsWith(prefix)) {
          const numPart = parseInt(itm.id.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
      const nextNum = maxNum + 1;
      itemId = `${prefix}${String(nextNum).padStart(3, '0')}`;
    }

    const savedItem: DBItem = {
      id: itemId,
      name,
      unit,
      purchaseRate: Number(purchaseRate),
      saleRate: Number(saleRate),
      currentStock: Number(currentStock),
      minStock: Number(minStock),
    };

    await putRecord<DBItem>('items', savedItem);

    // If it's a new item or we changed stock, we log an opening ledger entry in inventory_ledger
    if (!editingId) {
      // Create initial stock ledger entry if stock > 0
      if (Number(currentStock) > 0) {
        const initialStockEntry: DBInventoryLedgerEntry = {
          id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          date: new Date().toISOString().split('T')[0],
          itemId: itemId,
          type: 'adjustment',
          referenceId: 'opening-' + itemId,
          qtyIn: Number(currentStock),
          qtyOut: 0,
          rate: Number(purchaseRate),
          value: Number(currentStock) * Number(purchaseRate),
        };
        await putRecord<DBInventoryLedgerEntry>('inventory_ledger', initialStockEntry);
      }
    } else {
      // For edited items, if they want to adjust stock, they can.
      // But typically stock is computed from transactions. We can allow editing basic details
      // and keep the currentStock synced. We don't overwrite history, but we can write an adjustment
      // if they changed currentStock in the edit modal.
      const oldStock = balances?.itemStocks[itemId] || 0;
      const diff = Number(currentStock) - oldStock;
      if (diff !== 0) {
        const adjustmentEntry: DBInventoryLedgerEntry = {
          id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          date: new Date().toISOString().split('T')[0],
          itemId: itemId,
          type: 'adjustment',
          referenceId: 'adjustment-' + Date.now(),
          qtyIn: diff > 0 ? diff : 0,
          qtyOut: diff < 0 ? Math.abs(diff) : 0,
          rate: Number(purchaseRate),
          value: Math.abs(diff) * Number(purchaseRate),
        };
        await putRecord<DBInventoryLedgerEntry>('inventory_ledger', adjustmentEntry);
      }
    }

    setIsFormOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item? Doing so might affect related transaction records.')) {
      await deleteRecord('items', id);
      
      // Clean inventory ledger for opening adjustment
      const allInv = await getAllRecords<DBInventoryLedgerEntry>('inventory_ledger');
      for (const entry of allInv) {
        if (entry.itemId === id) {
          await deleteRecord('inventory_ledger', entry.id);
        }
      }
      
      loadData();
    }
  };

  // Compile Ledger entries for selected item
  const getSelectedLedgerItem = () => {
    return items.find(i => i.id === selectedLedgerItemId) || null;
  };

  const getItemLedgerRows = () => {
    if (!selectedLedgerItemId) return [];
    
    const itemEntries = inventoryLedger.filter(e => e.itemId === selectedLedgerItemId);
    itemEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 1. Calculate opening balance before ledgerStartDate
    let preBalance = 0;
    const prePeriodEntries = itemEntries.filter(e => ledgerStartDate && e.date < ledgerStartDate);
    preBalance = prePeriodEntries.reduce((sum, e) => sum + (e.qtyIn - e.qtyOut), 0);

    // 2. Period entries
    const periodEntries = itemEntries.filter(e => 
      (!ledgerStartDate || e.date >= ledgerStartDate) && 
      (!ledgerEndDate || e.date <= ledgerEndDate)
    );

    let runningBal = preBalance;
    const rows: any[] = [];

    // Push initial period opening balance row
    rows.push({
      date: ledgerStartDate || 'Start',
      reference: 'OP-BAL',
      type: 'OPENING',
      party: '—',
      qtyIn: preBalance > 0 ? preBalance : 0,
      qtyOut: preBalance < 0 ? Math.abs(preBalance) : 0,
      rate: 0,
      amount: 0,
      balance: preBalance,
    });

    for (const entry of periodEntries) {
      runningBal += (entry.qtyIn - entry.qtyOut);

      // Resolve party name
      let partyName = '—';
      if (entry.type === 'purchase') {
        const purchase = purchases.find(p => p.id === entry.referenceId);
        if (purchase) {
          const vend = vendors.find(v => v.id === purchase.vendorId);
          if (vend) partyName = vend.name;
        }
      } else if (entry.type === 'sale') {
        const sale = sales.find(s => s.id === entry.referenceId);
        if (sale) {
          const cust = customers.find(c => c.id === sale.customerId);
          if (cust) partyName = cust.name;
        }
      } else if (entry.type === 'trip') {
        const trip = trips.find(t => t.id === entry.referenceId);
        if (trip) {
          const cust = customers.find(c => c.id === trip.customerId);
          if (cust) partyName = cust.name;
        }
      }

      rows.push({
        date: entry.date,
        reference: entry.referenceId,
        type: entry.type.toUpperCase(),
        party: partyName,
        qtyIn: entry.qtyIn,
        qtyOut: entry.qtyOut,
        rate: entry.rate,
        amount: entry.value,
        balance: runningBal,
      });
    }

    return rows;
  };

  // Helper for the View Ledger item popup modal matching Image 1
  const getModalLedgerData = (item: DBItem) => {
    const itemEntries = inventoryLedger.filter(e => e.itemId === item.id);
    itemEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const liveStock = balances?.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
    const totalIn = itemEntries.reduce((sum, e) => sum + e.qtyIn, 0);
    const totalOut = itemEntries.reduce((sum, e) => sum + e.qtyOut, 0);
    const initialOpeningStock = Math.max(0, liveStock - totalIn + totalOut);

    let runningBal = initialOpeningStock;
    const rows: {
      date: string;
      tranNo: string;
      tranType: string;
      qtyIn: number;
      qtyOut: number;
      unit: string;
      stockBalance: number;
      remarks: string;
    }[] = [];

    // If there is initial opening stock and no entries yet, show initial opening entry
    if (initialOpeningStock > 0 && itemEntries.length === 0) {
      rows.push({
        date: `${new Date().toISOString().split('T')[0]} 09:00`,
        tranNo: `VCH-OP-${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`,
        tranType: 'OpeningStock',
        qtyIn: initialOpeningStock,
        qtyOut: 0,
        unit: `Per ${item.unit}`,
        stockBalance: initialOpeningStock,
        remarks: `Initial registered opening balance - ${item.name}`,
      });
    }

    for (const entry of itemEntries) {
      runningBal += (entry.qtyIn - entry.qtyOut);

      let tranNo = entry.referenceId;
      let tranType = 'StockAdjustment';
      let remarks = `Stock adjustment for ${item.name}`;

      const cleanRef = entry.referenceId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();

      if (entry.type === 'purchase') {
        tranType = 'PurchaseInvoice';
        tranNo = `VCH-PI-${cleanRef}`;
        const purchase = purchases.find(p => p.id === entry.referenceId);
        const vend = purchase ? vendors.find(v => v.id === purchase.vendorId) : null;
        remarks = `Purchase #${tranNo} - ${item.name}${vend ? ` (${vend.name})` : ''}`;
      } else if (entry.type === 'sale') {
        tranType = 'POSCounterSale';
        tranNo = `VCH-POS-${cleanRef}`;
        const sale = sales.find(s => s.id === entry.referenceId);
        const cust = sale ? customers.find(c => c.id === sale.customerId) : null;
        remarks = `Invoice #${tranNo} - ${item.name}${cust ? ` (${cust.name})` : ''}`;
      } else if (entry.type === 'trip') {
        tranType = 'SaleInvoice';
        tranNo = `VCH-SI-${cleanRef}`;
        const trip = trips.find(t => t.id === entry.referenceId);
        const cust = trip ? customers.find(c => c.id === trip.customerId) : null;
        remarks = `Invoice #${tranNo} - ${item.name}${cust ? ` (${cust.name})` : ''}`;
      } else if (entry.type === 'return') {
        tranType = 'SaleReturn';
        tranNo = `VCH-SR-${cleanRef}`;
        remarks = `Invoice #${tranNo} - ${item.name}`;
      }

      let formattedDate = entry.date;
      if (formattedDate.length === 10) {
        formattedDate = `${formattedDate} 15:00`;
      }

      rows.push({
        date: formattedDate,
        tranNo,
        tranType,
        qtyIn: entry.qtyIn,
        qtyOut: entry.qtyOut,
        unit: `Per ${item.unit}`,
        stockBalance: runningBal,
        remarks,
      });
    }

    return {
      initialOpeningStock,
      liveStock,
      rows,
    };
  };

  const handlePrintLedger = () => {
    window.print();
  };

  if (loading) {
    return <div className="text-center py-6">Loading items database...</div>;
  }

  // Statistics for selected ledger item
  const selectedItem = getSelectedLedgerItem();
  const ledgerRows = getItemLedgerRows();
  const currentLiveStock = selectedItem ? (balances?.itemStocks[selectedItem.id] ?? selectedItem.currentStock) : 0;
  
  const periodOpeningStock = ledgerRows[0]?.balance || 0;
  const periodTotalQtyIn = ledgerRows.slice(1).reduce((sum, r) => sum + r.qtyIn, 0);
  const periodTotalQtyOut = ledgerRows.slice(1).reduce((sum, r) => sum + r.qtyOut, 0);
  const periodClosingStock = periodOpeningStock + periodTotalQtyIn - periodTotalQtyOut;

  // Breakdown metrics
  const purchaseQty = ledgerRows.slice(1).filter(r => r.type === 'PURCHASE').reduce((sum, r) => sum + r.qtyIn, 0);
  const salesQty = ledgerRows.slice(1).filter(r => r.type === 'SALE' || r.type === 'TRIP').reduce((sum, r) => sum + r.qtyOut, 0);
  const adjustIn = ledgerRows.slice(1).filter(r => r.type === 'ADJUSTMENT' || r.type === 'RETURN').reduce((sum, r) => sum + r.qtyIn, 0);
  const adjustOut = ledgerRows.slice(1).filter(r => r.type === 'ADJUSTMENT' || r.type === 'RETURN').reduce((sum, r) => sum + r.qtyOut, 0);

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredItems = items.filter(item => {
    if (!cleanSearch) return true;
    return (
      item.name.toLowerCase().includes(cleanSearch) ||
      item.id.toLowerCase().includes(cleanSearch) ||
      item.unit.toLowerCase().includes(cleanSearch)
    );
  });

  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={`space-y-6 ${viewModalItem ? 'no-print' : ''}`}>
      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 no-print">
        <button
          onClick={() => {
            setActiveSubTab('directory');
            setSelectedLedgerItemId(null);
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeSubTab === 'directory' && !selectedLedgerItemId
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Item Directory
        </button>
        <button
          onClick={() => {
            setActiveSubTab('ledger');
            setSelectedLedgerItemId(null);
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeSubTab === 'ledger' && !selectedLedgerItemId
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Inventory Ledger
        </button>
      </div>

      {/* 1. Item Directory Tab */}
      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Items & Pricing Directory</h2>
              <p className="text-sm text-slate-500">Configure item names, units, and purchase/sale rates</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search item..."
                  className="w-full pl-8 pr-7 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                />
                <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-3" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5 p-0.5 rounded"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ledger</span>
              </button>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Item</span>
              </button>
            </div>
          </div>

          <div className="print-a4 print-container space-y-4">
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h2>
                  <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul &amp; Son's (03458829298)</p>
                  <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-600 tracking-wider uppercase mt-1">
                ITEMS &amp; PRICING DIRECTORY
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Total Items: {items.length}</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Item Name</th>
                      <th className="px-6 py-4">Unit</th>
                      <th className="px-6 py-4">Purchase Rate</th>
                      <th className="px-6 py-4">Sale Rate</th>
                      <th className="px-6 py-4">Current Stock</th>
                      <th className="px-6 py-4">Reorder Level</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedItems.map(item => {
                      const stock = balances?.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
                      const isLow = stock <= item.minStock;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              {item.id}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{item.unit}</td>
                          <td className="px-6 py-4 font-medium">Rs. {item.purchaseRate.toLocaleString()}</td>
                          <td className="px-6 py-4 font-medium text-emerald-600">Rs. {item.saleRate.toLocaleString()}</td>
                          <td className={`px-6 py-4 font-bold ${isLow ? 'text-amber-600' : 'text-slate-700'}`}>
                            {stock.toLocaleString()} {item.unit}
                          </td>
                          <td className="px-6 py-4 text-slate-500">{item.minStock.toLocaleString()} {item.unit}</td>
                          <td className="px-6 py-4">
                            {isLow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 no-print whitespace-nowrap">
                            <button
                              onClick={() => setViewModalItem(item)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded transition inline-flex items-center space-x-1 mr-1"
                              title="View Detailed Stock Movement Ledger"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View Ledger</span>
                            </button>
                            <button
                              onClick={() => handleOpenForm(item)}
                              className="text-slate-400 hover:text-indigo-600 transition"
                            >
                              <Edit className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">
                          <Package className="h-10 w-10 mx-auto mb-2 stroke-1" />
                          <p className="text-sm font-medium">
                            {searchQuery ? `No matching items found for "${searchQuery}".` : 'No materials registered.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredItems.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        <td colSpan={4} className="px-6 py-3 font-black">Total Stock Across All Materials ({filteredItems.length} Items):</td>
                        <td className="px-6 py-3 font-black text-emerald-300">
                          {filteredItems.reduce((sum, item) => sum + (balances?.itemStocks[item.id] ?? item.currentStock), 0).toLocaleString()} Units
                        </td>
                        <td colSpan={2}></td>
                        <td className="no-print"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <Pagination
                currentPage={currentPage}
                totalItems={filteredItems.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>

            <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
              Software by Roonjha Developers - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* 2. Inventory Ledger List Sub-Tab */}
      {activeSubTab === 'ledger' && !selectedLedgerItemId && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Inventory Stock Ledger</h2>
              <p className="text-sm text-slate-500">View detailed transaction cards and balance movements for stock items</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search stock items..."
                  className="w-full pl-8 pr-7 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                />
                <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-3" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5 p-0.5 rounded"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ledger</span>
              </button>
            </div>
          </div>

          <div className="print-a4 print-container space-y-4">
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h2>
                  <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul &amp; Son's (03458829298)</p>
                  <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-600 tracking-wider uppercase mt-1">
                INVENTORY STOCK LEDGER SUMMARY
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Total Items: {items.length}</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Item Name</th>
                      <th className="px-6 py-4">Code / ID</th>
                      <th className="px-6 py-4">Unit</th>
                      <th className="px-6 py-4">Current Stock</th>
                      <th className="px-6 py-4">Reorder Level</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredItems.map(item => {
                      const stock = balances?.itemStocks[item.id] !== undefined ? balances.itemStocks[item.id] : item.currentStock;
                      const isLow = stock <= item.minStock;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-semibold text-slate-700">{item.name}</td>
                          <td className="px-6 py-4 font-mono text-slate-500">{item.id}</td>
                          <td className="px-6 py-4 text-slate-500">{item.unit}</td>
                          <td className={`px-6 py-4 font-bold ${isLow ? 'text-amber-600' : 'text-slate-700'}`}>
                            {stock.toLocaleString()} {item.unit}
                          </td>
                          <td className="px-6 py-4 text-slate-500">{item.minStock.toLocaleString()} {item.unit}</td>
                          <td className="px-6 py-4">
                            {isLow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right no-print">
                            <button
                              onClick={() => setViewModalItem(item)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded transition inline-flex items-center space-x-1"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View Ledger</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <Package className="h-10 w-10 mx-auto mb-2 stroke-1" />
                          <p className="text-sm font-medium">
                            {searchQuery ? `No matching items found for "${searchQuery}".` : 'No materials registered.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredItems.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        <td colSpan={3} className="px-6 py-3 font-black">Grand Total Inventory Stock ({filteredItems.length} Items):</td>
                        <td className="px-6 py-3 font-black text-emerald-300">
                          {filteredItems.reduce((sum, item) => sum + (balances?.itemStocks[item.id] ?? item.currentStock), 0).toLocaleString()} Units
                        </td>
                        <td colSpan={2}></td>
                        <td className="no-print"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
              Software by Roonjha Developers - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* 3. Detailed Item Ledger View */}
      {selectedLedgerItemId && selectedItem && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="flex justify-between items-center no-print border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <span>Stock Ledger: {selectedItem.name}</span>
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={handlePrintLedger}
                className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ledger</span>
              </button>
              <button
                onClick={() => setSelectedLedgerItemId(null)}
                className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                Back to List
              </button>
            </div>
          </div>

          {/* Ledger Date Filters */}
          <div className="no-print bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-wrap gap-4 items-center justify-between mb-6 text-sm">
            <div className="flex items-center space-x-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={e => setLedgerStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={e => setLedgerEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="text-slate-500 text-xs font-medium">
              Showing Ledger: <span className="font-semibold text-slate-800">{ledgerStartDate || 'Opening'}</span> to <span className="font-semibold text-slate-800">{ledgerEndDate || 'Today'}</span>
            </div>
          </div>

          {/* Item Information Header Block */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Item Name</p>
              <p className="font-extrabold text-slate-800 text-sm mt-0.5">{selectedItem.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Item Code / ID</p>
              <p className="font-mono font-bold text-slate-600 mt-0.5">{selectedItem.id}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Unit / Reorder</p>
              <p className="font-bold text-slate-700 mt-0.5">{selectedItem.unit} (Min: {selectedItem.minStock})</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Current Live Stock</p>
              <p className="font-black text-indigo-700 text-sm mt-0.5">{currentLiveStock.toLocaleString()} {selectedItem.unit}</p>
            </div>
          </div>

          {/* Table display */}
          <div className="print-a4 print-container space-y-6">
            {/* Print Header */}
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h2>
                  <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul &amp; Son's (03458829298)</p>
                  <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-600 tracking-wider uppercase mt-1">
                ITEM INVENTORY STOCK LEDGER - {selectedItem.name}
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-4 px-2">
                <div>
                  Item Code: {selectedItem.id} | Unit: {selectedItem.unit} | Current Balance: {currentLiveStock.toLocaleString()} {selectedItem.unit}
                </div>
                <div>
                  Period: {ledgerStartDate} to {ledgerEndDate} | Generated: {new Date().toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>

            {/* Inventory table */}
            <table className="min-w-full text-left text-xs font-mono border-collapse border border-slate-300">
              <thead className="bg-[#800000] text-white uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-3 py-2 border border-slate-300">DATE</th>
                  <th className="px-3 py-2 border border-slate-300">REFERENCE</th>
                  <th className="px-3 py-2 border border-slate-300">TRANSACTION</th>
                  <th className="px-3 py-2 border border-slate-300">PARTY</th>
                  <th className="px-3 py-2 text-right border border-slate-300">QTY IN</th>
                  <th className="px-3 py-2 text-right border border-slate-300">QTY OUT</th>
                  <th className="px-3 py-2 border border-slate-300">UNIT</th>
                  <th className="px-3 py-2 text-right border border-slate-300">RATE</th>
                  <th className="px-3 py-2 text-right border border-slate-300">AMOUNT</th>
                  <th className="px-3 py-2 text-right border border-slate-300">BALANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 bg-white">
                {ledgerRows.map((row, idx) => {
                  let formattedDate = row.date;
                  const parts = row.date.split('-');
                  if (parts.length === 3) {
                    formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 border border-slate-300 whitespace-nowrap text-slate-700">{formattedDate}</td>
                      <td className="px-3 py-2 border border-slate-300 font-bold text-slate-800 whitespace-nowrap">{row.reference}</td>
                      <td className="px-3 py-2 border border-slate-300 font-semibold text-slate-700">{row.type}</td>
                      <td className="px-3 py-2 border border-slate-300 text-slate-800">{row.party}</td>
                      <td className="px-3 py-2 text-right border border-slate-300 text-slate-800 font-semibold">
                        {row.qtyIn > 0 ? row.qtyIn.toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-2 text-right border border-slate-300 text-slate-800 font-semibold">
                        {row.qtyOut > 0 ? row.qtyOut.toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-2 border border-slate-300 text-slate-500">{selectedItem.unit}</td>
                      <td className="px-3 py-2 text-right border border-slate-300 text-slate-600">
                        {row.rate > 0 ? `Rs. ${row.rate.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right border border-slate-300 text-slate-800 font-semibold">
                        {row.amount > 0 ? `Rs. ${row.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right border border-slate-300 font-bold text-slate-900">
                        {row.balance.toLocaleString()} {selectedItem.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="bg-slate-100 text-slate-900 font-bold border border-slate-300">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-left font-black border border-slate-300 uppercase">Period Totals</td>
                  <td className="px-3 py-2 text-right border border-slate-300 text-indigo-700 font-black">
                    {periodTotalQtyIn.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right border border-slate-300 text-rose-700 font-black">
                    {periodTotalQtyOut.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 border border-slate-300"></td>
                  <td className="px-3 py-2 border border-slate-300"></td>
                  <td className="px-3 py-2 border border-slate-300"></td>
                  <td className="px-3 py-2 text-right border border-slate-300 font-black text-emerald-700">
                    {periodClosingStock.toLocaleString()} {selectedItem.unit}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Aggregated Breakdowns Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs mt-4 print-break-inside-avoid">
              <div>
                <span className="font-bold text-slate-500 block">Total Purchases</span>
                <span className="font-black text-slate-800 text-sm">{purchaseQty.toLocaleString()} {selectedItem.unit}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block">Total Sales</span>
                <span className="font-black text-slate-800 text-sm">{salesQty.toLocaleString()} {selectedItem.unit}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block">Adjustments In</span>
                <span className="font-black text-slate-800 text-sm">{adjustIn.toLocaleString()} {selectedItem.unit}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block">Adjustments Out</span>
                <span className="font-black text-slate-800 text-sm">{adjustOut.toLocaleString()} {selectedItem.unit}</span>
              </div>
            </div>

            {/* Print Footer */}
            <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
              Software by Roonjha Developers - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingId ? 'Edit Inventory Item' : 'Add New Inventory Item'}
                </h3>
                {editingId ? (
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    {editingId}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                    Auto: item-00X
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Sand (Rait), Soil (Mitti), Gravel (Bajri)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Measurement Unit
                  </label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Ton">Ton</option>
                    <option value="KG">KG</option>
                    <option value="Trip">Trip</option>
                    <option value="Truck">Truck</option>
                    <option value="Piece">Piece</option>
                    <option value="Liter">Liter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Reorder Min Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={minStock}
                    onChange={e => setMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Purchase Rate (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={purchaseRate}
                    onChange={e => setPurchaseRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Sale Rate (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={saleRate}
                    onChange={e => setSaleRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Current Stock Level ({unit})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={currentStock}
                  onChange={e => setCurrentStock(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                  <Info className="h-3 w-3 text-slate-400" />
                  <span>Updates here create adjustments in the stock ledger.</span>
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                >
                  {editingId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Item Ledger Popup Modal (Exact match to User Reference Image) */}
      {viewModalItem && (() => {
        const { initialOpeningStock, liveStock, rows } = getModalLedgerData(viewModalItem);

        return (
          <>
            {/* Screen Dialog View */}
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center z-50 p-2 md:p-6 overflow-y-auto no-print">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl my-auto overflow-hidden flex flex-col max-h-[94vh]">
                {/* Maroon Modal Header */}
                <div className="bg-[#800000] px-6 py-4 flex justify-between items-center text-white flex-shrink-0">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold tracking-wide">
                      Inventory Ledger — {viewModalItem.name.toUpperCase()}
                    </h3>
                    <p className="text-xs text-amber-300 font-medium mt-0.5">
                      Code: {viewModalItem.id.toUpperCase()} <span className="mx-1 text-amber-400/70">|</span> Detailed historical tracking of all stock movements
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => window.print()}
                      className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-sm transition"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print Ledger</span>
                    </button>
                    <button
                      onClick={() => setViewModalItem(null)}
                      className="text-white hover:text-slate-200 text-xl font-bold ml-2 leading-none transition px-1"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 4 Summary Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-white border-b border-slate-100 flex-shrink-0">
                  {/* Card 1: OPENING STOCK */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      OPENING STOCK
                    </p>
                    <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">
                      {initialOpeningStock.toLocaleString()}
                    </p>
                  </div>

                  {/* Card 2: CURRENT STOCK */}
                  <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 shadow-xs">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                      CURRENT STOCK
                    </p>
                    <p className="text-xl md:text-2xl font-black text-emerald-600 mt-1">
                      {liveStock.toLocaleString()}
                    </p>
                  </div>

                  {/* Card 3: PURCHASE PRICE */}
                  <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 shadow-xs">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                      PURCHASE PRICE
                    </p>
                    <p className="text-xl md:text-2xl font-black text-blue-600 mt-1">
                      PKR {viewModalItem.purchaseRate.toLocaleString()}
                    </p>
                  </div>

                  {/* Card 4: SALE RETAIL PRICE */}
                  <div className="bg-rose-50/40 border border-rose-200 rounded-xl p-4 shadow-xs">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                      SALE RETAIL PRICE
                    </p>
                    <p className="text-xl md:text-2xl font-black text-rose-600 mt-1">
                      PKR {viewModalItem.saleRate.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Ledger Table Container */}
                <div className="p-5 overflow-y-auto flex-1">
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="min-w-full text-left text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                        <tr>
                          <th className="px-4 py-3">DATE</th>
                          <th className="px-4 py-3">TRAN. NO.</th>
                          <th className="px-4 py-3">TRANSACTION TYPE</th>
                          <th className="px-4 py-3 text-right">QTY IN (+)</th>
                          <th className="px-4 py-3 text-right">QTY OUT (-)</th>
                          <th className="px-4 py-3">UNIT</th>
                          <th className="px-4 py-3 text-right">STOCK BALANCE</th>
                          <th className="px-4 py-3">REMARKS / WAREHOUSE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.date}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">{row.tranNo}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">{row.tranType}</td>
                            <td className={`px-4 py-3 text-right font-bold ${row.qtyIn > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {row.qtyIn > 0 ? row.qtyIn.toLocaleString() : '0'}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${row.qtyOut > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                              {row.qtyOut > 0 ? row.qtyOut.toLocaleString() : '0'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.unit}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">{row.stockBalance.toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-700 text-[11px]">{row.remarks}</td>
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-slate-400">
                              No inventory transactions recorded yet for this item.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
                  <button
                    onClick={() => setViewModalItem(null)}
                    className="bg-[#475569] hover:bg-[#334155] text-white font-bold px-6 py-2 rounded-lg text-xs transition shadow-sm"
                  >
                    Close Ledger
                  </button>
                </div>
              </div>
            </div>

            {/* Dedicated Print View (Print-Only) */}
            <div className="hidden print:block print-a4 print-container space-y-4">
              <div className="text-center pb-3 border-b-2 border-slate-300">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h2>
                    <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul &amp; Son's (03458829298)</p>
                    <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-600 tracking-wider uppercase mt-1">
                  INVENTORY LEDGER — {viewModalItem.name.toUpperCase()} (CODE: {viewModalItem.id.toUpperCase()})
                </p>
                <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-2 px-2">
                  <span>Unit: {viewModalItem.unit} | Reorder Level: {viewModalItem.minStock} {viewModalItem.unit}</span>
                  <span>Generated: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* 4 Summary Cards in Print */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="border border-slate-300 p-2.5 text-center rounded">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">OPENING STOCK</p>
                  <p className="font-bold text-base text-slate-900 mt-0.5">{initialOpeningStock.toLocaleString()}</p>
                </div>
                <div className="border border-emerald-300 bg-emerald-50/40 p-2.5 text-center rounded">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">CURRENT STOCK</p>
                  <p className="font-bold text-base text-emerald-700 mt-0.5">{liveStock.toLocaleString()}</p>
                </div>
                <div className="border border-blue-300 bg-blue-50/40 p-2.5 text-center rounded">
                  <p className="text-[10px] font-bold text-blue-700 uppercase">PURCHASE PRICE</p>
                  <p className="font-bold text-base text-blue-700 mt-0.5">PKR {viewModalItem.purchaseRate.toLocaleString()}</p>
                </div>
                <div className="border border-rose-300 bg-rose-50/40 p-2.5 text-center rounded">
                  <p className="text-[10px] font-bold text-rose-700 uppercase">SALE RETAIL PRICE</p>
                  <p className="font-bold text-base text-rose-700 mt-0.5">PKR {viewModalItem.saleRate.toLocaleString()}</p>
                </div>
              </div>

              {/* Printable Table */}
              <table className="min-w-full text-left text-xs font-mono border-collapse border border-slate-300">
                <thead className="bg-[#800000] text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-2 py-2 border border-slate-300">DATE</th>
                    <th className="px-2 py-2 border border-slate-300">TRAN. NO.</th>
                    <th className="px-2 py-2 border border-slate-300">TRANSACTION TYPE</th>
                    <th className="px-2 py-2 text-right border border-slate-300">QTY IN (+)</th>
                    <th className="px-2 py-2 text-right border border-slate-300">QTY OUT (-)</th>
                    <th className="px-2 py-2 border border-slate-300">UNIT</th>
                    <th className="px-2 py-2 text-right border border-slate-300">STOCK BALANCE</th>
                    <th className="px-2 py-2 border border-slate-300">REMARKS / WAREHOUSE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5 border border-slate-300 text-slate-700 whitespace-nowrap">{row.date}</td>
                      <td className="px-2 py-1.5 border border-slate-300 font-mono text-slate-800">{row.tranNo}</td>
                      <td className="px-2 py-1.5 border border-slate-300 font-bold">{row.tranType}</td>
                      <td className="px-2 py-1.5 border border-slate-300 text-right font-bold text-emerald-700">
                        {row.qtyIn > 0 ? row.qtyIn.toLocaleString() : '0'}
                      </td>
                      <td className="px-2 py-1.5 border border-slate-300 text-right font-bold text-rose-700">
                        {row.qtyOut > 0 ? row.qtyOut.toLocaleString() : '0'}
                      </td>
                      <td className="px-2 py-1.5 border border-slate-300">{row.unit}</td>
                      <td className="px-2 py-1.5 border border-slate-300 text-right font-black">{row.stockBalance.toLocaleString()}</td>
                      <td className="px-2 py-1.5 border border-slate-300 text-[11px] text-slate-700">{row.remarks}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-6 border border-slate-300 text-slate-400">
                        No transactions recorded for this item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
                Software by Roonjha Developers - 03152914836
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
