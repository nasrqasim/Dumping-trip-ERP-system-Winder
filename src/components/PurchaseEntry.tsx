import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBPurchase, DBVendor, DBItem, DBBank, DBVehicle, DBPurchaseItem } from '../db/firestore';
import { calculateLiveBalances, LiveBalances, savePurchaseTransaction, deletePurchaseTransaction } from '../db/transactions';
import { Plus, Trash, Edit, Truck, Calendar, ShoppingBag, Printer, Search, X, UserCheck, AlertTriangle, ShieldAlert, Wallet, FileText, Download, Check } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

interface PurchaseEntryProps {
  preselectedVendorId?: string;
  onClearPreselectedVendor?: () => void;
}

interface PurchaseItemRow {
  id: string;
  itemId: string;
  itemName?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export default function PurchaseEntry({ preselectedVendorId, onClearPreselectedVendor }: PurchaseEntryProps) {
  const [purchases, setPurchases] = useState<DBPurchase[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals & Print Job
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeViewPurchase, setActiveViewPurchase] = useState<DBPurchase | null>(null);
  const [activePrintJob, setActivePrintJob] = useState<{ type: 'thermal' | 'a4'; data: DBPurchase } | null>(null);

  // Form Fields: Logistics & Reference
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [biltyNo, setBiltyNo] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState<number>(0);

  // Form Fields: Vendor & Payment
  const [vendorId, setVendorId] = useState('walk-in-vendor');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit' | 'Advance'>('Cash');
  const [bankId, setBankId] = useState('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isPaidTouched, setIsPaidTouched] = useState(false);

  // Form Fields: Multi-Item Intake
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([
    { id: 'pitem-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }
  ]);
  const [quickItemId, setQuickItemId] = useState('');
  const [quickQty, setQuickQty] = useState<number>(0);
  const [quickRate, setQuickRate] = useState<number>(0);

  const loadData = async () => {
    try {
      // Ensure Walk-in Vendor exists
      const allVendors = await getAllRecords<DBVendor>('vendors');
      let walkin = allVendors.find(v => v.id === 'walk-in-vendor');
      if (!walkin) {
        const newWalkin: DBVendor = {
          id: 'walk-in-vendor',
          name: 'Walk-in Vendor (Spot Supplier)',
          phone: '0000-0000000',
          address: 'Counter / Spot Purchase',
          area: 'Local',
          openingBalance: 0,
          category: 'Spot Supplier',
        };
        await putRecord<DBVendor>('vendors', newWalkin);
        allVendors.unshift(newWalkin);
      }
      setVendors(allVendors);

      const allPurchases = await getAllRecords<DBPurchase>('purchases');
      allPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPurchases(allPurchases);

      const allItems = await getAllRecords<DBItem>('items');
      setItems(allItems);

      const allVehicles = await getAllRecords<DBVehicle>('vehicles');
      setVehicles(allVehicles);

      const allBanks = await getAllRecords<DBBank>('banks');
      setBanks(allBanks);
      if (allBanks.length > 0 && !bankId) {
        setBankId(allBanks[0].id);
      }

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      setLoading(false);
    } catch (err) {
      console.error('Failed to load purchases data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Preselected vendor handling
  useEffect(() => {
    if (preselectedVendorId) {
      setVendorId(preselectedVendorId);
      setIsFormOpen(true);
      if (onClearPreselectedVendor) {
        onClearPreselectedVendor();
      }
    }
  }, [preselectedVendorId]);

  // Handle Multi-Item Rows
  const handleAddItemRow = () => {
    setPurchaseItems(prev => [
      ...prev,
      { id: 'pitem-' + Date.now() + Math.random(), itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }
    ]);
  };

  const handleQuickAddItem = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!quickItemId) {
      alert('Please select a material item first.');
      return;
    }
    const itm = items.find(i => i.id === quickItemId);
    const unit = itm ? itm.unit : 'Ton';
    const rate = quickRate > 0 ? quickRate : (itm ? itm.purchaseRate : 0);
    const qty = quickQty > 0 ? quickQty : 1;
    const amount = qty * rate;

    setPurchaseItems(prev => {
      if (prev.length === 1 && !prev[0].itemId) {
        return [{ id: 'pitem-1', itemId: quickItemId, itemName: itm?.name, quantity: qty, unit, rate, amount }];
      }
      return [
        ...prev,
        { id: 'pitem-' + Date.now() + Math.random(), itemId: quickItemId, itemName: itm?.name, quantity: qty, unit, rate, amount }
      ];
    });

    setQuickItemId('');
    setQuickQty(0);
    setQuickRate(0);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (purchaseItems.length === 1) {
      setPurchaseItems([{ id: 'pitem-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }]);
    } else {
      setPurchaseItems(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleItemChange = (idx: number, newItemId: string) => {
    const selectedItem = items.find(i => i.id === newItemId);
    setPurchaseItems(prev => {
      const copy = [...prev];
      const rate = selectedItem ? selectedItem.purchaseRate : 0;
      const unit = selectedItem ? selectedItem.unit : 'Ton';
      const qty = copy[idx].quantity;
      copy[idx] = {
        ...copy[idx],
        itemId: newItemId,
        itemName: selectedItem?.name,
        unit,
        rate,
        amount: qty * rate,
      };
      return copy;
    });
  };

  const handleQtyChange = (idx: number, newQty: number) => {
    setPurchaseItems(prev => {
      const copy = [...prev];
      const currentRate = copy[idx].rate;
      copy[idx] = {
        ...copy[idx],
        quantity: newQty,
        amount: newQty * currentRate,
      };
      return copy;
    });
  };

  const handleRateChange = (idx: number, newRate: number) => {
    setPurchaseItems(prev => {
      const copy = [...prev];
      const currentQty = copy[idx].quantity;
      copy[idx] = {
        ...copy[idx],
        rate: newRate,
        amount: currentQty * newRate,
      };
      return copy;
    });
  };

  // Calculations
  const materialTotal = purchaseItems.reduce((sum, it) => sum + (it.amount || 0), 0);
  const grandTotal = Math.max(0, materialTotal - (Number(discount) || 0));
  const effectivePaid = Number(paidAmount) || 0;
  const unpaidBalance = grandTotal - effectivePaid;

  // Selected Vendor Info & Live Ledger
  const selectedVendor = vendors.find(v => v.id === vendorId);
  const vendBalInfo = balances?.vendorBalances[vendorId] || { outstanding: 0, advance: 0 };
  const currentOutstanding = vendBalInfo.outstanding || 0; // Payable we owe vendor
  const currentAdvance = vendBalInfo.advance || 0; // Advance we gave vendor

  let projectedOutstanding = currentOutstanding;
  let projectedAdvance = currentAdvance;

  if (unpaidBalance > 0) {
    if (currentAdvance > 0) {
      if (unpaidBalance <= currentAdvance) {
        projectedAdvance = currentAdvance - unpaidBalance;
        projectedOutstanding = 0;
      } else {
        projectedAdvance = 0;
        projectedOutstanding = currentOutstanding + (unpaidBalance - currentAdvance);
      }
    } else {
      projectedOutstanding = currentOutstanding + unpaidBalance;
    }
  } else if (unpaidBalance < 0) {
    const excess = effectivePaid - grandTotal;
    if (currentOutstanding > 0) {
      if (excess <= currentOutstanding) {
        projectedOutstanding = currentOutstanding - excess;
        projectedAdvance = 0;
      } else {
        projectedOutstanding = 0;
        projectedAdvance = currentAdvance + (excess - currentOutstanding);
      }
    } else {
      projectedAdvance = currentAdvance + excess;
    }
  }

  // Open Form modal
  const handleOpenForm = (purch?: DBPurchase) => {
    if (purch) {
      setEditingId(purch.id);
      setDate(purch.date);
      setVendorId(purch.vendorId || 'walk-in-vendor');
      setVehicleNo(purch.vehicleNo || '');
      setDriverName(purch.driverName || '');
      setBiltyNo(purch.biltyNo || '');
      setLocation(purch.location || '');
      setNotes(purch.notes || '');
      setDiscount(0);
      setPaymentType(purch.paymentType);
      setBankId(purch.bankId || (banks.length > 0 ? banks[0].id : ''));

      if (purch.items && purch.items.length > 0) {
        setPurchaseItems(purch.items.map(it => ({
          id: it.id || 'pitem-' + Math.random(),
          itemId: it.itemId,
          itemName: it.itemName || items.find(i => i.id === it.itemId)?.name,
          quantity: it.quantity,
          unit: it.unit || items.find(i => i.id === it.itemId)?.unit || 'Ton',
          rate: it.rate,
          amount: it.amount || (it.quantity * it.rate),
        })));
      } else if (purch.itemId) {
        const itm = items.find(i => i.id === purch.itemId);
        setPurchaseItems([{
          id: 'pitem-1',
          itemId: purch.itemId,
          itemName: itm?.name,
          quantity: purch.quantity,
          unit: itm?.unit || 'Ton',
          rate: purch.rate,
          amount: purch.total,
        }]);
      } else {
        setPurchaseItems([{ id: 'pitem-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }]);
      }

      setPaidAmount(purch.paidAmount !== undefined ? purch.paidAmount : (purch.paymentType === 'Credit' ? 0 : purch.total));
      setIsPaidTouched(true);
    } else {
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setVendorId(preselectedVendorId || 'walk-in-vendor');
      setVehicleNo('');
      setDriverName('');
      setBiltyNo('');
      setLocation('');
      setNotes('');
      setDiscount(0);
      setPaymentType('Cash');
      setPaidAmount(0);
      setIsPaidTouched(false);
      setPurchaseItems([{ id: 'pitem-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }]);
      setQuickItemId('');
      setQuickQty(0);
      setQuickRate(0);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = purchaseItems.filter(it => it.itemId && it.quantity > 0 && it.rate > 0);
    if (validItems.length === 0) {
      alert('Please add at least one material item with a valid quantity and purchase rate.');
      return;
    }

    const effectiveVendorId = vendorId.trim() || 'walk-in-vendor';
    if (paymentType === 'Credit' && effectiveVendorId === 'walk-in-vendor' && effectivePaid === 0) {
      const confirmWalkinCredit = confirm('You are saving a 100% Credit purchase for Walk-in Vendor. This will not be tracked under a named supplier ledger. Would you like to proceed?');
      if (!confirmWalkinCredit) return;
    }

    let purchaseId = editingId;
    if (!purchaseId) {
      const prefix = 'pur-';
      const existingIds = purchases.map(p => p.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
      const nextNum = maxNum + 1;
      purchaseId = `${prefix}${String(nextNum).padStart(3, '0')}`;
    }

    const firstItem = validItems[0];
    const totalQty = validItems.reduce((sum, it) => sum + it.quantity, 0);

    const purchase: DBPurchase = {
      id: purchaseId,
      date,
      vendorId: effectiveVendorId,
      items: validItems.map(it => ({
        id: it.id,
        itemId: it.itemId,
        itemName: it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId,
        quantity: Number(it.quantity) || 0,
        unit: it.unit || 'Ton',
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || 0,
      })),
      itemId: firstItem.itemId,
      quantity: totalQty,
      rate: firstItem.rate,
      total: grandTotal,
      paidAmount: effectivePaid,
      remainingBalance: unpaidBalance,
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      vehicleNo: vehicleNo.trim() || undefined,
      driverName: driverName.trim() || undefined,
      biltyNo: biltyNo.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      await savePurchaseTransaction(purchase);
      setIsFormOpen(false);
      await loadData();
      alert(`Purchase bill ${purchaseId} recorded successfully!`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to save purchase: ' + (err?.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this purchase bill? This will reverse inventory intake and supplier financials.')) {
      await deletePurchaseTransaction(id);
      await loadData();
    }
  };

  // Print Individual Purchase Bill
  const handlePrintReceipt = (p: DBPurchase, type: 'thermal' | 'a4') => {
    setActivePrintJob({ type, data: p });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Download Purchases CSV
  const handleDownloadCSV = () => {
    const headers = ['Date', 'Bill No', 'Vendor', 'Vehicle', 'Driver', 'Bilty No', 'Items Count', 'Total Bill', 'Paid Amount', 'Due / Advance', 'Payment Type'];
    const rows = filteredPurchases.map(p => {
      const vendName = vendors.find(v => v.id === p.vendorId)?.name || p.vendorId;
      const dueOrAdv = (p.paidAmount !== undefined && p.paidAmount < p.total)
        ? `Due: Rs. ${p.total - p.paidAmount}`
        : (p.paidAmount !== undefined && p.paidAmount > p.total)
        ? `Adv: +Rs. ${p.paidAmount - p.total}`
        : 'Clear';
      return [
        p.date,
        p.id,
        `"${vendName.replace(/"/g, '""')}"`,
        `"${(p.vehicleNo || '').replace(/"/g, '""')}"`,
        `"${(p.driverName || '').replace(/"/g, '""')}"`,
        `"${(p.biltyNo || '').replace(/"/g, '""')}"`,
        p.items ? p.items.length : 1,
        p.total,
        p.paidAmount !== undefined ? p.paidAmount : p.total,
        `"${dueOrAdv}"`,
        p.paymentType,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `material_purchases_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredPurchases = purchases.filter(p => {
    if (!cleanSearch) return true;
    const vName = vendors.find(v => v.id === p.vendorId)?.name || '';
    const iName = items.find(i => i.id === p.itemId)?.name || '';
    const hasMatchingItem = p.items?.some(it => {
      const itmName = items.find(i => i.id === it.itemId)?.name || it.itemId;
      return itmName.toLowerCase().includes(cleanSearch);
    });

    return (
      vName.toLowerCase().includes(cleanSearch) ||
      iName.toLowerCase().includes(cleanSearch) ||
      Boolean(hasMatchingItem) ||
      p.id.toLowerCase().includes(cleanSearch) ||
      p.date.includes(cleanSearch) ||
      p.paymentType.toLowerCase().includes(cleanSearch) ||
      (p.vehicleNo && p.vehicleNo.toLowerCase().includes(cleanSearch)) ||
      (p.driverName && p.driverName.toLowerCase().includes(cleanSearch)) ||
      (p.biltyNo && p.biltyNo.toLowerCase().includes(cleanSearch))
    );
  });

  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return <div className="text-center py-6">Loading purchases ledger...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Print Job Engine (Visible only during window.print) */}
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
            <p className="text-xs font-black uppercase tracking-wider text-black">MATERIAL PURCHASE &amp; INTAKE BILL</p>
            <div className="flex justify-between text-xs font-bold text-black mt-1">
              <span>Bill #: {activePrintJob.data.id}</span>
              <span>Date: {activePrintJob.data.date}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs font-mono text-black border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between">
              <span className="font-semibold">Supplier:</span>
              <span className="font-bold">{vendors.find(v => v.id === activePrintJob.data.vendorId)?.name || activePrintJob.data.vendorId}</span>
            </div>
            {activePrintJob.data.vehicleNo && (
              <div className="flex justify-between">
                <span className="font-semibold">Vehicle:</span>
                <span className="font-bold">{activePrintJob.data.vehicleNo}</span>
              </div>
            )}
            {activePrintJob.data.driverName && (
              <div className="flex justify-between">
                <span className="font-semibold">Driver / Carrier:</span>
                <span className="font-bold">{activePrintJob.data.driverName}</span>
              </div>
            )}
            {activePrintJob.data.biltyNo && (
              <div className="flex justify-between">
                <span className="font-semibold">Bilty / Ref:</span>
                <span className="font-bold">{activePrintJob.data.biltyNo}</span>
              </div>
            )}
          </div>

          <table className="w-full text-left border-collapse my-2 font-mono text-xs text-black">
            <thead>
              <tr className="border-b-2 border-dashed border-black font-bold uppercase">
                <th className="py-1 text-left">Material / Item</th>
                <th className="py-1 text-right whitespace-nowrap">Qty</th>
                <th className="py-1 text-center whitespace-nowrap">Unit</th>
                <th className="py-1 text-right whitespace-nowrap">Rate</th>
                <th className="py-1 text-right whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-slate-300">
              {activePrintJob.data.items && activePrintJob.data.items.length > 0 ? (
                activePrintJob.data.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1 font-bold max-w-[85px] break-words">
                      {it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}
                    </td>
                    <td className="py-1 text-right font-bold whitespace-nowrap">{it.quantity}</td>
                    <td className="py-1 text-center font-semibold whitespace-nowrap">{it.unit}</td>
                    <td className="py-1 text-right font-semibold whitespace-nowrap">Rs. {it.rate.toLocaleString()}</td>
                    <td className="py-1 text-right font-black whitespace-nowrap">Rs. {it.amount.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-1 font-bold max-w-[85px] break-words">
                    {items.find(i => i.id === activePrintJob.data.itemId)?.name || activePrintJob.data.itemId}
                  </td>
                  <td className="py-1 text-right font-bold whitespace-nowrap">{activePrintJob.data.quantity}</td>
                  <td className="py-1 text-center font-semibold whitespace-nowrap">{items.find(i => i.id === activePrintJob.data.itemId)?.unit || 'Ton'}</td>
                  <td className="py-1 text-right font-semibold whitespace-nowrap">Rs. {activePrintJob.data.rate.toLocaleString()}</td>
                  <td className="py-1 text-right font-black whitespace-nowrap">Rs. {activePrintJob.data.total.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-dashed border-black font-bold">
                <td colSpan={3} className="py-1 text-left">
                  Total Items: {activePrintJob.data.items && activePrintJob.data.items.length > 0 ? activePrintJob.data.items.length : 1}
                </td>
                <td className="py-1 text-right font-bold">Subtotal:</td>
                <td className="py-1 text-right font-black">Rs. {activePrintJob.data.total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          <div className="space-y-1 text-xs font-mono text-black">
            <div className="flex justify-between font-black text-sm border-t-2 border-b-2 border-double border-black py-1 my-1">
              <span>Total Bill Amount:</span>
              <span>Rs. {activePrintJob.data.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1">
              <span>Paid Out ({activePrintJob.data.paymentType}):</span>
              <span className="font-black">Rs. {(activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : activePrintJob.data.total).toLocaleString()}</span>
            </div>

            {(() => {
              const paid = activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : activePrintJob.data.total;
              const diff = activePrintJob.data.total - paid;
              if (diff > 0) {
                return (
                  <div className="flex justify-between font-bold border border-black p-1 rounded mt-1 bg-slate-50">
                    <span>Remaining Due (Payable):</span>
                    <span>Rs. {diff.toLocaleString()}</span>
                  </div>
                );
              } else if (diff < 0) {
                return (
                  <div className="flex justify-between font-bold border border-black p-1 rounded mt-1 bg-slate-50">
                    <span>Overpayment (Added to Advance):</span>
                    <span>+Rs. {(-diff).toLocaleString()}</span>
                  </div>
                );
              } else {
                return (
                  <div className="flex justify-between font-bold pt-0.5">
                    <span>Payment Status:</span>
                    <span>✓ Paid in Full (Clear)</span>
                  </div>
                );
              }
            })()}
          </div>

          <div className="print-footer text-center mt-4 text-[10px] font-bold font-mono">
            Software by Roonjha Developers - 03152914836
          </div>
        </div>
      )}

      {/* A4 Printable Bill */}
      {activePrintJob && activePrintJob.type === 'a4' && (
        <div className="print-only print-a4 p-8 bg-white font-mono text-xs">
          <div className="text-center border-b border-slate-300 pb-4 mb-6">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
              <div>
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h1>
                <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul &amp; Son's (03458829298)</p>
                <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 font-bold tracking-wider uppercase mt-1">Material Purchase &amp; Supplier Restock A4 Bill</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <p className="font-bold text-slate-700">BILL DETAILS:</p>
              <p>Bill Number: <span className="font-bold">{activePrintJob.data.id}</span></p>
              <p>Date: {activePrintJob.data.date}</p>
              {activePrintJob.data.vehicleNo && <p>Vehicle: {activePrintJob.data.vehicleNo}</p>}
              {activePrintJob.data.driverName && <p>Driver: {activePrintJob.data.driverName}</p>}
              {activePrintJob.data.biltyNo && <p>Bilty / Challan: {activePrintJob.data.biltyNo}</p>}
            </div>
            <div className="space-y-1 text-right">
              <p className="font-bold text-slate-700">SUPPLIER DETAILS:</p>
              <p>Supplier Name: <span className="font-bold">{vendors.find(v => v.id === activePrintJob.data.vendorId)?.name || activePrintJob.data.vendorId}</span></p>
              <p>Phone: {vendors.find(v => v.id === activePrintJob.data.vendorId)?.phone || 'N/A'}</p>
              <p>Payment: {activePrintJob.data.paymentType}</p>
            </div>
          </div>

          <table className="min-w-full divide-y divide-slate-200 text-left mb-6 font-mono text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="px-4 py-2">Material / Item</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Quantity</th>
                <th className="px-4 py-2 text-center whitespace-nowrap">Unit</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Rate</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {activePrintJob.data.items && activePrintJob.data.items.length > 0 ? (
                activePrintJob.data.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-semibold">{it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-bold">{it.quantity}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{it.unit}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">Rs. {it.rate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap">Rs. {it.amount.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-3 font-semibold">{items.find(i => i.id === activePrintJob.data.itemId)?.name || activePrintJob.data.itemId}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-bold">{activePrintJob.data.quantity}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">{items.find(i => i.id === activePrintJob.data.itemId)?.unit || 'Ton'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">Rs. {activePrintJob.data.rate.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">Rs. {activePrintJob.data.total.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mt-4">
            <div className="w-80 space-y-1.5 border-t border-slate-300 pt-3">
              <div className="flex justify-between font-bold text-sm">
                <span>Total Bill Amount:</span>
                <span>Rs. {activePrintJob.data.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paid Out ({activePrintJob.data.paymentType}):</span>
                <span className="font-bold">Rs. {(activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : activePrintJob.data.total).toLocaleString()}</span>
              </div>
              {(() => {
                const paid = activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : activePrintJob.data.total;
                const diff = activePrintJob.data.total - paid;
                if (diff > 0) {
                  return (
                    <div className="flex justify-between text-rose-600 font-bold border-t border-slate-200 pt-1">
                      <span>Remaining Due (Payable):</span>
                      <span>Rs. {diff.toLocaleString()}</span>
                    </div>
                  );
                } else if (diff < 0) {
                  return (
                    <div className="flex justify-between text-emerald-600 font-bold border-t border-slate-200 pt-1">
                      <span>Overpayment (Advance):</span>
                      <span>+Rs. {(-diff).toLocaleString()}</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex justify-between text-emerald-600 font-bold border-t border-slate-200 pt-1">
                      <span>Status:</span>
                      <span>Paid in Full</span>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          <div className="print-footer text-center mt-12 text-slate-500 text-xs font-mono">
            Software by Roonjha Developers - 03152914836
          </div>
        </div>
      )}

      {/* Primary Workspace View */}
      <div className={`space-y-6 ${activePrintJob ? 'no-print' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Purchase Entries & Supplier Restock</h2>
            <p className="text-sm text-slate-500">Record incoming stock from suppliers, manage multi-item deliveries & cash/credit settlement</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search bill no, vendor, item..."
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
              onClick={handleDownloadCSV}
              className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm"
              title="Download purchases as CSV spreadsheet"
            >
              <Download className="h-4 w-4" />
              <span>Download CSV</span>
            </button>
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
              <span>Record New Purchase</span>
            </button>
          </div>
        </div>

        {/* Purchases List */}
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
              MATERIAL PURCHASES &amp; INVENTORY INTAKE REGISTER
            </p>
            <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
              <div>Total Purchases: {filteredPurchases.length}</div>
              <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-3 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Bill No.</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Supplier / Vendor</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Vehicle / Driver</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Items Intake</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Invoice Total</th>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap">Payment Status</th>
                    <th className="px-3 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedPurchases.map(p => {
                    const vend = vendors.find(v => v.id === p.vendorId);
                    const singleItem = items.find(i => i.id === p.itemId);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{p.date}</td>
                        <td className="px-3 py-3 font-mono font-bold text-indigo-700 whitespace-nowrap">{p.id}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="font-semibold text-slate-800 whitespace-nowrap">{vend?.name || (p.vendorId === 'walk-in-vendor' ? 'Walk-in Vendor (Spot)' : p.vendorId)}</p>
                          {vend?.phone && <p className="text-xs text-slate-400 whitespace-nowrap">{vend.phone}</p>}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {p.vehicleNo ? <p className="font-semibold text-slate-700 whitespace-nowrap">{p.vehicleNo}</p> : <p className="text-slate-400">—</p>}
                          {p.driverName && <p className="text-[11px] text-slate-400 whitespace-nowrap">{p.driverName}</p>}
                          {p.biltyNo && <p className="text-[10px] font-mono text-indigo-600 whitespace-nowrap">Ref: {p.biltyNo}</p>}
                        </td>
                        <td className="px-3 py-3">
                          {p.items && p.items.length > 0 ? (
                            <div className="space-y-1">
                              {p.items.map((it, idx) => (
                                <div key={idx} className="leading-tight text-xs whitespace-nowrap">
                                  <span className="font-semibold text-slate-700">{it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}</span>
                                  <span className="text-slate-500 ml-1.5 font-mono">({it.quantity} {it.unit} @ Rs. {it.rate.toLocaleString()})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs whitespace-nowrap">
                              <span className="font-semibold text-slate-700">{singleItem?.name || p.itemId}</span>
                              <span className="text-slate-500 ml-1.5 font-mono">({p.quantity} {singleItem?.unit || 'Ton'} @ Rs. {p.rate.toLocaleString()})</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          <p className="whitespace-nowrap">Rs. {p.total.toLocaleString()}</p>
                          {p.paidAmount !== undefined && p.paidAmount < p.total ? (
                            <p className="text-[10px] text-rose-600 font-bold whitespace-nowrap">
                              Paid: Rs. {p.paidAmount.toLocaleString()} • Due: Rs. {(p.total - p.paidAmount).toLocaleString()}
                            </p>
                          ) : p.paidAmount !== undefined && p.paidAmount > p.total ? (
                            <p className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">
                              Paid: Rs. {p.paidAmount.toLocaleString()} • Adv: +Rs. {(p.paidAmount - p.total).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{p.paymentType}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                            p.paidAmount !== undefined && p.paidAmount < p.total
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {p.paymentType} {p.paidAmount !== undefined && p.paidAmount < p.total ? '(Partial)' : ''}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right space-x-2 whitespace-nowrap no-print">
                          <button
                            onClick={() => setActiveViewPurchase(p)}
                            className="text-slate-400 hover:text-indigo-600 transition"
                            title="View Details"
                          >
                            <FileText className="h-4 w-4 inline" />
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(p, 'thermal')}
                            className="text-slate-400 hover:text-slate-600 transition"
                            title="Print Thermal Bill"
                          >
                            <Printer className="h-4 w-4 inline" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(p)}
                            className="text-slate-400 hover:text-indigo-600 transition"
                            title="Edit Purchase Bill"
                          >
                            <Edit className="h-4 w-4 inline" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-rose-600 transition"
                            title="Delete Purchase Bill"
                          >
                            <Trash className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <ShoppingBag className="h-10 w-10 mx-auto mb-2 stroke-1" />
                        <p className="text-sm font-medium">
                          {searchQuery ? `No matching purchases found for "${searchQuery}".` : 'No purchase bills logged. Register incoming material restocks.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredPurchases.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm border-t border-slate-700 font-mono">
                    <tr>
                      <td colSpan={5} className="px-6 py-3 text-right font-black">Grand Totals ({filteredPurchases.length} bills):</td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-black">
                        Rs. {filteredPurchases.reduce((sum, p) => sum + p.total, 0).toLocaleString()}
                      </td>
                      <td colSpan={2} className="no-print"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredPurchases.length}
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

      {/* Purchase Details Modal */}
      {activeViewPurchase && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 no-print p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-base">Purchase Bill Details — {activeViewPurchase.id}</h3>
              </div>
              <button onClick={() => setActiveViewPurchase(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block font-medium">Date</span>
                  <span className="font-bold text-slate-800">{activeViewPurchase.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Supplier / Vendor</span>
                  <span className="font-bold text-slate-800">
                    {vendors.find(v => v.id === activeViewPurchase.vendorId)?.name || activeViewPurchase.vendorId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Payment Mode</span>
                  <span className="font-bold text-indigo-700">{activeViewPurchase.paymentType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Vehicle No.</span>
                  <span className="font-semibold text-slate-700">{activeViewPurchase.vehicleNo || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Driver / Carrier</span>
                  <span className="font-semibold text-slate-700">{activeViewPurchase.driverName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Bilty / Reference #</span>
                  <span className="font-semibold text-slate-700">{activeViewPurchase.biltyNo || '—'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Purchased Items Breakdown</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-100 font-bold text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2 text-right">Rate (Rs.)</th>
                        <th className="px-3 py-2 text-right">Amount (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeViewPurchase.items && activeViewPurchase.items.length > 0 ? (
                        activeViewPurchase.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-medium text-slate-800">{it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}</td>
                            <td className="px-3 py-2 text-right font-mono">{it.quantity} {it.unit}</td>
                            <td className="px-3 py-2 text-right font-mono">Rs. {it.rate.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-bold font-mono text-slate-800">Rs. {it.amount.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-2 font-medium text-slate-800">{items.find(i => i.id === activeViewPurchase.itemId)?.name || activeViewPurchase.itemId}</td>
                          <td className="px-3 py-2 text-right font-mono">{activeViewPurchase.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono">Rs. {activeViewPurchase.rate.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-bold font-mono text-slate-800">Rs. {activeViewPurchase.total.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between font-bold">
                  <span>Grand Total Bill:</span>
                  <span className="text-emerald-400 font-mono text-base">Rs. {activeViewPurchase.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Paid on Spot ({activeViewPurchase.paymentType}):</span>
                  <span className="font-mono font-bold">Rs. {(activeViewPurchase.paidAmount !== undefined ? activeViewPurchase.paidAmount : activeViewPurchase.total).toLocaleString()}</span>
                </div>
                {(() => {
                  const paid = activeViewPurchase.paidAmount !== undefined ? activeViewPurchase.paidAmount : activeViewPurchase.total;
                  const diff = activeViewPurchase.total - paid;
                  if (diff > 0) {
                    return (
                      <div className="flex justify-between text-xs text-rose-300 font-bold border-t border-slate-700 pt-1.5">
                        <span>Remaining Due (Payable):</span>
                        <span className="font-mono">Rs. {diff.toLocaleString()}</span>
                      </div>
                    );
                  } else if (diff < 0) {
                    return (
                      <div className="flex justify-between text-xs text-emerald-300 font-bold border-t border-slate-700 pt-1.5">
                        <span>Overpayment (Added to Advance):</span>
                        <span className="font-mono">+Rs. {(-diff).toLocaleString()}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                onClick={() => handlePrintReceipt(activeViewPurchase, 'thermal')}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition flex items-center space-x-1"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Thermal Bill</span>
              </button>
              <button
                onClick={() => handlePrintReceipt(activeViewPurchase, 'a4')}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center space-x-1"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>A4 Bill</span>
              </button>
              <button
                onClick={() => setActiveViewPurchase(null)}
                className="px-4 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal: Modern 2-Column Purchase Intake (Matching TripEntry Layout & Logic) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 no-print p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl md:max-w-6xl max-h-[94vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingId ? `Edit Purchase Bill (${editingId})` : 'New Material Purchase & Supplier Intake Bill'}
                  </h3>
                  <p className="text-xs text-slate-400">Record incoming stock, supplier bills, payment mode & vendor accounting</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Top Section: 2 Columns (Purchase Logistics vs Golden Vendor Card) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column (7 cols): Purchase Logistics, Reference & Transport */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Purchase Date
                      </label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Vehicle No. (Optional)
                      </label>
                      <SearchableSelect
                        options={[
                          {
                            value: '',
                            label: '-- Supplier Delivery / Direct / Unassigned --',
                            subLabel: 'Direct delivery or third-party carrier',
                            searchTerms: 'direct none third party supplier delivery',
                          },
                          ...vehicles.filter(v => v.active).map(v => ({
                            value: v.number,
                            label: `${v.number} (${v.type})`,
                            subLabel: v.driver ? `Driver: ${v.driver}` : undefined,
                            badge: v.type,
                            badgeColor: 'indigo' as const,
                            searchTerms: `${v.number} ${v.type} ${v.driver || ''}`,
                          }))
                        ]}
                        value={vehicleNo}
                        onChange={val => {
                          setVehicleNo(val);
                          const veh = vehicles.find(v => v.number === val);
                          if (veh && veh.driver) {
                            setDriverName(veh.driver);
                          }
                        }}
                        placeholder="-- Choose Vehicle (Optional) --"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Driver / Transporter (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Driver Name"
                        value={driverName}
                        onChange={e => setDriverName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Bilty / Invoice # (Optional)
                      </label>
                      <input
                        type="text"
                        value={biltyNo}
                        onChange={e => setBiltyNo(e.target.value)}
                        placeholder="e.g. Bilty-890"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Warehouse / Yard (Optional)
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="e.g. Yard 1 / Quarry"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Discount Received (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={discount === 0 ? '' : discount}
                        onChange={e => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Bill Remarks / Notes (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Quality checked / Weighbridge ref"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Dedicated Vendor Profile (Golden Card) */}
                <div className="lg:col-span-5 bg-gradient-to-br from-amber-50 to-amber-100/70 border-2 border-amber-300 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3.5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/90 pb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-amber-950">Supplier / Vendor Profile</h4>
                          <p className="text-[11px] text-amber-800/80">Account details & live ledger balance</p>
                        </div>
                      </div>

                      {/* Live Balance Tag */}
                      <div>
                        {currentOutstanding > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-sm animate-pulse">
                            Payable: Rs. {currentOutstanding.toLocaleString()}
                          </span>
                        ) : currentAdvance > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                            Advance: Rs. {currentAdvance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Clear: Rs. 0
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vendor Selection */}
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">
                        Select Supplier (Optional: Defaults to Walk-in)
                      </label>
                      <SearchableSelect
                        options={[
                          {
                            value: 'walk-in-vendor',
                            label: 'Walk-in Vendor (Spot Supplier)',
                            subLabel: 'Counter / Spot Purchase',
                            searchTerms: 'walk in walkin spot supplier general',
                          },
                          ...vendors.filter(v => v.id !== 'walk-in-vendor').map(v => {
                            const bal = balances?.vendorBalances[v.id] || { outstanding: 0, advance: 0 };
                            const curBal = bal.outstanding > 0 ? bal.outstanding : bal.advance;
                            const status = bal.outstanding > 0 ? 'Payable' : (bal.advance > 0 ? 'Advance' : 'Clear');
                            const badgeColor = bal.outstanding > 0 ? 'rose' : (bal.advance > 0 ? 'emerald' : 'slate');
                            return {
                              value: v.id,
                              label: v.name,
                              subLabel: `${v.phone ? `Ph: ${v.phone}` : ''}${v.address ? ` • ${v.address}` : ''}`,
                              badge: `Rs. ${curBal.toLocaleString()} (${status})`,
                              badgeColor: badgeColor as any,
                              searchTerms: `${v.name} ${v.id} ${v.phone || ''} ${v.address || ''}`,
                            };
                          })
                        ]}
                        value={vendorId}
                        onChange={val => setVendorId(val)}
                        placeholder="-- Search or Pick Supplier --"
                      />
                    </div>

                    {/* Vendor Info Box */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-white/90 p-2.5 rounded-lg border border-amber-200/80 text-amber-950">
                      <div>
                        <span className="text-amber-800/70 block text-[10px] uppercase font-bold">Phone Number</span>
                        <span className="font-semibold">{selectedVendor?.phone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-amber-800/70 block text-[10px] uppercase font-bold">Area / Address</span>
                        <span className="font-semibold">{selectedVendor?.area || selectedVendor?.address || '—'}</span>
                      </div>
                    </div>

                    {/* Payment Mode & Amount Paid Section */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-amber-950">
                          Payment Mode
                        </label>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Bill: </span>
                          <span className="text-xs font-black text-indigo-700">Rs. {grandTotal.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentType('Cash');
                            if (!isPaidTouched) setPaidAmount(grandTotal);
                          }}
                          className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition flex flex-col items-center justify-center space-y-0.5 ${
                            paymentType === 'Cash'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          <span className="text-sm">💵</span>
                          <span>Pay as Cash</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPaymentType('Credit');
                            if (!isPaidTouched) setPaidAmount(0);
                          }}
                          className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition flex flex-col items-center justify-center space-y-0.5 ${
                            paymentType === 'Credit'
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          <span className="text-sm">📋</span>
                          <span>Pay on Credit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPaymentType('Bank');
                            if (!isPaidTouched) setPaidAmount(grandTotal);
                          }}
                          className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition flex flex-col items-center justify-center space-y-0.5 ${
                            paymentType === 'Bank'
                              ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          <span className="text-sm">🏦</span>
                          <span>Bank Payout</span>
                        </button>
                      </div>
                    </div>

                    {/* Target Bank selector if Bank payment */}
                    {paymentType === 'Bank' && (
                      <div className="bg-white/95 p-2.5 rounded-lg border border-cyan-300 space-y-1">
                        <label className="block text-xs font-bold text-cyan-950">
                          Source Bank Account
                        </label>
                        <select
                          value={bankId}
                          onChange={e => setBankId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-cyan-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-cyan-500"
                        >
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.accountNumber || 'Account'})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Cash Paid / Amount Paid Input Box */}
                    <div className="bg-white p-3 rounded-lg border-2 border-amber-300/90 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                          Amount Paid / Cash Paid to Vendor (Rs.)
                        </label>
                        <div className="flex space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPaidAmount(grandTotal);
                              setIsPaidTouched(true);
                            }}
                            className="px-2 py-0.5 text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold border border-emerald-300 transition"
                            title="Pay exact full bill"
                          >
                            Full: Rs. {grandTotal.toLocaleString()}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaidAmount(0);
                              setIsPaidTouched(true);
                            }}
                            className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold border border-slate-300 transition"
                            title="Zero paid (All credit)"
                          >
                            Rs. 0
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">Rs.</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={paidAmount === 0 ? '' : paidAmount}
                          onChange={e => {
                            setPaidAmount(e.target.value === '' ? 0 : Number(e.target.value));
                            setIsPaidTouched(true);
                          }}
                          className="w-full pl-10 pr-3 py-2 border-2 border-indigo-300 rounded-lg text-base font-black text-indigo-900 focus:outline-none focus:border-indigo-600 bg-white"
                        />
                      </div>

                      {/* Remaining Balance & Advance Calculation Display */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        {paidAmount < grandTotal ? (
                          <>
                            <span className="text-slate-600 font-medium">Remaining Unpaid (Payable / Credit):</span>
                            <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Rs. {(grandTotal - paidAmount).toLocaleString()}
                            </span>
                          </>
                        ) : paidAmount > grandTotal ? (
                          <>
                            <span className="text-emerald-700 font-semibold">Extra Overpayment (Advance to Vendor):</span>
                            <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              +Rs. {(paidAmount - grandTotal).toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-emerald-700 font-medium">Payment Status:</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ✓ Paid in Full (Remaining: Rs. 0)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Real-time Ledger Impact Projection */}
                  <div className="p-2.5 rounded-lg text-xs border font-medium">
                    {paidAmount < grandTotal ? (
                      selectedVendor && selectedVendor.id !== 'walk-in-vendor' ? (
                        currentAdvance > 0 ? (
                          (grandTotal - paidAmount) <= currentAdvance ? (
                            <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 p-2 rounded flex items-start space-x-2">
                              <UserCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-bold">Using Existing Vendor Advance</p>
                                <p className="text-[11px] text-emerald-800">
                                  Unpaid balance of Rs. {(grandTotal - paidAmount).toLocaleString()} will be deducted from your advance with this vendor (Rs. {currentAdvance.toLocaleString()}). Remaining advance: <span className="font-bold text-emerald-900">Rs. {projectedAdvance.toLocaleString()}</span>.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-amber-50 text-amber-950 border border-amber-300 p-2 rounded flex items-start space-x-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-bold">Advance Depleted + Payable Added</p>
                                <p className="text-[11px] text-amber-900">
                                  Unpaid balance (Rs. {(grandTotal - paidAmount).toLocaleString()}) uses all Rs. {currentAdvance.toLocaleString()} advance. Remaining <span className="font-bold text-rose-700">Rs. {(grandTotal - paidAmount - currentAdvance).toLocaleString()}</span> increases Outstanding Payable owed to vendor.
                                </p>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="bg-rose-50 text-rose-950 border border-rose-300 p-2 rounded flex items-start space-x-2">
                            <ShieldAlert className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold">Credit Purchase (Added to Payable)</p>
                              <p className="text-[11px] text-rose-800">
                                Unpaid balance of Rs. {(grandTotal - paidAmount).toLocaleString()} increases your Outstanding Payable owed to vendor. New Payable: <span className="font-bold text-rose-900">Rs. {projectedOutstanding.toLocaleString()}</span>.
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="bg-amber-50 text-amber-900 border border-amber-300 p-2 rounded flex items-start space-x-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-[11px]">
                            <span className="font-bold">Walk-in Vendor:</span> Rs. {paidAmount.toLocaleString()} paid. Remaining Rs. {(grandTotal - paidAmount).toLocaleString()} unpaid. Select a registered supplier account to track this credit balance.
                          </p>
                        </div>
                      )
                    ) : paidAmount > grandTotal ? (
                      selectedVendor && selectedVendor.id !== 'walk-in-vendor' ? (
                        <div className="bg-emerald-50 text-emerald-950 border border-emerald-300 p-2 rounded flex items-start space-x-2">
                          <UserCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold">Excess Payment Goes to Vendor Advance</p>
                            <p className="text-[11px] text-emerald-800">
                              You paid Rs. {(paidAmount - grandTotal).toLocaleString()} extra cash. This excess will be credited to your account as Advance with the vendor. New Advance: <span className="font-bold text-emerald-900">Rs. {projectedAdvance.toLocaleString()}</span>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-950 border border-emerald-300 p-2 rounded flex items-start space-x-2">
                          <Wallet className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <p className="text-[11px]">
                            <span className="font-bold">Walk-in Overpayment:</span> You paid Rs. {(paidAmount - grandTotal).toLocaleString()} extra.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="bg-white/90 text-slate-700 border border-amber-200/90 p-2 rounded flex items-center space-x-2">
                        <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-[11px]">
                          <span className="font-bold text-slate-800">Full Payment Settled:</span> Rs. {paidAmount.toLocaleString()} paid out on spot. Supplier ledger balance remains unaffected.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle Section: Dynamic Purchased Materials Table & Quick Add */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                    <h4 className="text-sm font-bold text-slate-800">Purchased Material Items</h4>
                    <span className="text-xs text-slate-500 font-mono">({purchaseItems.length} {purchaseItems.length === 1 ? 'item' : 'items'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm self-start sm:self-auto"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add Item Row</span>
                  </button>
                </div>

                {/* Quick Add Material Bar */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Select Material Item to Add
                      </label>
                      <SearchableSelect
                        options={items.map(i => {
                          const st = balances?.itemStocks[i.id] !== undefined ? balances.itemStocks[i.id] : i.currentStock;
                          return {
                            value: i.id,
                            label: `${i.name} (${i.unit})`,
                            subLabel: `Current Stock: ${st.toLocaleString()} ${i.unit}`,
                            badge: `Buy: Rs. ${i.purchaseRate.toLocaleString()} / ${i.unit}`,
                            badgeColor: 'indigo',
                            searchTerms: `${i.name} ${i.id} ${i.unit}`,
                          };
                        })}
                        value={quickItemId}
                        onChange={val => {
                          setQuickItemId(val);
                          const itm = items.find(i => i.id === val);
                          if (itm) setQuickRate(itm.purchaseRate);
                        }}
                        placeholder="-- Choose Material to Add --"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0"
                        value={quickQty === 0 ? '' : quickQty}
                        onChange={e => setQuickQty(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-indigo-500 bg-white text-right"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Buy Rate (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={quickRate === 0 ? '' : quickRate}
                        onChange={e => setQuickRate(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-indigo-500 bg-white text-right"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleQuickAddItem}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center space-x-1.5 h-9"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add to Purchase Table</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Intake Table */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-bold">
                      <tr>
                        <th className="px-3 py-2.5 text-left w-12">#</th>
                        <th className="px-3 py-2.5 text-left">Material Item</th>
                        <th className="px-3 py-2.5 text-left w-24">Unit</th>
                        <th className="px-3 py-2.5 text-right w-28">Quantity</th>
                        <th className="px-3 py-2.5 text-right w-28">Buy Rate (Rs.)</th>
                        <th className="px-3 py-2.5 text-right w-36">Amount (Rs.)</th>
                        <th className="px-3 py-2.5 text-center w-14">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {purchaseItems.map((itemRow, idx) => (
                        <tr key={itemRow.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-slate-400 font-mono text-xs font-bold">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <select
                              value={itemRow.itemId}
                              onChange={e => handleItemChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="">-- Choose Material Item --</option>
                              {items.map(i => {
                                const st = balances?.itemStocks[i.id] !== undefined ? balances.itemStocks[i.id] : i.currentStock;
                                return (
                                  <option key={i.id} value={i.id}>
                                    {i.name} ({i.unit}) — Stock: {st.toLocaleString()} | Buy: Rs. {i.purchaseRate.toLocaleString()}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-slate-600 font-semibold text-xs">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{itemRow.unit}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={itemRow.quantity === 0 ? '' : itemRow.quantity}
                              onChange={e => handleQtyChange(idx, e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-right text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={itemRow.rate === 0 ? '' : itemRow.rate}
                              onChange={e => handleRateChange(idx, e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-right text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800 font-mono text-xs">
                            Rs. {itemRow.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition"
                              title="Remove item"
                            >
                              <Trash className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer Summary */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Materials Total:</span>
                    <span className="font-bold text-slate-100 text-sm font-mono">Rs. {materialTotal.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div>
                      <span className="text-slate-400 block font-medium">Discount Received:</span>
                      <span className="font-bold text-emerald-400 text-sm font-mono">-Rs. {discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-l border-slate-700 pl-4">
                    <span className="text-indigo-300 block font-bold uppercase tracking-wider text-[10px]">Net Total Bill:</span>
                    <span className="font-black text-indigo-400 text-lg font-mono">Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="border-l border-slate-700 pl-4">
                    <span className="text-slate-400 block font-medium">Paid on Spot:</span>
                    <span className="font-bold text-emerald-400 text-sm font-mono">Rs. {effectivePaid.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition shadow-md"
                  >
                    {editingId ? 'Save Bill Changes' : 'Record Purchase Intake'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
