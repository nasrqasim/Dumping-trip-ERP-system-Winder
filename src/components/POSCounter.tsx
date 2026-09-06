import React, { useEffect, useState } from 'react';
import { getAllRecords, DBSale, DBCustomer, DBItem, DBBank } from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveSaleTransaction } from '../db/transactions';
import { ShoppingCart, User, Plus, Search, Trash, Printer, History } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface POSCounterProps {
  preselectedCustomerId?: string;
  onClearPreselectedCustomer?: () => void;
}

export default function POSCounter({ preselectedCustomerId, onClearPreselectedCustomer }: POSCounterProps) {
  const [items, setItems] = useState<DBItem[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Form State
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit' | 'Advance'>('Cash');
  const [bankId, setBankId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Last print slip state
  const [lastSavedSale, setLastSavedSale] = useState<DBSale | null>(null);

  const loadData = async () => {
    try {
      const allItems = await getAllRecords<DBItem>('items');
      setItems(allItems);

      const allCustomers = await getAllRecords<DBCustomer>('customers');
      setCustomers(allCustomers);

      const allBanks = await getAllRecords<DBBank>('banks');
      setBanks(allBanks);
      if (allBanks.length > 0) {
        setBankId(allBanks[0].id);
      }

      const allSales = await getAllRecords<DBSale>('sales');
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
    if (quantity <= 0) {
      alert('Please specify a valid billing quantity greater than 0.');
      return;
    }
    if (rate <= 0) {
      alert('Please enter a valid price rate.');
      return;
    }

    const materialTotal = quantity * rate;
    const total = materialTotal - discount;

    if (balances && itemId) {
      const stock = balances.itemStocks[itemId] !== undefined ? balances.itemStocks[itemId] : 0;
      if (stock < quantity) {
        if (!confirm(`Warning: Selected quantity (${quantity}) exceeds current available stock (${stock}). Proceed anyway?`)) {
          return;
        }
      }
    }

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

    const sale: DBSale = {
      id: saleId,
      date: new Date().toISOString().split('T')[0],
      customerId: effectiveCustomerId,
      itemId,
      quantity: Number(quantity) || 0,
      rate: Number(rate) || 0,
      discount: Number(discount) || 0,
      total: Number(total) || 0,
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
    };

    try {
      await saveSaleTransaction(sale);
      setLastSavedSale(sale);
      
      // Reset Form
      setQuantity(0);
      setDiscount(0);
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

  const subtotal = quantity * rate;
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

  if (loading) {
    return <div className="text-center py-6">Loading POS Counter...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Print Job Engine (Only visible during window.print) */}
      {activePrintJob && activePrintJob.type === 'thermal' && (
        <div className="print-only print-receipt p-4 bg-white text-xs font-mono">
          <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2 font-mono">
            <h2 className="text-sm font-bold">NORANI KANTA ERP</h2>
            <p className="text-[9px] text-slate-500">POS SALE INVOICE</p>
            <p className="text-[9px] text-slate-500">ID: {activePrintJob.data.id}</p>
            <p className="text-[9px] text-slate-500">Date: {activePrintJob.data.date}</p>
          </div>

          <div className="space-y-1 text-[10px] font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-bold">{customers.find(c => c.id === activePrintJob.data.customerId)?.name || (activePrintJob.data.customerId === 'walk-in' ? 'Walk-in Customer' : activePrintJob.data.customerId)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment:</span>
              <span className="font-bold">{activePrintJob.data.paymentType}</span>
            </div>
            
            <table className="w-full text-left border-collapse my-2 font-mono text-[10px]">
              <thead>
                <tr className="border-b-2 border-dashed border-slate-400 font-bold uppercase text-slate-800">
                  <th className="py-1 text-left">Item Description</th>
                  <th className="py-1 text-right whitespace-nowrap">Qty</th>
                  <th className="py-1 text-center whitespace-nowrap">Unit</th>
                  <th className="py-1 text-right whitespace-nowrap">Rate</th>
                  <th className="py-1 text-right whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                <tr>
                  <td className="py-1 font-semibold text-slate-800 max-w-[85px] break-words">
                    {items.find(i => i.id === activePrintJob.data.itemId)?.name || activePrintJob.data.itemId}
                  </td>
                  <td className="py-1 text-right font-bold text-slate-900 whitespace-nowrap">{activePrintJob.data.quantity}</td>
                  <td className="py-1 text-center text-slate-600 whitespace-nowrap">
                    {items.find(i => i.id === activePrintJob.data.itemId)?.unit || '—'}
                  </td>
                  <td className="py-1 text-right text-slate-600 whitespace-nowrap">Rs. {activePrintJob.data.rate.toLocaleString()}</td>
                  <td className="py-1 text-right font-bold text-slate-900 whitespace-nowrap">
                    Rs. {(activePrintJob.data.quantity * activePrintJob.data.rate).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>Rs. {(activePrintJob.data.quantity * activePrintJob.data.rate).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Discount:</span>
              <span>-Rs. {(activePrintJob.data.discount || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-dashed border-slate-300 pt-0.5">
              <span>Net Total:</span>
              <span>Rs. {activePrintJob.data.total.toLocaleString()}</span>
            </div>

            <div className="border-b border-dashed border-slate-300 my-1"></div>

            <div className="flex justify-between">
              <span>Paid:</span>
              <span>Rs. {(activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank') ? activePrintJob.data.total.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Outstanding:</span>
              <span>Rs. {activePrintJob.data.paymentType === 'Credit' ? activePrintJob.data.total.toLocaleString() : 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Advance Used:</span>
              <span>Rs. {activePrintJob.data.paymentType === 'Advance' ? activePrintJob.data.total.toLocaleString() : 0}</span>
            </div>
          </div>

          <div className="print-footer text-center mt-6 text-[9px] font-mono">
            Software by Roonjha Developer - 03152914836
          </div>
        </div>
      )}

      {activePrintJob && activePrintJob.type === 'a4' && (
        <div className="print-only print-a4 p-8 bg-white font-mono text-xs">
          <div className="text-center border-b border-slate-300 pb-4 mb-6">
            <h1 className="text-xl font-bold">NORANI KANTA & MATERIALS SUPPLY ERP</h1>
            <p className="text-xs text-slate-500 mt-1">POS Billing Invoice</p>
            <p className="text-xs text-slate-500">Ph: 03152914836 | Software by Roonjha Developer</p>
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
              <div className="flex justify-between font-semibold">
                <span>Paid (Via {activePrintJob.data.paymentType}):</span>
                <span>Rs. {(activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank') ? activePrintJob.data.total.toLocaleString() : 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Remaining Outstanding:</span>
                <span>Rs. {activePrintJob.data.paymentType === 'Credit' ? activePrintJob.data.total.toLocaleString() : 0}</span>
              </div>
              <div className="flex justify-between text-indigo-600">
                <span>Customer Advance Used:</span>
                <span>Rs. {activePrintJob.data.paymentType === 'Advance' ? activePrintJob.data.total.toLocaleString() : 0}</span>
              </div>
            </div>
          </div>

          <div className="print-footer text-center mt-12 text-slate-500 text-xs">
            Software by Roonjha Developer - 03152914836
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
                    Billing Quantity
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0"
                    value={quantity === 0 ? '' : quantity}
                    onChange={e => setQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Price Rate (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={rate}
                    onChange={e => setRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Direct Discount (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={e => setDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Payment Type
                  </label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cash">Cash Sale</option>
                    <option value="Bank">Bank Receipt</option>
                    <option value="Credit">Credit (Udhaar)</option>
                    <option value="Advance">Adjust Advance</option>
                  </select>
                </div>

                {paymentType === 'Bank' && (
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
                )}
              </div>

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
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
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
                {filteredSales.map(sale => {
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
          </div>

          <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
            Software by Roonjha Developer - 03152914836
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
