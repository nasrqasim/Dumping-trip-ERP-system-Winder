import React, { useEffect, useState } from 'react';
import { getAllRecords, DBSale, DBCustomer, DBItem, DBBank, DBVendor, DBVehicle, DBStaff, DBDieselTransaction } from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveSaleTransaction, saveDieselTransaction } from '../db/transactions';
import { ShoppingCart, User, Plus, Search, Trash, Printer, History, Fuel, Truck, CheckCircle } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

interface POSCounterProps {
  preselectedCustomerId?: string;
  onClearPreselectedCustomer?: () => void;
}

export default function POSCounter({ preselectedCustomerId, onClearPreselectedCustomer }: POSCounterProps) {
  const [items, setItems] = useState<DBItem[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  // Dedicated POS Diesel / Vehicle Fueling State
  const [includeDiesel, setIncludeDiesel] = useState(false);
  const [dieselVehicleId, setDieselVehicleId] = useState('');
  const [dieselDriverName, setDieselDriverName] = useState('');
  const [dieselVendorId, setDieselVendorId] = useState('');
  const [dieselLitres, setDieselLitres] = useState<number | ''>('');
  const [dieselRate, setDieselRate] = useState<number | ''>(280);
  const [dieselTotal, setDieselTotal] = useState<number>(0);
  const [dieselSlipNo, setDieselSlipNo] = useState('');
  const [dieselPaymentType, setDieselPaymentType] = useState<'Credit' | 'Cash' | 'Bank'>('Credit');
  const [dieselBankId, setDieselBankId] = useState('');

  const handleDieselChange = (newLitres: number | '', newRate: number | '') => {
    setDieselLitres(newLitres);
    setDieselRate(newRate);
    if (typeof newLitres === 'number' && typeof newRate === 'number' && newLitres > 0 && newRate > 0) {
      setDieselTotal(Math.round(newLitres * newRate));
    } else {
      setDieselTotal(0);
    }
  };

  // Sales History List & Printing States
  const [sales, setSales] = useState<DBSale[]>([]);
  const [historyStartDate, setHistoryStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [historyEndDate, setHistoryEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [historyCustomerId, setHistoryCustomerId] = useState('all');
  const [activeViewSale, setActiveViewSale] = useState<DBSale | null>(null);
  const [activePrintJob, setActivePrintJob] = useState<{ type: 'thermal' | 'a4'; data: DBSale } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Form State
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [rate, setRate] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit' | 'Advance'>('Cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isPaidTouched, setIsPaidTouched] = useState<boolean>(false);
  const [bankId, setBankId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Last print slip state
  const [lastSavedSale, setLastSavedSale] = useState<DBSale | null>(null);

  const loadData = async () => {
    try {
      const [allItems, allCustomers, allBanks, allSales, allVendors, allVehicles, allStaff] = await Promise.all([
        getAllRecords<DBItem>('items'),
        getAllRecords<DBCustomer>('customers'),
        getAllRecords<DBBank>('banks'),
        getAllRecords<DBSale>('sales'),
        getAllRecords<DBVendor>('vendors'),
        getAllRecords<DBVehicle>('vehicles'),
        getAllRecords<DBStaff>('staff')
      ]);

      setItems(allItems);
      setCustomers(allCustomers);
      setBanks(allBanks);
      setVendors(allVendors);
      setVehicles(allVehicles);
      setStaffList(allStaff);
      if (allBanks.length > 0 && !bankId) {
        setBankId(allBanks[0].id);
      }
      if (allBanks.length > 0 && !dieselBankId) {
        setDieselBankId(allBanks[0].id);
      }

      allSales.sort((a, b) => b.id.localeCompare(a.id));
      setSales(allSales);

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Preselected customer handling
  useEffect(() => {
    if (preselectedCustomerId) {
      setCustomerId(preselectedCustomerId);
      if (onClearPreselectedCustomer) {
        onClearPreselectedCustomer();
      }
    }
  }, [preselectedCustomerId]);

  useEffect(() => {
    if (itemId) {
      const selectedItem = items.find(i => i.id === itemId);
      if (selectedItem) {
        setRate(selectedItem.saleRate);
      }
    }
  }, [itemId, items]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCustomerId = customerId.trim() || 'walk-in';

    if (paymentType === 'Credit' && effectiveCustomerId === 'walk-in') {
      alert('Credit payment requires selecting a registered customer account. For walk-in customers, please select Cash or Bank.');
      return;
    }
    if (!itemId) {
      alert('Please select a Material / Item to bill.');
      return;
    }
    const numQty = Number(quantity) || 0;
    const numRate = Number(rate) || 0;

    if (numQty <= 0) {
      alert('Please specify a valid billing quantity greater than 0.');
      return;
    }
    if (numRate <= 0) {
      alert('Please enter a valid price rate.');
      return;
    }

    const materialTotal = Math.round(numQty * numRate * 100) / 100;
    const total = Math.max(0, materialTotal - (Number(discount) || 0));

    const prefix = 'pos-';
    const existingIds = sales.map(s => s.id).filter(id => id.startsWith(prefix));
    let maxNum = 0;
    for (const id of existingIds) {
      const numPart = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
    const nextNum = maxNum + 1;
    const saleId = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const finalPaid = paymentType === 'Credit' 
      ? (isPaidTouched ? Number(paidAmount) || 0 : 0)
      : (paymentType === 'Advance' ? 0 : (isPaidTouched ? Number(paidAmount) || 0 : total));

    const sale: DBSale = {
      id: saleId,
      date: new Date().toISOString().split('T')[0],
      customerId: effectiveCustomerId,
      itemId,
      quantity: numQty,
      rate: numRate,
      discount: Number(discount) || 0,
      total: Number(total) || 0,
      paidAmount: finalPaid,
      remainingBalance: (Number(total) || 0) - finalPaid,
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
    };

    try {
      await saveSaleTransaction(sale);

      // If diesel option was enabled, automatically save to diesel_transactions
      if (includeDiesel && dieselTotal > 0) {
        const dieselTxId = `dsl-${saleId}`;
        const selectedPump = vendors.find(v => v.id === dieselVendorId);
        const selectedVeh = vehicles.find(v => v.id === dieselVehicleId);
        const dieselTx: DBDieselTransaction = {
          id: dieselTxId,
          date: new Date().toISOString().split('T')[0],
          vehicleId: dieselVehicleId.trim() || 'unassigned',
          vehicleNumber: selectedVeh?.number || dieselVehicleId || undefined,
          driverName: dieselDriverName.trim() || undefined,
          vendorId: dieselVendorId || 'walk-in-pump',
          vendorName: selectedPump?.name || 'Fuel Pump',
          fuelPumpName: selectedPump?.name || 'Fuel Pump',
          slipNo: dieselSlipNo.trim() || undefined,
          litres: Number(dieselLitres) || 0,
          ratePerLitre: Number(dieselRate) || 0,
          totalAmount: dieselTotal,
          paidAmount: dieselPaymentType === 'Credit' ? 0 : dieselTotal,
          remainingBalance: dieselPaymentType === 'Credit' ? dieselTotal : 0,
          paymentType: dieselPaymentType,
          bankId: dieselPaymentType === 'Bank' ? dieselBankId : undefined,
          fuelType: 'Diesel',
          tripId: saleId,
          notes: `POS Sale ${saleId} Fuel Log`
        };
        await saveDieselTransaction(dieselTx);
      }

      setLastSavedSale(sale);
      
      // Reset Form
      setQuantity('');
      setDiscount(0);
      setPaidAmount(0);
      setIsPaidTouched(false);
      setIncludeDiesel(false);
      setDieselVehicleId('');
      setDieselDriverName('');
      setDieselVendorId('');
      setDieselLitres('');
      setDieselRate(280);
      setDieselTotal(0);
      setDieselSlipNo('');
      setDieselPaymentType('Credit');

      alert('POS Counter Sale completed successfully!');
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save POS sale: ' + (err?.message || err));
    }
  };

  const handlePrintSlip = () => {
    if (lastSavedSale) {
      setActivePrintJob({ type: 'thermal', data: lastSavedSale });
      setTimeout(() => {
        window.print();
        setActivePrintJob(null);
      }, 150);
    }
  };

  const selectedItemObj = items.find(i => i.id === itemId);
  const selectedCustObj = customers.find(c => c.id === customerId);

  const subtotal = (Number(quantity) || 0) * (Number(rate) || 0);
  const grandTotal = subtotal - discount;

  // Filter items list by search query
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSales = sales.filter(s => {
    const dateMatch = s.date >= historyStartDate && s.date <= historyEndDate;
    const custMatch = historyCustomerId === 'all' || s.customerId === historyCustomerId;
    return dateMatch && custMatch;
  });

  const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return <div className="text-center py-6">Loading POS Counter...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Print Job Engine (Only visible during window.print) */}
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
            <p className="text-xs font-black uppercase tracking-wider text-black">POS SALES INVOICE</p>
            <div className="flex justify-between text-xs font-bold text-black mt-1">
              <span>Invoice #: {activePrintJob.data.id}</span>
              <span>Date: {activePrintJob.data.date}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs font-mono text-black border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between">
              <span className="font-semibold">Customer:</span>
              <span className="font-bold">{customers.find(c => c.id === activePrintJob.data.customerId)?.name || (activePrintJob.data.customerId === 'walk-in' ? 'Walk-in Customer' : activePrintJob.data.customerId)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Payment Mode:</span>
              <span className="font-bold">{activePrintJob.data.paymentType}</span>
            </div>
          </div>
            
          <table className="w-full text-left border-collapse my-2 font-mono text-xs text-black">
            <thead>
              <tr className="border-b-2 border-dashed border-black font-bold uppercase">
                <th className="py-1 text-left">Item Description</th>
                <th className="py-1 text-right whitespace-nowrap">Qty</th>
                <th className="py-1 text-center whitespace-nowrap">Unit</th>
                <th className="py-1 text-right whitespace-nowrap">Rate</th>
                <th className="py-1 text-right whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-slate-300">
              <tr>
                <td className="py-1 font-bold max-w-[85px] break-words">
                  {items.find(i => i.id === activePrintJob.data.itemId)?.name || activePrintJob.data.itemId}
                </td>
                <td className="py-1 text-right font-bold whitespace-nowrap">{activePrintJob.data.quantity}</td>
                <td className="py-1 text-center font-semibold whitespace-nowrap">
                  {items.find(i => i.id === activePrintJob.data.itemId)?.unit || '—'}
                </td>
                <td className="py-1 text-right font-semibold whitespace-nowrap">Rs. {activePrintJob.data.rate.toLocaleString()}</td>
                <td className="py-1 text-right font-black whitespace-nowrap">
                  Rs. {(activePrintJob.data.quantity * activePrintJob.data.rate).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-1 text-xs font-mono text-black">
            <div className="flex justify-between font-semibold">
              <span>Subtotal:</span>
              <span>Rs. {(activePrintJob.data.quantity * activePrintJob.data.rate).toLocaleString()}</span>
            </div>
            {activePrintJob.data.discount > 0 && (
              <div className="flex justify-between font-bold">
                <span>Discount Allowed:</span>
                <span>-Rs. {(activePrintJob.data.discount || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm border-t-2 border-b-2 border-double border-black py-1 my-1">
              <span>NET TOTAL:</span>
              <span>Rs. {activePrintJob.data.total.toLocaleString()}</span>
            </div>

            {(() => {
              const p = activePrintJob.data.paidAmount !== undefined 
                ? activePrintJob.data.paidAmount 
                : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.total : 0);
              const diff = activePrintJob.data.total - p;
              return (
                <>
                  <div className="flex justify-between font-semibold pt-1">
                    <span>Paid Amount:</span>
                    <span className="font-black">Rs. {p.toLocaleString()}</span>
                  </div>
                  {diff > 0 ? (
                    <div className="flex justify-between font-bold border border-black p-1 rounded mt-1 bg-slate-50">
                      <span>Remaining Outstanding:</span>
                      <span>Rs. {diff.toLocaleString()}</span>
                    </div>
                  ) : diff < 0 ? (
                    <div className="flex justify-between font-bold border border-black p-1 rounded mt-1 bg-slate-50">
                      <span>Advance Credited:</span>
                      <span>+Rs. {(-diff).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between font-bold pt-0.5">
                      <span>Payment Status:</span>
                      <span>✓ Fully Paid (Clear)</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="print-footer text-center mt-4 text-[10px] font-bold font-mono">
            Software by Roonjha Developers - 03152914836
          </div>
        </div>
      )}

      {activePrintJob && activePrintJob.type === 'a4' && (
        <div className="print-only print-a4 p-8 bg-white font-mono text-xs">
          <div className="text-center border-b border-slate-300 pb-4 mb-6">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
              <div>
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h1>
                <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul & Son's (03458829298)</p>
                <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
              </div>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">POS Billing Invoice</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <p className="font-bold text-slate-700">INVOICE DETAILS:</p>
              <p>Invoice No: <span className="font-bold">{activePrintJob.data.id}</span></p>
              <p>Invoice Date: {activePrintJob.data.date}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="font-bold text-slate-700">CUSTOMER DETAILS:</p>
              <p>Name: <span className="font-bold">{customers.find(c => c.id === activePrintJob.data.customerId)?.name || (activePrintJob.data.customerId === 'walk-in' ? 'Walk-in Customer' : activePrintJob.data.customerId)}</span></p>
              <p>Phone: {customers.find(c => c.id === activePrintJob.data.customerId)?.phone || 'N/A'}</p>
            </div>
          </div>

          <table className="min-w-full divide-y divide-slate-200 text-left mb-6 font-mono text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="px-4 py-2">Item Description</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Quantity</th>
                <th className="px-4 py-2 whitespace-nowrap">Unit</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Rate</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr>
                <td className="px-4 py-3 font-semibold">{items.find(i => i.id === activePrintJob.data.itemId)?.name || activePrintJob.data.itemId}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-bold">{activePrintJob.data.quantity}</td>
                <td className="px-4 py-3 whitespace-nowrap">{items.find(i => i.id === activePrintJob.data.itemId)?.unit || '—'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">Rs. {activePrintJob.data.rate.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-bold whitespace-nowrap">Rs. {(activePrintJob.data.quantity * activePrintJob.data.rate).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mt-4">
            <div className="w-80 space-y-1.5 border-t border-slate-300 pt-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {(activePrintJob.data.quantity * activePrintJob.data.rate).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Discount Allowed:</span>
                <span>-Rs. {(activePrintJob.data.discount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-sm">
                <span>Grand Total:</span>
                <span>Rs. {activePrintJob.data.total.toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-100 my-1"></div>
              {(() => {
                const p = activePrintJob.data.paidAmount !== undefined 
                  ? activePrintJob.data.paidAmount 
                  : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.total : 0);
                const diff = activePrintJob.data.total - p;
                return (
                  <>
                    <div className="flex justify-between font-semibold">
                      <span>Paid Amount (Via {activePrintJob.data.paymentType}):</span>
                      <span>Rs. {p.toLocaleString()}</span>
                    </div>
                    {diff > 0 ? (
                      <div className="flex justify-between text-rose-600 font-bold">
                        <span>Remaining Outstanding:</span>
                        <span>Rs. {diff.toLocaleString()}</span>
                      </div>
                    ) : diff < 0 ? (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Customer Advance Credited:</span>
                        <span>+Rs. {(-diff).toLocaleString()}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Payment Status:</span>
                        <span>Fully Paid (Clear)</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="print-footer text-center mt-12 text-slate-500 text-xs">
            Software by Roonjha Developers - 03152914836
          </div>
        </div>
      )}

      {/* Primary POS UI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Left Search & Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-indigo-600" />
              <span>Checkout Register</span>
            </h3>

            {/* Quick Material selector */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Search Item
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search Mitti, Rait, Bajri..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setItemId(item.id);
                      setRate(item.saleRate);
                    }}
                    type="button"
                    className={`p-3 rounded-lg border text-left transition flex flex-col justify-between h-20 ${itemId === item.id ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <span className="font-semibold text-slate-800 text-sm block truncate">{item.name}</span>
                    <span className="text-xs text-indigo-600 font-bold mt-1">Rs. {item.saleRate.toLocaleString()} / {item.unit}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Details form */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-100">
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Customer Account (Optional: Defaults to Walk-in)
                  </label>
                  <SearchableSelect
                    options={[
                      {
                        value: 'walk-in',
                        label: 'Walk-in Customer (General)',
                        subLabel: 'Spot / Counter Customer',
                        searchTerms: 'walk in walkin cash general',
                      },
                      ...customers.filter(c => c.id !== 'walk-in').map(c => {
                        const balInfo = balances?.customerBalances[c.id] || { outstanding: 0, advance: 0 };
                        const currentBalance = balInfo.outstanding > 0 ? balInfo.outstanding : balInfo.advance;
                        const status = balInfo.outstanding > 0 ? 'Outstanding' : (balInfo.advance > 0 ? 'Advance' : 'Clear');
                        const badgeColor = balInfo.outstanding > 0 ? 'rose' : (balInfo.advance > 0 ? 'emerald' : 'slate');
                        return {
                          value: c.id,
                          label: c.name,
                          subLabel: `${c.phone ? `Phone: ${c.phone}` : ''}${c.area ? ` • Area: ${c.area}` : ''}`,
                          badge: `Bal: Rs. ${currentBalance.toLocaleString()} (${status})`,
                          badgeColor: badgeColor as any,
                          searchTerms: `${c.name} ${c.id} ${c.phone || ''} ${c.area || ''}`,
                        };
                      })
                    ]}
                    value={customerId}
                    onChange={val => setCustomerId(val)}
                    placeholder="-- Choose Customer (Defaults to Walk-in) --"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Available Stock
                  </label>
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 font-bold">
                    {itemId && balances
                      ? `${balances.itemStocks[itemId] !== undefined ? balances.itemStocks[itemId] : 0} ${selectedItemObj?.unit || ''}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Billing Quantity (وزن / مقدار - پوائنٹس میں مثلاً 650.50)
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    placeholder="e.g. 560.26"
                    value={quantity === '' ? '' : quantity}
                    onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Price Rate (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={rate === '' ? '' : rate}
                    onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Direct Discount (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discount === 0 ? '' : discount}
                    onChange={e => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Optional Diesel & Vehicle Fueling Section */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDiesel}
                      onChange={e => setIncludeDiesel(e.target.checked)}
                      className="h-4 w-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Fuel className="h-4 w-4 text-amber-600" />
                      Add Diesel / Vehicle Fueling (ڈیزل اندراج - خودکار ڈیزل پیج میں شامل ہوگا)
                    </span>
                  </label>
                  {includeDiesel && dieselTotal > 0 && (
                    <span className="text-xs font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
                      Diesel: Rs. {dieselTotal.toLocaleString()} ({dieselLitres} L)
                    </span>
                  )}
                </div>

                {includeDiesel && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-amber-200/80 bg-white p-3 rounded-lg">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Vehicle (گاڑی)</label>
                      <select
                        value={dieselVehicleId}
                        onChange={e => setDieselVehicleId(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">-- Direct / Third-Party --</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.number} ({v.type || 'Truck'})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Driver Name</label>
                      <input
                        type="text"
                        placeholder="Driver Name"
                        value={dieselDriverName}
                        onChange={e => setDieselDriverName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Fuel Pump (وینڈر)</label>
                      <select
                        value={dieselVendorId}
                        onChange={e => setDieselVendorId(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="">-- Select Fuel Pump --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Litres (لیٹر)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 50"
                        value={dieselLitres === '' ? '' : dieselLitres}
                        onChange={e => handleDieselChange(e.target.value === '' ? '' : Number(e.target.value), dieselRate)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Rate / Litre</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="280"
                        value={dieselRate === '' ? '' : dieselRate}
                        onChange={e => handleDieselChange(dieselLitres, e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Payment Mode</label>
                      <select
                        value={dieselPaymentType}
                        onChange={e => setDieselPaymentType(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                      >
                        <option value="Credit">Credit / Pump Ledger (پمپ کھاتہ)</option>
                        <option value="Cash">Cash (روکڑا)</option>
                        <option value="Bank">Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Payment Type
                  </label>
                  <select
                    value={paymentType}
                    onChange={e => {
                      const newType = e.target.value as any;
                      setPaymentType(newType);
                      if (newType === 'Credit') {
                        setPaidAmount(0);
                        setIsPaidTouched(true);
                      } else if (newType === 'Cash' || newType === 'Bank') {
                        setPaidAmount(grandTotal);
                        setIsPaidTouched(false);
                      } else if (newType === 'Advance') {
                        setPaidAmount(0);
                        setIsPaidTouched(true);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cash">Cash Sale</option>
                    <option value="Bank">Bank Receipt</option>
                    <option value="Credit">Credit (Udhaar)</option>
                    <option value="Advance">Adjust Advance</option>
                  </select>
                </div>

                {paymentType === 'Bank' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Target Bank
                    </label>
                    <select
                      value={bankId}
                      onChange={e => setBankId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Amount Paid / Received (Rs.)
                      </label>
                      <div className="space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPaidAmount(grandTotal);
                            setIsPaidTouched(true);
                          }}
                          className="px-1.5 py-0.5 text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold"
                        >
                          Full
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaidAmount(0);
                            setIsPaidTouched(true);
                          }}
                          className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold"
                        >
                          Zero
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={isPaidTouched ? (paidAmount === 0 ? '' : paidAmount) : (paymentType === 'Credit' || paymentType === 'Advance' ? 0 : grandTotal)}
                      onChange={e => {
                        setPaidAmount(e.target.value === '' ? 0 : Number(e.target.value));
                        setIsPaidTouched(true);
                      }}
                      placeholder={String(grandTotal)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {paymentType === 'Bank' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Bank Amount Received (Rs.)
                      </label>
                      <div className="space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPaidAmount(grandTotal);
                            setIsPaidTouched(true);
                          }}
                          className="px-1.5 py-0.5 text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold"
                        >
                          Full
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaidAmount(0);
                            setIsPaidTouched(true);
                          }}
                          className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold"
                        >
                          Zero
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={isPaidTouched ? (paidAmount === 0 ? '' : paidAmount) : grandTotal}
                      onChange={e => {
                        setPaidAmount(e.target.value === '' ? 0 : Number(e.target.value));
                        setIsPaidTouched(true);
                      }}
                      placeholder={String(grandTotal)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                >
                  Complete Checkout Sale
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Summary Block */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-5 rounded-lg shadow-md space-y-4">
            <h3 className="text-md font-bold uppercase tracking-wider text-slate-400">POS Slip Invoice</h3>
            
            <div className="border-t border-b border-slate-800 py-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-medium">{selectedCustObj?.name || 'Walk-in Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Item:</span>
                <span className="font-medium">{selectedItemObj?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bill Qty:</span>
                <span className="font-medium">{quantity} {selectedItemObj?.unit || ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rate:</span>
                <span className="font-medium">Rs. {rate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal:</span>
                <span className="font-medium">Rs. {subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-400 font-medium">
                  <span>Discount:</span>
                  <span>-Rs. {discount.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline pt-2">
              <span className="text-lg font-bold text-slate-300">Total:</span>
              <span className="text-2xl font-black text-white">Rs. {grandTotal.toLocaleString()}</span>
            </div>

            {lastSavedSale && (
              <button
                onClick={handlePrintSlip}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 rounded-lg text-sm flex items-center justify-center space-x-2 border border-slate-700 transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Last Invoice Ticket</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* POS Sales History Log Section */}
      <div className={`bg-white p-6 rounded-lg shadow-sm border border-slate-100 space-y-6 mt-6 ${activePrintJob ? 'no-print' : ''}`}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 no-print">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <History className="h-5 w-5 text-indigo-600" />
              <span>POS Sales Register & History</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Track POS checkouts, filter invoices, and print receipts</p>
          </div>
          <button
            onClick={() => {
              setActivePrintJob(null);
              setTimeout(() => window.print(), 100);
            }}
            className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-xs font-medium transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Ledger</span>
          </button>
        </div>

        {/* History Filters */}
        <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-50 p-4 rounded-lg text-xs md:text-sm no-print">
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From Date</label>
              <input
                type="date"
                value={historyStartDate}
                onChange={e => setHistoryStartDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To Date</label>
              <input
                type="date"
                value={historyEndDate}
                onChange={e => setHistoryEndDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Account</label>
              <select
                value={historyCustomerId}
                onChange={e => setHistoryCustomerId(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="all">All Customers</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-slate-500 font-semibold text-xs">
            Found {filteredSales.length} records
          </div>
        </div>

        <div className="print-a4 print-container space-y-4">
          <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
              <div>
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h1>
                <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul & Son's (03458829298)</p>
                <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
              </div>
            </div>
            <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
              POS SALES INVOICES & REGISTER
            </p>
            <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
              <div>Total Invoices: {filteredSales.length}</div>
              <div>Period: {historyStartDate} to {historyEndDate} | Generated: {new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          {/* History Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-3 py-3 whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 whitespace-nowrap">Invoice No</th>
                  <th className="px-3 py-3 whitespace-nowrap">Customer</th>
                  <th className="px-3 py-3 whitespace-nowrap">Item</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Quantity</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Subtotal</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Discount</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Net Total</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Payment</th>
                  <th className="px-3 py-3 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSales.map(sale => {
                  const custName = customers.find(c => c.id === sale.customerId)?.name || (sale.customerId === 'walk-in' ? 'Walk-in Customer' : sale.customerId);
                  const itemName = items.find(i => i.id === sale.itemId)?.name || sale.itemId;
                  const itemUnit = items.find(i => i.id === sale.itemId)?.unit || '';
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{sale.date}</td>
                      <td className="px-3 py-3 font-semibold text-indigo-600 uppercase whitespace-nowrap">{sale.id.substring(4, 11)}</td>
                      <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{custName}</td>
                      <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{itemName}</td>
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap">{sale.quantity} {itemUnit}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">Rs. {(sale.quantity * sale.rate).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-rose-600 whitespace-nowrap">Rs. {(sale.discount || 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-bold whitespace-nowrap">Rs. {sale.total.toLocaleString()}</td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                          sale.paymentType === 'Cash' ? 'bg-emerald-50 text-emerald-700' :
                          sale.paymentType === 'Bank' ? 'bg-blue-50 text-blue-700' :
                          sale.paymentType === 'Credit' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {sale.paymentType}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right space-x-2 whitespace-nowrap no-print">
                        <button
                          onClick={() => setActiveViewSale(sale)}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded transition"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setActivePrintJob({ type: 'thermal', data: sale });
                            setTimeout(() => {
                              window.print();
                              setActivePrintJob(null);
                            }, 100);
                          }}
                          className="text-slate-600 hover:text-slate-800 font-semibold text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition"
                        >
                          Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-400">
                      No sales logs found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSales.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right font-bold">Grand Totals:</td>
                    <td className="px-4 py-3 text-right text-indigo-300">
                      {filteredSales.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      Rs. {filteredSales.reduce((sum, s) => sum + (s.quantity * s.rate), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-300">
                      Rs. {filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-black">
                      Rs. {filteredSales.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredSales.length}
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

      {/* POS Sale View Details Dialog Modal (Screen Only) */}
      {activeViewSale && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden font-mono text-xs p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-800">POS Invoice: {activeViewSale.id.substring(4, 12).toUpperCase()}</h3>
              <button onClick={() => setActiveViewSale(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="space-y-2 border-b border-slate-100 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice Date:</span>
                <span className="font-semibold">{activeViewSale.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold">{customers.find(c => c.id === activeViewSale.customerId)?.name || (activeViewSale.customerId === 'walk-in' ? 'Walk-in Customer' : activeViewSale.customerId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Type:</span>
                <span className="font-semibold">{activeViewSale.paymentType}</span>
              </div>
              {activeViewSale.bankId && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Paid to Bank:</span>
                  <span className="font-semibold">{banks.find(b => b.id === activeViewSale.bankId)?.name || activeViewSale.bankId}</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-700">INVOICE ITEM:</p>
              <div className="bg-slate-50 p-3 rounded border border-slate-100 space-y-1.5">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>{items.find(i => i.id === activeViewSale.itemId)?.name || activeViewSale.itemId}</span>
                  <span>Rs. {(activeViewSale.quantity * activeViewSale.rate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>Billing Qty: {activeViewSale.quantity} {items.find(i => i.id === activeViewSale.itemId)?.unit}</span>
                  <span>Rate: Rs. {activeViewSale.rate.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-3 text-right">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {(activeViewSale.quantity * activeViewSale.rate).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Discount Allowed:</span>
                <span>-Rs. {(activeViewSale.discount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 text-sm">
                <span>Grand Total:</span>
                <span>Rs. {activeViewSale.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 no-print">
              <button
                onClick={() => {
                  setActivePrintJob({ type: 'a4', data: activeViewSale });
                  setTimeout(() => {
                    window.print();
                    setActivePrintJob(null);
                  }, 100);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded text-xs transition flex items-center space-x-1"
              >
                <Printer className="h-3 w-3" />
                <span>Print A4 Invoice</span>
              </button>
              <button
                onClick={() => {
                  setActivePrintJob({ type: 'thermal', data: activeViewSale });
                  setTimeout(() => {
                    window.print();
                    setActivePrintJob(null);
                  }, 100);
                }}
                className="bg-slate-800 hover:bg-slate-950 text-white font-semibold px-4 py-2 rounded text-xs transition flex items-center space-x-1"
              >
                <Printer className="h-3 w-3" />
                <span>Print Thermal slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
