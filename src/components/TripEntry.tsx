import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBTrip, DBCustomer, DBItem, DBVehicle, DBBank, DBTripExpense, DBTripItem } from '../db/indexedDB';
import { calculateLiveBalances, LiveBalances, saveTripTransaction, deleteTripTransaction } from '../db/transactions';
import { Truck, Plus, Trash, Edit, ArrowRight, Printer, AlertTriangle, Download, Search, X, FileText, UserCheck, Wallet, ShieldAlert } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface FormTripItem {
  id: string;
  itemId: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export default function TripEntry() {
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activePrintJob, setActivePrintJob] = useState<{ type: 'thermal' | 'a4'; data: DBTrip } | null>(null);
  const [activeViewTrip, setActiveViewTrip] = useState<DBTrip | null>(null);

  // Form Field States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [customerId, setCustomerId] = useState('walk-in');
  const [tripItems, setTripItems] = useState<FormTripItem[]>([
    { id: 'item-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }
  ]);
  const [vehicleCharges, setVehicleCharges] = useState(0);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit' | 'Advance'>('Cash');
  const [bankId, setBankId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isPaidTouched, setIsPaidTouched] = useState<boolean>(false);
  const [quickItemId, setQuickItemId] = useState<string>('');
  const [quickQty, setQuickQty] = useState<number>(0);
  const [quickRate, setQuickRate] = useState<number>(0);

  // Trip Expenses State
  const [expenses, setExpenses] = useState<DBTripExpense[]>([]);
  const [currentExpCategory, setCurrentExpCategory] = useState('Diesel');
  const [currentExpAmount, setCurrentExpAmount] = useState(0);
  const [currentExpDesc, setCurrentExpDesc] = useState('');

  const loadData = async () => {
    try {
      // Ensure Walk-in Customer exists
      const allCustomers = await getAllRecords<DBCustomer>('customers');
      let walkin = allCustomers.find(c => c.id === 'walk-in');
      if (!walkin) {
        const newWalkin: DBCustomer = {
          id: 'walk-in',
          name: 'Walk-in Customer',
          phone: '0000-0000000',
          address: 'Counter Sales',
          area: 'Local',
          openingBalance: 0,
          creditLimit: 999999,
        };
        await putRecord<DBCustomer>('customers', newWalkin);
        allCustomers.push(newWalkin);
      }
      setCustomers(allCustomers);

      const allItems = await getAllRecords<DBItem>('items');
      setItems(allItems);

      const allVehicles = await getAllRecords<DBVehicle>('vehicles');
      setVehicles(allVehicles);

      const allBanks = await getAllRecords<DBBank>('banks');
      setBanks(allBanks);
      if (allBanks.length > 0 && !bankId) {
        setBankId(allBanks[0].id);
      }

      const allTrips = await getAllRecords<DBTrip>('trips');
      allTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTrips(allTrips);

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

  // Update driver name based on vehicle selection (do NOT touch quantity or vehicle charges)
  useEffect(() => {
    if (vehicleId) {
      const selectedVeh = vehicles.find(v => v.id === vehicleId);
      if (selectedVeh) {
        setDriverName(selectedVeh.driver || '');
      }
    }
  }, [vehicleId, vehicles]);

  const handleAddItemRow = () => {
    setTripItems(prev => [
      ...prev,
      { id: 'item-' + Date.now() + Math.random(), itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }
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
    const rate = quickRate > 0 ? quickRate : (itm ? itm.saleRate : 0);
    const qty = quickQty > 0 ? quickQty : 1;
    const amount = qty * rate;

    setTripItems(prev => {
      // If the first row is empty, replace it
      if (prev.length === 1 && !prev[0].itemId) {
        return [{ id: 'item-1', itemId: quickItemId, quantity: qty, unit, rate, amount }];
      }
      return [
        ...prev,
        { id: 'item-' + Date.now() + Math.random(), itemId: quickItemId, quantity: qty, unit, rate, amount }
      ];
    });

    // Reset quick inputs
    setQuickItemId('');
    setQuickQty(0);
    setQuickRate(0);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (tripItems.length === 1) {
      setTripItems([{ id: 'item-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }]);
    } else {
      setTripItems(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleItemChange = (idx: number, field: keyof FormTripItem, val: any) => {
    setTripItems(prev => {
      const copy = [...prev];
      const row = { ...copy[idx] };
      if (field === 'itemId') {
        row.itemId = val;
        const itm = items.find(i => i.id === val);
        if (itm) {
          row.unit = itm.unit;
          row.rate = itm.saleRate;
          row.amount = (row.quantity || 0) * itm.saleRate;
        } else {
          row.rate = 0;
          row.amount = 0;
        }
      } else if (field === 'quantity') {
        const q = Number(val) || 0;
        row.quantity = q;
        row.amount = q * (row.rate || 0);
      } else if (field === 'rate') {
        const r = Number(val) || 0;
        row.rate = r;
        row.amount = (row.quantity || 0) * r;
      }
      copy[idx] = row;
      return copy;
    });
  };

  const handleOpenForm = (trip?: DBTrip) => {
    if (trip) {
      setEditingId(trip.id);
      setDate(trip.date);
      setVehicleId(trip.vehicleId || '');
      setDriverName(trip.driverName || '');
      setCustomerId(trip.customerId || 'walk-in');
      if (trip.items && trip.items.length > 0) {
        setTripItems(trip.items.map((it, idx) => ({
          id: `item-${idx + 1}-${Date.now()}`,
          itemId: it.itemId,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          amount: it.amount || (it.quantity * it.rate),
        })));
      } else if (trip.itemId) {
        setTripItems([{
          id: 'item-1',
          itemId: trip.itemId,
          quantity: trip.quantity,
          unit: trip.unit,
          rate: trip.rate,
          amount: trip.materialTotal || (trip.quantity * trip.rate),
        }]);
      } else {
        setTripItems([{ id: 'item-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }]);
      }
      setVehicleCharges(trip.vehicleCharges || 0);
      setDiscount(trip.discount || 0);
      setPaymentType(trip.paymentType || 'Cash');
      setPaidAmount(trip.paidAmount !== undefined ? trip.paidAmount : (trip.paymentType === 'Cash' || trip.paymentType === 'Bank' ? trip.grandTotal : 0));
      setIsPaidTouched(trip.paidAmount !== undefined);
      setBankId(trip.bankId || (banks.length > 0 ? banks[0].id : ''));
      setFrom(trip.from || '');
      setTo(trip.to || '');
      setExpenses(trip.expenses || []);
    } else {
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setCustomerId('walk-in');
      setVehicleId('');
      setDriverName('');
      setTripItems([{ id: 'item-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }]);
      setVehicleCharges(0);
      setDiscount(0);
      setPaymentType('Cash');
      setPaidAmount(0);
      setIsPaidTouched(false);
      setFrom('');
      setTo('');
      setExpenses([]);
    }
    setQuickItemId('');
    setQuickQty(0);
    setQuickRate(0);
    setIsFormOpen(true);
  };

  const handleAddExpense = (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentExpAmount <= 0) return;

    const newExpense: DBTripExpense = {
      category: currentExpCategory,
      amount: Number(currentExpAmount),
      description: currentExpDesc,
    };

    setExpenses([...expenses, newExpense]);
    setCurrentExpAmount(0);
    setCurrentExpDesc('');
  };

  const handleRemoveExpense = (idx: number) => {
    const next = [...expenses];
    next.splice(idx, 1);
    setExpenses(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = tripItems.filter(i => i.itemId && i.quantity > 0);
    if (validItems.length === 0) {
      alert('Please add at least one material item and enter a quantity greater than 0.');
      return;
    }

    const effectiveCustomerId = customerId.trim() || 'walk-in';

    if (paymentType === 'Credit' && effectiveCustomerId === 'walk-in') {
      alert('Credit payment requires selecting a registered customer account. For walk-in customers, please select Cash or Bank.');
      return;
    }

    const mTotal = validItems.reduce((sum, itm) => sum + itm.amount, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const grandTotal = mTotal + vehicleCharges + totalExpenses - discount;
    const netTripProfit = vehicleCharges - totalExpenses;

    if (paymentType === 'Credit' && effectiveCustomerId !== 'walk-in' && balances) {
      const cust = customers.find(c => c.id === effectiveCustomerId);
      const custBal = balances.customerBalances[effectiveCustomerId]?.outstanding || 0;
      if (cust && cust.creditLimit && (custBal + grandTotal) > cust.creditLimit) {
        if (!confirm(`Warning: Customer credit outstanding (Rs. ${custBal.toLocaleString()}) plus this trip charge (Rs. ${grandTotal.toLocaleString()}) exceeds their credit limit (Rs. ${cust.creditLimit.toLocaleString()}). Proceed anyway?`)) {
          return;
        }
      }
    }

    let tripId = editingId;
    if (!tripId) {
      const prefix = 'trp-';
      const existingIds = trips.map(t => t.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
      const nextNum = maxNum + 1;
      tripId = `${prefix}${String(nextNum).padStart(3, '0')}`;
    }

    const primaryItem = validItems[0];
    const totalQty = validItems.reduce((sum, itm) => sum + itm.quantity, 0);

    const trip: DBTrip = {
      id: tripId,
      date,
      vehicleId: vehicleId.trim() || '',
      driverName: driverName.trim() || '',
      customerId: effectiveCustomerId,
      items: validItems.map(i => ({
        itemId: i.itemId,
        itemName: items.find(it => it.id === i.itemId)?.name || i.itemId,
        quantity: Number(i.quantity) || 0,
        unit: i.unit,
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || 0,
      })),
      itemId: primaryItem.itemId,
      quantity: Number(totalQty) || 0,
      unit: primaryItem.unit,
      rate: Number(primaryItem.rate) || 0,
      materialTotal: Number(mTotal) || 0,
      vehicleCharges: Number(vehicleCharges) || 0,
      discount: Number(discount) || 0,
      grandTotal: Number(grandTotal) || 0,
      paidAmount: Number(paidAmount) || 0,
      remainingBalance: (Number(grandTotal) || 0) - (Number(paidAmount) || 0),
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      expenses: expenses.map(e => ({
        category: e.category,
        amount: Number(e.amount) || 0,
        description: e.description || '',
      })),
      totalExpenses: Number(totalExpenses) || 0,
      netTripProfit: Number(netTripProfit) || 0,
      from: from ? from.trim() : '',
      to: to ? to.trim() : '',
    };

    try {
      await saveTripTransaction(trip);
      setIsFormOpen(false);
      await loadData();
      if (confirm('Print Receipt?\nSale/Dispatch has been completed successfully.')) {
        setActivePrintJob({ type: 'thermal', data: trip });
        setTimeout(() => {
          window.print();
          setActivePrintJob(null);
        }, 150);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to save trip: ' + (err?.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this trip transaction? This will reverse all ledger, cash/bank and inventory balances.')) {
      await deleteTripTransaction(id);
      loadData();
    }
  };

  const handlePrintReceipt = (trip: DBTrip) => {
    setActivePrintJob({ type: 'thermal', data: trip });
    setTimeout(() => {
      window.print();
      setActivePrintJob(null);
    }, 150);
  };

  const handlePrintAllTripsLedger = () => {
    setActivePrintJob(null);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadTripsCSV = () => {
    if (trips.length === 0) {
      alert('No trips recorded to download.');
      return;
    }

    const headers = [
      'Trip ID',
      'Date',
      'Vehicle Number',
      'Driver Name',
      'Customer Name',
      'Material',
      'Quantity',
      'Unit',
      'Rate (PKR)',
      'Material Total (PKR)',
      'Vehicle Charges (PKR)',
      'Total Expenses (PKR)',
      'Discount (PKR)',
      'Net Profit (PKR)',
      'Grand Total (PKR)',
      'Payment Type',
      'From Location',
      'Destination'
    ];

    const rows = trips.map(t => {
      const cust = customers.find(c => c.id === t.customerId)?.name || t.customerId;
      const item = items.find(i => i.id === t.itemId)?.name || t.itemId;
      const veh = vehicles.find(v => v.id === t.vehicleId)?.number || t.vehicleId;
      return [
        `"${t.id}"`,
        `"${t.date}"`,
        `"${veh}"`,
        `"${t.driverName}"`,
        `"${cust}"`,
        `"${item}"`,
        t.quantity,
        `"${t.unit}"`,
        t.rate,
        t.materialTotal,
        t.vehicleCharges,
        t.totalExpenses,
        t.discount,
        t.netTripProfit,
        t.grandTotal,
        `"${t.paymentType}"`,
        `"${t.from || ''}"`,
        `"${t.to || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Norani_Kanta_Trips_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const materialTotal = tripItems.reduce((sum, itm) => sum + (Number(itm.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const grandTotal = materialTotal + vehicleCharges + totalExpenses - discount;
  const netTripProfit = vehicleCharges - totalExpenses;

  // Live Customer Balances & Interactive Credit/Advance Projection
  const selectedCust = customers.find(c => c.id === customerId);
  const custBalInfo = (customerId && balances?.customerBalances[customerId])
    ? balances.customerBalances[customerId]
    : { outstanding: 0, advance: 0, netBalance: 0 };
  const currentOutstanding = custBalInfo.outstanding || 0;
  const currentAdvance = custBalInfo.advance || 0;

  const effectivePaid = Number(paidAmount) || 0;
  const unpaidBalance = grandTotal - effectivePaid;

  let projectedAdvance = currentAdvance;
  let projectedOutstanding = currentOutstanding;

  if (unpaidBalance > 0) {
    // Customer owes money (credit / using advance)
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
    // Customer overpaid! Extra money goes to advance
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

  // Correct expense categories list in English
  const categoriesList = [
    'Diesel',
    'Food',
    'Driver',
    'Commission',
    'Kanta',
    'Arai',
    'Toll Tax',
    'Mechanic',
    'Labour',
    'Other Expense'
  ];

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredTrips = trips.filter(t => {
    if (!cleanSearch) return true;
    const cust = customers.find(c => c.id === t.customerId);
    const item = items.find(i => i.id === t.itemId);
    const veh = vehicles.find(v => v.id === t.vehicleId);
    return (
      t.id.toLowerCase().includes(cleanSearch) ||
      t.date.includes(cleanSearch) ||
      t.driverName.toLowerCase().includes(cleanSearch) ||
      (t.from && t.from.toLowerCase().includes(cleanSearch)) ||
      (t.to && t.to.toLowerCase().includes(cleanSearch)) ||
      t.paymentType.toLowerCase().includes(cleanSearch) ||
      (cust && cust.name.toLowerCase().includes(cleanSearch)) ||
      (item && item.name.toLowerCase().includes(cleanSearch)) ||
      (veh && veh.number.toLowerCase().includes(cleanSearch))
    );
  });

  if (loading) {
    return <div className="text-center py-6">Loading trips ledger...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Print Job Engine (Only visible during window.print) */}
      {activePrintJob && activePrintJob.type === 'thermal' && (
        <div className="print-only print-receipt p-6 bg-white border border-slate-200 text-xs rounded">
          <div className="text-center border-b border-slate-200 pb-3 mb-3 font-mono">
            <h2 className="text-xl font-bold text-slate-800">NORANI KANTA ERP</h2>
            <p className="text-xs text-slate-500">Material Dispatch & Transport Ticket</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Ticket #: {activePrintJob.data.id.substring(5, 12)}</p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Trip No:</span>
              <span className="font-bold">{activePrintJob.data.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span className="font-bold">{activePrintJob.data.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vehicle:</span>
              <span className="font-bold">{vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.number || (activePrintJob.data.vehicleId ? activePrintJob.data.vehicleId : 'Direct / None')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Driver:</span>
              <span className="font-bold">{activePrintJob.data.driverName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-bold">{customers.find(c => c.id === activePrintJob.data.customerId)?.name || (activePrintJob.data.customerId === 'walk-in' ? 'Walk-in Customer' : activePrintJob.data.customerId)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">From Location:</span>
              <span className="font-bold">{activePrintJob.data.from || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Destination:</span>
              <span className="font-bold">{activePrintJob.data.to || '—'}</span>
            </div>
            
            <hr className="border-slate-300 my-2" />
            
            <table className="w-full text-left border-collapse my-2 font-mono text-[10px]">
              <thead>
                <tr className="border-b-2 border-dashed border-slate-400 font-bold uppercase text-slate-800">
                  <th className="py-1 text-left">Item</th>
                  <th className="py-1 text-right whitespace-nowrap">Qty</th>
                  <th className="py-1 text-center whitespace-nowrap">Unit</th>
                  <th className="py-1 text-right whitespace-nowrap">Rate</th>
                  <th className="py-1 text-right whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                {activePrintJob.data.items && activePrintJob.data.items.length > 0 ? (
                  activePrintJob.data.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1 font-semibold text-slate-800 max-w-[85px] break-words">
                        {it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}
                      </td>
                      <td className="py-1 text-right font-bold text-slate-900 whitespace-nowrap">{it.quantity}</td>
                      <td className="py-1 text-center text-slate-600 whitespace-nowrap">{it.unit}</td>
                      <td className="py-1 text-right text-slate-600 whitespace-nowrap">Rs. {it.rate.toLocaleString()}</td>
                      <td className="py-1 text-right font-bold text-slate-900 whitespace-nowrap">Rs. {it.amount.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-1 font-semibold text-slate-800 max-w-[85px] break-words">
                      {items.find(i => i.id === activePrintJob.data.itemId)?.name || activePrintJob.data.itemId}
                    </td>
                    <td className="py-1 text-right font-bold text-slate-900 whitespace-nowrap">{activePrintJob.data.quantity}</td>
                    <td className="py-1 text-center text-slate-600 whitespace-nowrap">{activePrintJob.data.unit}</td>
                    <td className="py-1 text-right text-slate-600 whitespace-nowrap">Rs. {activePrintJob.data.rate.toLocaleString()}</td>
                    <td className="py-1 text-right font-bold text-slate-900 whitespace-nowrap">Rs. {activePrintJob.data.materialTotal.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dashed border-slate-400 font-bold">
                  <td colSpan={3} className="py-1 text-left">
                    Total Items: {activePrintJob.data.items && activePrintJob.data.items.length > 0 ? activePrintJob.data.items.length : 1}
                  </td>
                  <td className="py-1 text-right">Mat Total:</td>
                  <td className="py-1 text-right font-black">Rs. {activePrintJob.data.materialTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            {activePrintJob.data.vehicleCharges > 0 && (
              <div className="flex justify-between">
                <span>Vehicle Charges:</span>
                <span>+Rs. {activePrintJob.data.vehicleCharges.toLocaleString()}</span>
              </div>
            )}
            {activePrintJob.data.totalExpenses > 0 && (
              <div className="flex justify-between">
                <span>Trip Expenses Billed:</span>
                <span>+Rs. {activePrintJob.data.totalExpenses.toLocaleString()}</span>
              </div>
            )}
            
            <hr className="border-slate-300 my-2" />

            <div className="flex justify-between">
              <span>Amount Before Discount:</span>
              <span>Rs. {(activePrintJob.data.materialTotal + activePrintJob.data.vehicleCharges + activePrintJob.data.totalExpenses).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Discount:</span>
              <span>-Rs. {(activePrintJob.data.discount || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black text-xs text-slate-900 border-t-2 border-double border-slate-400 pt-1 mt-1">
              <span>NET TOTAL:</span>
              <span>Rs. {activePrintJob.data.grandTotal.toLocaleString()}</span>
            </div>
            
            <hr className="border-slate-300 my-2" />

            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-bold">{activePrintJob.data.paymentType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Paid Amount:</span>
              <span className="font-bold">
                Rs. {(activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.grandTotal : 0)).toLocaleString()}
              </span>
            </div>
            {(() => {
              const p = activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.grandTotal : 0);
              const diff = activePrintJob.data.grandTotal - p;
              if (diff > 0) {
                return (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Remaining (Credit / Payable):</span>
                    <span>Rs. {diff.toLocaleString()}</span>
                  </div>
                );
              } else if (diff < 0) {
                return (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Overpayment (Added to Advance):</span>
                    <span>+Rs. {(-diff).toLocaleString()}</span>
                  </div>
                );
              } else {
                return (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Status:</span>
                    <span>Fully Paid (Clear)</span>
                  </div>
                );
              }
            })()}
          </div>
          
          <div className="print-footer text-center mt-6">
            Software by Roonjha Developer - 03152914836
          </div>
        </div>
      )}

      {activePrintJob && activePrintJob.type === 'a4' && (
        <div className="print-only print-a4 p-8 bg-white font-mono text-xs">
          <div className="text-center border-b border-slate-300 pb-4 mb-6">
            <h1 className="text-xl font-bold">NORANI KANTA & MATERIALS SUPPLY ERP</h1>
            <p className="text-xs text-slate-500 mt-1">Material Dispatch & Transport A4 Receipt</p>
            <p className="text-xs text-slate-500">Ph: 03152914836 | Software by Roonjha Developer</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <p className="font-bold text-slate-700">TRIP DETAILS:</p>
              <p>Trip Number: <span className="font-bold">{activePrintJob.data.id}</span></p>
              <p>Vehicle: {vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.number || (activePrintJob.data.vehicleId ? activePrintJob.data.vehicleId : 'Direct / None')} {vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.type ? `(${vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.type})` : ''}</p>
              <p>Driver Name: {activePrintJob.data.driverName || '—'}</p>
              <p>Route: {activePrintJob.data.from || '—'} ➔ {activePrintJob.data.to || '—'}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="font-bold text-slate-700">CUSTOMER DETAILS:</p>
              <p>Name: <span className="font-bold">{customers.find(c => c.id === activePrintJob.data.customerId)?.name || (activePrintJob.data.customerId === 'walk-in' ? 'Walk-in Customer' : activePrintJob.data.customerId)}</span></p>
              <p>Phone: {customers.find(c => c.id === activePrintJob.data.customerId)?.phone || 'N/A'}</p>
              <p>Date: {activePrintJob.data.date}</p>
            </div>
          </div>

          <table className="min-w-full divide-y divide-slate-200 text-left mb-6 font-mono text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="px-4 py-2">Material / Item</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Quantity</th>
                <th className="px-4 py-2 whitespace-nowrap">Unit</th>
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
                    <td className="px-4 py-3 whitespace-nowrap">{it.unit}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">Rs. {it.rate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap">Rs. {it.amount.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-3 font-semibold">{items.find(i => i.id === activePrintJob.data.itemId)?.name || activePrintJob.data.itemId}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-bold">{activePrintJob.data.quantity}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{activePrintJob.data.unit}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">Rs. {activePrintJob.data.rate.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">Rs. {activePrintJob.data.materialTotal.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>

          {activePrintJob.data.expenses && activePrintJob.data.expenses.length > 0 && (
            <div className="mb-6 space-y-1.5">
              <p className="font-bold text-slate-700">TRIP EXPENSES DETAILS:</p>
              <table className="min-w-full divide-y divide-slate-200 text-left font-mono text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-1">Expense Category</th>
                    <th className="px-4 py-1">Description</th>
                    <th className="px-4 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {activePrintJob.data.expenses.map((exp, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{exp.category}</td>
                      <td className="px-4 py-2 text-slate-500">{exp.description || '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold">Rs. {exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={2} className="px-4 py-2 text-right">Total expenses:</td>
                    <td className="px-4 py-2 text-right">Rs. {activePrintJob.data.totalExpenses.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <div className="w-80 space-y-1.5 border-t border-slate-300 pt-3">
              <div className="flex justify-between">
                <span>Material Total:</span>
                <span>Rs. {activePrintJob.data.materialTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Vehicle Charges (Freight):</span>
                <span>+Rs. {activePrintJob.data.vehicleCharges.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Trip Expenses Billed:</span>
                <span>+Rs. {activePrintJob.data.totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross Total Before Discount:</span>
                <span>Rs. {(activePrintJob.data.materialTotal + activePrintJob.data.vehicleCharges + activePrintJob.data.totalExpenses).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Discount Allowed:</span>
                <span>-Rs. {(activePrintJob.data.discount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-sm">
                <span>Net Total:</span>
                <span>Rs. {activePrintJob.data.grandTotal.toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-100 my-1"></div>
              <div className="flex justify-between font-semibold">
                <span>Paid (Via {activePrintJob.data.paymentType}):</span>
                <span>Rs. {(activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.grandTotal : 0)).toLocaleString()}</span>
              </div>
              {(() => {
                const p = activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.grandTotal : 0);
                const diff = activePrintJob.data.grandTotal - p;
                if (diff > 0) {
                  return (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>Remaining Due (Credit):</span>
                      <span>Rs. {diff.toLocaleString()}</span>
                    </div>
                  );
                } else if (diff < 0) {
                  return (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Overpayment (Added to Advance):</span>
                      <span>+Rs. {(-diff).toLocaleString()}</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Payment Status:</span>
                      <span>Fully Paid (Clear)</span>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          <div className="print-footer text-center mt-12 text-slate-500 text-xs">
            Software by Roonjha Developer - 03152914836
          </div>
        </div>
      )}

      {/* Primary Workspace View (Hidden during individual receipt print jobs) */}
      <div className={`space-y-6 ${activePrintJob ? 'no-print' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Trip Dispatches & Logistics</h2>
            <p className="text-sm text-slate-500">Record vehicle materials deliveries, track driver trip revenues, and log expenses</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search trip no, vehicle, customer..."
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
              onClick={handleDownloadTripsCSV}
              className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm"
              title="Download all saved trips as CSV spreadsheet"
            >
              <Download className="h-4 w-4" />
              <span>Download CSV</span>
            </button>
            <button
              onClick={handlePrintAllTripsLedger}
              className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition"
              title="Print complete ledger of dispatches"
            >
              <Printer className="h-4 w-4" />
              <span>Print Ledger</span>
            </button>
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Trip</span>
            </button>
          </div>
        </div>

        <div className="print-a4 print-container space-y-4">
          <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
            <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
              TRIP DISPATCHES & LOGISTICS REGISTER
            </p>
            <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
              <div>Total Trips: {filteredTrips.length}</div>
              <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          {/* Trips Registry Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-3 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Trip No.</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Vehicle / Driver</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Customer</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Material Details</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Vehicle Charges</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Expenses</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Net Profit</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Invoice Total</th>
                    <th className="px-3 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTrips.map(t => {
                    const cust = customers.find(c => c.id === t.customerId);
                    const item = items.find(i => i.id === t.itemId);
                    const veh = vehicles.find(v => v.id === t.vehicleId);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{t.date}</td>
                        <td className="px-3 py-3 font-mono font-bold text-indigo-700 whitespace-nowrap">{t.id}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="font-semibold text-slate-700 whitespace-nowrap">{veh?.number || (t.vehicleId ? t.vehicleId : '— (Direct / No Vehicle)')}</p>
                          <p className="text-xs text-slate-400 whitespace-nowrap">{t.driverName || '—'}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-700 font-medium whitespace-nowrap">{cust?.name || (t.customerId === 'walk-in' ? 'Walk-in Customer' : t.customerId)}</td>
                        <td className="px-3 py-3">
                          {t.items && t.items.length > 0 ? (
                            <div className="space-y-1">
                              {t.items.map((it, idx) => (
                                <div key={idx} className="leading-tight whitespace-nowrap">
                                  <span className="font-semibold text-slate-700">{it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}</span>
                                  <span className="text-xs text-slate-500 ml-1.5 font-mono">({it.quantity} {it.unit} @ Rs. {it.rate.toLocaleString()})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="whitespace-nowrap">
                              <span className="font-medium text-slate-700">{item?.name || t.itemId}</span>
                              <span className="text-xs text-slate-500 ml-1.5 font-mono">({t.quantity} {item?.unit} @ Rs. {t.rate.toLocaleString()})</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium whitespace-nowrap">Rs. {t.vehicleCharges.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-rose-600 font-medium whitespace-nowrap">Rs. {t.totalExpenses.toLocaleString()}</td>
                        <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${t.netTripProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Rs. {t.netTripProfit.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          <p className="whitespace-nowrap">Rs. {t.grandTotal.toLocaleString()}</p>
                          {t.paidAmount !== undefined && t.paidAmount < t.grandTotal ? (
                            <p className="text-[10px] text-rose-600 font-bold whitespace-nowrap">
                              Paid: Rs. {t.paidAmount.toLocaleString()} • Due: Rs. {(t.grandTotal - t.paidAmount).toLocaleString()}
                            </p>
                          ) : t.paidAmount !== undefined && t.paidAmount > t.grandTotal ? (
                            <p className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">
                              Paid: Rs. {t.paidAmount.toLocaleString()} • Adv: +Rs. {(t.paidAmount - t.grandTotal).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{t.paymentType}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right space-x-2 whitespace-nowrap no-print">
                          <button
                            onClick={() => setActiveViewTrip(t)}
                            className="text-slate-400 hover:text-indigo-600 transition"
                            title="View Details"
                          >
                            <FileText className="h-4 w-4 inline" />
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(t)}
                            className="text-slate-400 hover:text-slate-600 transition"
                            title="Print Ticket"
                          >
                            <Printer className="h-4 w-4 inline" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(t)}
                            className="text-slate-400 hover:text-indigo-600 transition"
                            title="Edit Trip"
                          >
                            <Edit className="h-4 w-4 inline" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-slate-400 hover:text-rose-600 transition"
                            title="Delete Trip"
                          >
                            <Trash className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400">
                        <Truck className="h-10 w-10 mx-auto mb-2 stroke-1" />
                        <p className="text-sm font-medium">
                          {searchQuery ? `No matching trips found for "${searchQuery}".` : 'No trips registered yet.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredTrips.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm border-t border-slate-700 font-mono">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right font-black">Grand Totals ({filteredTrips.length}):</td>
                      <td className="px-4 py-3 text-right text-indigo-300">Rs. {filteredTrips.reduce((sum, t) => sum + t.vehicleCharges, 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-rose-300">Rs. {filteredTrips.reduce((sum, t) => sum + t.totalExpenses, 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-emerald-300">Rs. {filteredTrips.reduce((sum, t) => sum + t.netTripProfit, 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-black">Rs. {filteredTrips.reduce((sum, t) => sum + t.grandTotal, 0).toLocaleString()}</td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
            Software by Roonjha Developer - 03152914836
          </div>
        </div>
      </div>

      {/* Dispatch Ticket Creation / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 no-print p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl md:max-w-6xl max-h-[94vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingId ? `Edit Logistics Trip (${editingId})` : 'New Trip Dispatch & Sales Invoice'}
                  </h3>
                  <p className="text-xs text-slate-400">Dispatch materials, calculate freight & record customer transactions</p>
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
              {/* Top Section: 2 Columns (Logistics & Route vs Customer Profile & Ledger) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column (7 cols): Logistics Profile, Vehicle & Route */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Dispatch Date
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
                        Select Vehicle (Optional)
                      </label>
                      <SearchableSelect
                        options={[
                          {
                            value: '',
                            label: '-- No Vehicle / Direct / Unassigned --',
                            subLabel: 'Direct pickup or customer vehicle',
                            searchTerms: 'no vehicle none direct pickup unassigned',
                          },
                          ...vehicles.filter(v => v.active || v.id === vehicleId).map(v => ({
                            value: v.id,
                            label: `${v.number} (${v.type})`,
                            subLabel: v.driver ? `Driver: ${v.driver}` : undefined,
                            badge: v.type,
                            badgeColor: 'indigo' as const,
                            searchTerms: `${v.number} ${v.type} ${v.driver || ''}`,
                          }))
                        ]}
                        value={vehicleId}
                        onChange={val => {
                          setVehicleId(val);
                          const veh = vehicles.find(v => v.id === val);
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
                        Driver Name (Optional)
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
                        From Location (Optional)
                      </label>
                      <input
                        type="text"
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                        placeholder="e.g. Quarry / Pit"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        To Location (Optional)
                      </label>
                      <input
                        type="text"
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        placeholder="e.g. Site / Customer"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                        Vehicle Charges / Freight (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={vehicleCharges === 0 ? '' : vehicleCharges}
                        onChange={e => setVehicleCharges(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-indigo-50/40 font-semibold text-indigo-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Discount Allowed (Rs.)
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
                  </div>
                </div>

                {/* Right Column (5 cols): Dedicated Customer Panel (Oilshop Style Golden Card) */}
                <div className="lg:col-span-5 bg-gradient-to-br from-amber-50 to-amber-100/70 border-2 border-amber-300 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3.5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/90 pb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-amber-950">Customer Profile</h4>
                          <p className="text-[11px] text-amber-800/80">Account details & live ledger balance</p>
                        </div>
                      </div>
                      {/* Live Balance Tag */}
                      <div>
                        {custBalInfo.outstanding > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-sm animate-pulse">
                            Outstanding: Rs. {custBalInfo.outstanding.toLocaleString()}
                          </span>
                        ) : custBalInfo.advance > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                            Advance: Rs. {custBalInfo.advance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Clear: Rs. 0
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Selection */}
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">
                        Select Customer (Optional: Defaults to Walk-in)
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
                            const bal = balances?.customerBalances[c.id] || { outstanding: 0, advance: 0 };
                            const curBal = bal.outstanding > 0 ? bal.outstanding : bal.advance;
                            const status = bal.outstanding > 0 ? 'Outstanding' : (bal.advance > 0 ? 'Advance' : 'Clear');
                            const badgeColor = bal.outstanding > 0 ? 'rose' : (bal.advance > 0 ? 'emerald' : 'slate');
                            return {
                              value: c.id,
                              label: c.name,
                              subLabel: `${c.phone ? `Ph: ${c.phone}` : ''}${c.area ? ` • ${c.area}` : ''}`,
                              badge: `Rs. ${curBal.toLocaleString()} (${status})`,
                              badgeColor: badgeColor as any,
                              searchTerms: `${c.name} ${c.id} ${c.phone || ''} ${c.area || ''}`,
                            };
                          })
                        ]}
                        value={customerId}
                        onChange={val => setCustomerId(val)}
                        placeholder="-- Search or Pick Customer --"
                      />
                    </div>

                    {/* Customer Info Box */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-white/90 p-2.5 rounded-lg border border-amber-200/80 text-amber-950">
                      <div>
                        <span className="text-amber-800/70 block text-[10px] uppercase font-bold">Phone Number</span>
                        <span className="font-semibold">{selectedCust?.phone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-amber-800/70 block text-[10px] uppercase font-bold">Area / Address</span>
                        <span className="font-semibold">{selectedCust?.area || selectedCust?.address || '—'}</span>
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
                          <span>Bank Deposit</span>
                        </button>
                      </div>
                    </div>

                    {/* Target Bank selector if Bank payment */}
                    {paymentType === 'Bank' && (
                      <div className="bg-white/95 p-2.5 rounded-lg border border-cyan-300 space-y-1">
                        <label className="block text-xs font-bold text-cyan-950">
                          Receiving Bank Account
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

                    {/* Cash Received / Amount Paid Input Box */}
                    <div className="bg-white p-3 rounded-lg border-2 border-amber-300/90 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                          Amount Paid / Cash Received (Rs.)
                        </label>
                        <div className="flex space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPaidAmount(grandTotal);
                              setIsPaidTouched(true);
                            }}
                            className="px-2 py-0.5 text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold border border-emerald-300 transition"
                            title="Customer pays exact full bill"
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
                            <span className="text-slate-600 font-medium">Remaining Unpaid (Credit / Payable):</span>
                            <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Rs. {(grandTotal - paidAmount).toLocaleString()}
                            </span>
                          </>
                        ) : paidAmount > grandTotal ? (
                          <>
                            <span className="text-emerald-700 font-semibold">Extra Overpayment (Advance):</span>
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
                      selectedCust && selectedCust.id !== 'walk-in' ? (
                        currentAdvance > 0 ? (
                          (grandTotal - paidAmount) <= currentAdvance ? (
                            <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 p-2 rounded flex items-start space-x-2">
                              <UserCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-bold">Using Customer Advance</p>
                                <p className="text-[11px] text-emerald-800">
                                  Unpaid balance of Rs. {(grandTotal - paidAmount).toLocaleString()} will be deducted from customer advance (Rs. {currentAdvance.toLocaleString()}). Remaining advance: <span className="font-bold text-emerald-900">Rs. {projectedAdvance.toLocaleString()}</span>.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-amber-50 text-amber-950 border border-amber-300 p-2 rounded flex items-start space-x-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-bold">Advance Depleted + Udhaar Added</p>
                                <p className="text-[11px] text-amber-900">
                                  Unpaid balance (Rs. {(grandTotal - paidAmount).toLocaleString()}) uses all Rs. {currentAdvance.toLocaleString()} advance. Remaining <span className="font-bold text-rose-700">Rs. {(grandTotal - paidAmount - currentAdvance).toLocaleString()}</span> increases customer Outstanding.
                                </p>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="bg-rose-50 text-rose-950 border border-rose-300 p-2 rounded flex items-start space-x-2">
                            <ShieldAlert className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold">Credit Sale (Added to Outstanding)</p>
                              <p className="text-[11px] text-rose-800">
                                Unpaid balance of Rs. {(grandTotal - paidAmount).toLocaleString()} increases customer Outstanding. New Outstanding: <span className="font-bold text-rose-900">Rs. {projectedOutstanding.toLocaleString()}</span>.
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="bg-amber-50 text-amber-900 border border-amber-300 p-2 rounded flex items-start space-x-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-[11px]">
                            <span className="font-bold">Walk-in Customer:</span> Rs. {paidAmount.toLocaleString()} paid. Remaining Rs. {(grandTotal - paidAmount).toLocaleString()} unpaid. Select a registered customer account to track this credit ledger.
                          </p>
                        </div>
                      )
                    ) : paidAmount > grandTotal ? (
                      selectedCust && selectedCust.id !== 'walk-in' ? (
                        <div className="bg-emerald-50 text-emerald-950 border border-emerald-300 p-2 rounded flex items-start space-x-2">
                          <UserCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold">Excess Payment Goes to Customer Advance</p>
                            <p className="text-[11px] text-emerald-800">
                              Customer gave Rs. {(paidAmount - grandTotal).toLocaleString()} extra cash. This excess will be credited to their account as Advance. New Advance: <span className="font-bold text-emerald-900">Rs. {projectedAdvance.toLocaleString()}</span>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-950 border border-emerald-300 p-2 rounded flex items-start space-x-2">
                          <Wallet className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <p className="text-[11px]">
                            <span className="font-bold">Walk-in Overpayment:</span> Customer paid Rs. {(paidAmount - grandTotal).toLocaleString()} extra.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="bg-white/90 text-slate-700 border border-amber-200/90 p-2 rounded flex items-center space-x-2">
                        <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-[11px]">
                          <span className="font-bold text-slate-800">Full Payment Received:</span> Rs. {paidAmount.toLocaleString()} received. Customer ledger balance remains unaffected.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle Section: Dynamic Dispatched Materials Table & Quick Add */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                    <h4 className="text-sm font-bold text-slate-800">Dispatched Material Items</h4>
                    <span className="text-xs text-slate-500 font-mono">({tripItems.length} {tripItems.length === 1 ? 'item' : 'items'})</span>
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

                {/* Quick Add Material Bar (Prominent, unclipped selector) */}
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
                            subLabel: `Stock: ${st.toLocaleString()} ${i.unit}`,
                            badge: `Rs. ${i.saleRate.toLocaleString()} / ${i.unit}`,
                            badgeColor: 'emerald',
                            searchTerms: `${i.name} ${i.id} ${i.unit}`,
                          };
                        })}
                        value={quickItemId}
                        onChange={val => {
                          setQuickItemId(val);
                          const itm = items.find(i => i.id === val);
                          if (itm) setQuickRate(itm.saleRate);
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
                        Rate (Rs.)
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
                        <span>Add to Trip Table</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table of Dispatched Materials */}
                <div className="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-10">#</th>
                        <th className="px-3 py-2.5 text-left min-w-[240px]">Material Item</th>
                        <th className="px-3 py-2.5 text-center w-20">Unit</th>
                        <th className="px-3 py-2.5 text-center min-w-[110px]">Live Stock</th>
                        <th className="px-3 py-2.5 text-right w-28">Quantity</th>
                        <th className="px-3 py-2.5 text-right w-28">Rate (Rs.)</th>
                        <th className="px-3 py-2.5 text-right min-w-[110px]">Total (Rs.)</th>
                        <th className="px-3 py-2.5 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tripItems.map((row, idx) => {
                        const itemStock = (row.itemId && balances?.itemStocks[row.itemId] !== undefined)
                          ? balances.itemStocks[row.itemId]
                          : (items.find(i => i.id === row.itemId)?.currentStock || 0);

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2.5">
                              {/* Native dropdown that NEVER gets clipped by overflow */}
                              <select
                                value={row.itemId}
                                onChange={e => handleItemChange(idx, 'itemId', e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white text-slate-800"
                                required
                              >
                                <option value="">-- Choose Material ({items.length} in stock) --</option>
                                {items.map(i => {
                                  const st = balances?.itemStocks[i.id] !== undefined ? balances.itemStocks[i.id] : i.currentStock;
                                  return (
                                    <option key={i.id} value={i.id}>
                                      {i.name} ({i.unit}) — Stock: {st.toLocaleString()} {i.unit} • Rs. {i.saleRate.toLocaleString()}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-semibold text-[11px]">
                                {row.unit || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-semibold">
                              {row.itemId ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] ${itemStock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {itemStock.toLocaleString()} {row.unit}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                placeholder="0"
                                value={row.quantity === 0 ? '' : row.quantity}
                                onChange={e => handleItemChange(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-right font-semibold focus:outline-none focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                required
                                placeholder="0"
                                value={row.rate === 0 ? '' : row.rate}
                                onChange={e => handleItemChange(idx, 'rate', e.target.value === '' ? 0 : Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-right font-semibold focus:outline-none focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                              Rs. {Number(row.amount || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                disabled={tripItems.length <= 1}
                                className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 transition"
                                title={tripItems.length <= 1 ? "At least one item row is required" : "Remove line"}
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-700">
                      <tr>
                        <td colSpan={6} className="px-3 py-2.5 text-right uppercase text-[11px] tracking-wider">
                          Material Subtotal ({tripItems.length} {tripItems.length === 1 ? 'item' : 'items'}):
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-sm text-indigo-700">
                          Rs. {materialTotal.toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Trip Expenses Multi-Line Panel */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                  <h4 className="text-sm font-bold text-slate-800">Add Trip Expenses (Handwritten Categories)</h4>
                  <span className="text-xs text-slate-500 font-mono">({expenses.length} {expenses.length === 1 ? 'entry' : 'entries'})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Expense Category
                    </label>
                    <select
                      value={currentExpCategory}
                      onChange={e => setCurrentExpCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Expense Amount (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={currentExpAmount === 0 ? '' : currentExpAmount}
                      onChange={e => setCurrentExpAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2 flex space-x-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Expense Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={currentExpDesc}
                        onChange={e => setCurrentExpDesc(e.target.value)}
                        placeholder="e.g. Weighbridge slip, diesel pump"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddExpense}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-bold transition whitespace-nowrap h-9 shadow-sm"
                    >
                      + Add Expense
                    </button>
                  </div>
                </div>

                {/* Added Expenses list */}
                {expenses.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                        <tr>
                          <th className="px-4 py-2">Category</th>
                          <th className="px-4 py-2">Description</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expenses.map((exp, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-bold text-slate-700">{exp.category}</td>
                            <td className="px-4 py-2 text-slate-500">{exp.description || '—'}</td>
                            <td className="px-4 py-2 text-right font-medium">Rs. {exp.amount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveExpense(idx)}
                                className="text-rose-500 hover:text-rose-700 font-semibold"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-100 font-bold">
                        <tr>
                          <td colSpan={2} className="px-4 py-2 text-right text-slate-600 uppercase text-[11px]">Total Trip Expenses:</td>
                          <td className="px-4 py-2 text-right text-rose-600 font-mono">Rs. {totalExpenses.toLocaleString()}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Grand summary of calculations */}
              <div className="bg-slate-900 text-white rounded-xl p-5 grid grid-cols-2 md:grid-cols-5 gap-3 text-center shadow-inner">
                <div>
                  <p className="text-[11px] text-slate-400 uppercase font-semibold">Material Total</p>
                  <p className="text-base font-bold text-white">Rs. {materialTotal.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] text-indigo-300 uppercase font-semibold">Vehicle Charges</p>
                  <p className="text-base font-bold text-indigo-400">+Rs. {vehicleCharges.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] text-rose-300 uppercase font-semibold">Trip Expenses</p>
                  <p className="text-base font-bold text-rose-400">+Rs. {totalExpenses.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] text-amber-300 uppercase font-semibold">Discount</p>
                  <p className="text-base font-bold text-amber-400">-Rs. {discount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] text-emerald-300 uppercase font-semibold">Final Net Total</p>
                  <p className="text-lg font-black text-emerald-400">
                    Rs. {grandTotal.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Modal Footer / Save Bar */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-slate-800 text-sm font-bold flex items-center space-x-2">
                  <span>Total Bill Amount:</span>
                  <span className="text-indigo-600 text-xl font-black">Rs. {grandTotal.toLocaleString()}</span>
                  <span className="text-xs text-slate-500 font-medium">({paymentType})</span>
                </div>
                <div className="flex space-x-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md transition"
                  >
                    {editingId ? 'Save Trip Changes' : 'Dispatch & Post Trip'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Trip View Details Dialog Modal (Screen Only) */}
      {activeViewTrip && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-start z-50 no-print overflow-y-auto p-4 md:p-8">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-2xl text-xs p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-800 font-mono">Trip Dispatch Details: {activeViewTrip.id.substring(5, 12).toUpperCase()}</h3>
              <button onClick={() => setActiveViewTrip(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1 font-mono">
                <p className="font-bold text-slate-700">TRIP DETAILS:</p>
                <p>Trip ID: <span className="font-semibold">{activeViewTrip.id}</span></p>
                <p>Date: {activeViewTrip.date}</p>
                <p>Vehicle: {vehicles.find(v => v.id === activeViewTrip.vehicleId)?.number || (activeViewTrip.vehicleId ? activeViewTrip.vehicleId : '— (Direct / None)')} {vehicles.find(v => v.id === activeViewTrip.vehicleId)?.type ? `(${vehicles.find(v => v.id === activeViewTrip.vehicleId)?.type})` : ''}</p>
                <p>Driver: {activeViewTrip.driverName || '—'}</p>
                <p>Route: {activeViewTrip.from || '—'} ➔ {activeViewTrip.to || '—'}</p>
              </div>
              <div className="space-y-1 font-mono text-right">
                <p className="font-bold text-slate-700">CUSTOMER DETAILS:</p>
                <p>Name: <span className="font-semibold">{customers.find(c => c.id === activeViewTrip.customerId)?.name || (activeViewTrip.customerId === 'walk-in' ? 'Walk-in Customer' : activeViewTrip.customerId)}</span></p>
                <p>Phone: {customers.find(c => c.id === activeViewTrip.customerId)?.phone || 'N/A'}</p>
                <p>Area: {customers.find(c => c.id === activeViewTrip.customerId)?.area || 'N/A'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-700 font-mono">MATERIAL QUANTITY & RATE:</p>
              <table className="min-w-full divide-y divide-slate-200 text-left font-mono">
                <thead className="bg-slate-50 text-slate-600 font-bold">
                  <tr>
                    <th className="px-4 py-2">Item Description</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {activeViewTrip.items && activeViewTrip.items.length > 0 ? (
                    activeViewTrip.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-semibold">{it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}</td>
                        <td className="px-4 py-3 text-right">{it.quantity} {it.unit}</td>
                        <td className="px-4 py-3 text-right">Rs. {it.rate.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold">Rs. {it.amount.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-3 font-semibold">{items.find(i => i.id === activeViewTrip.itemId)?.name || activeViewTrip.itemId}</td>
                      <td className="px-4 py-3 text-right">{activeViewTrip.quantity} {activeViewTrip.unit}</td>
                      <td className="px-4 py-3 text-right">Rs. {activeViewTrip.rate.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold">Rs. {activeViewTrip.materialTotal.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {activeViewTrip.expenses && activeViewTrip.expenses.length > 0 && (
              <div className="space-y-2">
                <p className="font-bold text-slate-700 font-mono">TRIP EXPENSES:</p>
                <table className="min-w-full divide-y divide-slate-200 text-left font-mono">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activeViewTrip.expenses.map((exp: DBTripExpense, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-semibold">{exp.category}</td>
                        <td className="px-4 py-2 text-slate-500">{exp.description || '—'}</td>
                        <td className="px-4 py-2 text-right font-bold">Rs. {exp.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={2} className="px-4 py-2 text-right">Total Expenses:</td>
                      <td className="px-4 py-2 text-right">Rs. {activeViewTrip.totalExpenses.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <div className="w-80 space-y-1.5 border-t border-slate-300 pt-3 font-mono text-right">
                <div className="flex justify-between">
                  <span>Material Total:</span>
                  <span>Rs. {activeViewTrip.materialTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vehicle Charges (Freight):</span>
                  <span>+Rs. {activeViewTrip.vehicleCharges.toLocaleString()}</span>
                </div>
                {activeViewTrip.totalExpenses > 0 && (
                  <div className="flex justify-between">
                    <span>Trip Expenses Billed:</span>
                    <span>+Rs. {activeViewTrip.totalExpenses.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-rose-600">
                  <span>Discount Allowed:</span>
                  <span>-Rs. {(activeViewTrip.discount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 text-sm">
                  <span>Final Net Total:</span>
                  <span>Rs. {activeViewTrip.grandTotal.toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-100 my-1"></div>
                <div className="flex justify-between font-semibold">
                  <span>Paid Amount ({activeViewTrip.paymentType}):</span>
                  <span>Rs. {(activeViewTrip.paidAmount !== undefined ? activeViewTrip.paidAmount : (activeViewTrip.paymentType === 'Cash' || activeViewTrip.paymentType === 'Bank' ? activeViewTrip.grandTotal : 0)).toLocaleString()}</span>
                </div>
                {(() => {
                  const p = activeViewTrip.paidAmount !== undefined ? activeViewTrip.paidAmount : (activeViewTrip.paymentType === 'Cash' || activeViewTrip.paymentType === 'Bank' ? activeViewTrip.grandTotal : 0);
                  const diff = activeViewTrip.grandTotal - p;
                  if (diff > 0) {
                    return (
                      <div className="flex justify-between text-rose-600 font-bold">
                        <span>Remaining Due (Credit):</span>
                        <span>Rs. {diff.toLocaleString()}</span>
                      </div>
                    );
                  } else if (diff < 0) {
                    return (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Excess Added to Customer Advance:</span>
                        <span>+Rs. {(-diff).toLocaleString()}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Payment Status:</span>
                        <span>Fully Paid</span>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 no-print">
              <button
                onClick={() => setActiveViewTrip(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setActivePrintJob({ type: 'a4', data: activeViewTrip });
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
                  setActivePrintJob({ type: 'thermal', data: activeViewTrip });
                  setTimeout(() => {
                    window.print();
                    setActivePrintJob(null);
                  }, 100);
                }}
                className="bg-slate-800 hover:bg-slate-950 text-white font-semibold px-4 py-2 rounded text-xs transition flex items-center space-x-1"
              >
                <Printer className="h-3 w-3" />
                <span>Print Thermal Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
