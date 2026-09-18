import React, { useEffect, useState } from 'react';
import { 
  getAllRecords, 
  putRecord, 
  deleteRecord, 
  DBTrip, 
  DBCustomer, 
  DBItem, 
  DBVehicle, 
  DBBank, 
  DBTripExpense, 
  DBTripItem,
  DBStaff,
  DBVendor,
  DBDieselTransaction
} from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveTripTransaction, deleteTripTransaction, saveDieselTransaction } from '../db/transactions';
import { 
  Truck, Plus, Trash, Edit, ArrowRight, Printer, AlertTriangle, Download, 
  Search, X, FileText, UserCheck, Wallet, ShieldAlert, Calendar, Clock, 
  MapPin, Gauge, Timer, CheckCircle, Navigation, Layers, Info, Fuel
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

interface FormTripItem {
  id: string;
  itemId: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

// Utility to calculate duration between two time/datetime strings
function calculateHoursBetween(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  try {
    let s: Date;
    let e: Date;
    if (startStr.includes('T')) {
      s = new Date(startStr);
    } else {
      s = new Date(`2000-01-01T${startStr}`);
    }

    if (endStr.includes('T')) {
      e = new Date(endStr);
    } else {
      e = new Date(`2000-01-01T${endStr}`);
    }

    if (e.getTime() < s.getTime()) {
      // past midnight case
      e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
    }

    const diffHours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    return Math.max(0, parseFloat(diffHours.toFixed(2)));
  } catch {
    return 0;
  }
}

function getNowTimeStr(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function TripEntry() {
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billingFilter, setBillingFilter] = useState<'all' | 'fixed' | 'hourly'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activePrintJob, setActivePrintJob] = useState<{ type: 'thermal' | 'a4'; data: DBTrip } | null>(null);
  const [activeViewTrip, setActiveViewTrip] = useState<DBTrip | null>(null);

  // Form Field States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<'fixed' | 'hourly'>('fixed');
  const [tripStatus, setTripStatus] = useState<'active' | 'completed' | 'cancelled'>('completed');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverCnic, setDriverCnic] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [customerId, setCustomerId] = useState('walk-in');
  
  // Hourly Rental fields
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [totalHours, setTotalHours] = useState<number>(0);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [odometerStart, setOdometerStart] = useState<number | ''>('');
  const [odometerEnd, setOdometerEnd] = useState<number | ''>('');
  const [hoursStart, setHoursStart] = useState<number | ''>('');
  const [hoursEnd, setHoursEnd] = useState<number | ''>('');

  // Trip Items (Dispatched Materials)
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

  const [vendors, setVendors] = useState<DBVendor[]>([]);

  // Dedicated Trip Diesel States
  const [tripDieselVendorId, setTripDieselVendorId] = useState('');
  const [tripDieselLitres, setTripDieselLitres] = useState<number | ''>('');
  const [tripDieselRate, setTripDieselRate] = useState<number | ''>(280);
  const [tripDieselAmount, setTripDieselAmount] = useState<number>(0);
  const [tripDieselSlipNo, setTripDieselSlipNo] = useState('');
  const [tripDieselPaymentType, setTripDieselPaymentType] = useState<'Credit' | 'Cash' | 'Bank'>('Credit');
  const [tripDieselBankId, setTripDieselBankId] = useState('');

  // Trip Expenses State
  const [expenses, setExpenses] = useState<DBTripExpense[]>([]);
  const [currentExpCategory, setCurrentExpCategory] = useState('Food / Kharcha');
  const [currentExpAmount, setCurrentExpAmount] = useState(0);
  const [currentExpDesc, setCurrentExpDesc] = useState('');

  const handleTripDieselChange = (newLitres: number | '', newRate: number | '') => {
    setTripDieselLitres(newLitres);
    setTripDieselRate(newRate);
    if (typeof newLitres === 'number' && typeof newRate === 'number' && newLitres > 0 && newRate > 0) {
      setTripDieselAmount(Math.round(newLitres * newRate));
    } else {
      setTripDieselAmount(0);
    }
  };

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

      const [allItems, allVehicles, allStaff, allBanks, allTrips, allVendors] = await Promise.all([
        getAllRecords<DBItem>('items'),
        getAllRecords<DBVehicle>('vehicles'),
        getAllRecords<DBStaff>('staff'),
        getAllRecords<DBBank>('banks'),
        getAllRecords<DBTrip>('trips'),
        getAllRecords<DBVendor>('vendors')
      ]);

      setItems(allItems);
      setVehicles(allVehicles);
      setStaffList(allStaff);
      setBanks(allBanks);
      setVendors(allVendors);
      if (allBanks.length > 0 && !bankId) {
        setBankId(allBanks[0].id);
      }
      if (allBanks.length > 0 && !tripDieselBankId) {
        setTripDieselBankId(allBanks[0].id);
      }

      allTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTrips(allTrips);

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      setLoading(false);
    } catch (err) {
      console.error('Error loading trip data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle vehicle selection logic
  const handleSelectVehicle = (vId: string) => {
    setVehicleId(vId);
    if (!vId) return;

    const selectedVeh = vehicles.find(v => v.id === vId);
    if (selectedVeh) {
      if (selectedVeh.driver) setDriverName(selectedVeh.driver);
      if (selectedVeh.driverCnic) setDriverCnic(selectedVeh.driverCnic);
      if (selectedVeh.driverPhone) setDriverPhone(selectedVeh.driverPhone);
      if (selectedVeh.model || selectedVeh.make) {
        setVehicleModel(`${selectedVeh.make || ''} ${selectedVeh.model || ''}`.trim());
      }
      if (selectedVeh.currentOdometer !== undefined) {
        setOdometerStart(selectedVeh.currentOdometer);
      }
      if (selectedVeh.currentEngineHours !== undefined) {
        setHoursStart(selectedVeh.currentEngineHours);
      }

      // If vehicle operates on hourly basis, auto-suggest hourly billing mode
      if (selectedVeh.category === 'hours' || selectedVeh.measurement === 'hours') {
        setBillingType('hourly');
        if (selectedVeh.hourlyRate) {
          setHourlyRate(selectedVeh.hourlyRate);
          if (totalHours > 0) {
            setVehicleCharges(Math.round(totalHours * selectedVeh.hourlyRate));
          }
        }
      } else if (selectedVeh.category === 'trips' && selectedVeh.perTripRate) {
        setVehicleCharges(selectedVeh.perTripRate);
      }

      // Look up driver in staff if not already set
      if (selectedVeh.driver && (!selectedVeh.driverCnic || !selectedVeh.driverPhone)) {
        const staff = staffList.find(s => s.name.toLowerCase() === selectedVeh.driver.toLowerCase());
        if (staff) {
          if (!driverCnic && staff.cnic) setDriverCnic(staff.cnic);
          if (!driverPhone && staff.phone) setDriverPhone(staff.phone);
        }
      }
    }
  };

  // Auto-calculate total hours and rent when start/end times change
  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    if (newStart && newEnd) {
      const calcHours = calculateHoursBetween(newStart, newEnd);
      setTotalHours(calcHours);
      if (hourlyRate > 0) {
        setVehicleCharges(Math.round(calcHours * hourlyRate));
      }
    }
  };

  const handleHourlyRateChange = (rate: number) => {
    setHourlyRate(rate);
    if (totalHours > 0) {
      setVehicleCharges(Math.round(totalHours * rate));
    }
  };

  const handleTotalHoursChange = (hrs: number) => {
    setTotalHours(hrs);
    if (hourlyRate > 0) {
      setVehicleCharges(Math.round(hrs * hourlyRate));
    }
  };

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
      // If the only row is empty, replace it
      if (prev.length === 1 && !prev[0].itemId) {
        return [{ id: 'item-1', itemId: quickItemId, quantity: qty, unit, rate, amount }];
      }
      return [
        ...prev,
        { id: 'item-' + Date.now() + Math.random(), itemId: quickItemId, quantity: qty, unit, rate, amount }
      ];
    });

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
      setBillingType(trip.billingType || (trip.totalHours ? 'hourly' : 'fixed'));
      setTripStatus(trip.tripStatus || 'completed');
      setDate(trip.date);
      setVehicleId(trip.vehicleId || '');
      setVehicleModel(trip.vehicleModel || '');
      setDriverName(trip.driverName || '');
      setDriverCnic(trip.driverCnic || '');
      setDriverPhone(trip.driverPhone || '');
      setCustomerId(trip.customerId || 'walk-in');
      setStartTime(trip.startTime || '');
      setEndTime(trip.endTime || '');
      setTotalHours(trip.totalHours || 0);
      setHourlyRate(trip.hourlyRate || 0);
      setOdometerStart(trip.odometerStart !== undefined ? trip.odometerStart : '');
      setOdometerEnd(trip.odometerEnd !== undefined ? trip.odometerEnd : '');
      setHoursStart(trip.hoursStart !== undefined ? trip.hoursStart : '');
      setHoursEnd(trip.hoursEnd !== undefined ? trip.hoursEnd : '');

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
      
      // Load diesel from expenses if present
      const dExp = trip.expenses?.find(e => e.category === 'Diesel');
      if (dExp) {
        setTripDieselAmount(dExp.amount);
        setTripDieselLitres(dExp.amount > 0 && tripDieselRate ? Math.round((dExp.amount / (Number(tripDieselRate) || 280)) * 10) / 10 : '');
      } else {
        setTripDieselAmount(0);
        setTripDieselLitres('');
      }
      setTripDieselVendorId('');
      setTripDieselSlipNo('');
      setTripDieselPaymentType('Credit');
      setExpenses((trip.expenses || []).filter(e => e.category !== 'Diesel'));
    } else {
      setEditingId(null);
      setBillingType('fixed');
      setTripStatus('completed');
      setDate(new Date().toISOString().split('T')[0]);
      setCustomerId('walk-in');
      setVehicleId('');
      setVehicleModel('');
      setDriverName('');
      setDriverCnic('');
      setDriverPhone('');
      setStartTime('');
      setEndTime('');
      setTotalHours(0);
      setHourlyRate(0);
      setOdometerStart('');
      setOdometerEnd('');
      setHoursStart('');
      setHoursEnd('');
      setTripItems([{ id: 'item-1', itemId: '', quantity: 0, unit: 'Ton', rate: 0, amount: 0 }]);
      setVehicleCharges(0);
      setDiscount(0);
      setPaymentType('Cash');
      setPaidAmount(0);
      setIsPaidTouched(false);
      setFrom('');
      setTo('');
      setExpenses([]);
      setTripDieselVendorId('');
      setTripDieselLitres('');
      setTripDieselRate(280);
      setTripDieselAmount(0);
      setTripDieselSlipNo('');
      setTripDieselPaymentType('Credit');
      setTripDieselBankId(banks.length > 0 ? banks[0].id : '');
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

  // Calculations
  const validItems = tripItems.filter(i => i.itemId && i.quantity > 0);
  const materialTotal = validItems.reduce((sum, itm) => sum + itm.amount, 0);
  const otherExpenses = expenses.filter(e => e.category !== 'Diesel').reduce((sum, exp) => sum + exp.amount, 0);
  const totalExpenses = otherExpenses + tripDieselAmount;
  const grossTotal = materialTotal + vehicleCharges;
  const grandTotal = Math.max(0, grossTotal - discount);
  const netTripProfit = vehicleCharges - totalExpenses;

  // Selected customer balance logic
  const selectedCust = customers.find(c => c.id === customerId);
  const custBalInfo = balances?.customerBalances[customerId] || { outstanding: 0, advance: 0, netBalance: 0 };
  const currentAdvance = custBalInfo.advance || 0;
  const currentOutstanding = custBalInfo.outstanding || 0;

  let projectedAdvance = 0;
  let projectedOutstanding = 0;
  if (paidAmount < grandTotal) {
    const shortfall = grandTotal - paidAmount;
    if (currentAdvance > 0) {
      if (shortfall <= currentAdvance) {
        projectedAdvance = currentAdvance - shortfall;
        projectedOutstanding = 0;
      } else {
        projectedAdvance = 0;
        projectedOutstanding = currentOutstanding + (shortfall - currentAdvance);
      }
    } else {
      projectedOutstanding = currentOutstanding + shortfall;
    }
  } else {
    const excess = paidAmount - grandTotal;
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validItems.length === 0 && vehicleCharges <= 0) {
      alert('Please either add dispatched material items or enter vehicle freight / hourly rental charges.');
      return;
    }

    const effectiveCustomerId = customerId.trim() || 'walk-in';

    if (paymentType === 'Credit' && effectiveCustomerId === 'walk-in') {
      alert('Credit payment requires selecting a registered customer account. For walk-in customers, please select Cash or Bank.');
      return;
    }

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

    const primaryItem = validItems.length > 0 ? validItems[0] : null;
    const totalQty = validItems.reduce((sum, itm) => sum + itm.quantity, 0);

    const trip: DBTrip = {
      id: tripId,
      date,
      billingType,
      tripStatus,
      vehicleId: vehicleId.trim() || '',
      vehicleModel: vehicleModel.trim() || '',
      driverName: driverName.trim() || '',
      driverCnic: driverCnic.trim() || '',
      driverPhone: driverPhone.trim() || '',
      customerId: effectiveCustomerId,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      totalHours: totalHours > 0 ? totalHours : undefined,
      hourlyRate: hourlyRate > 0 ? hourlyRate : undefined,
      odometerStart: odometerStart !== '' ? Number(odometerStart) : undefined,
      odometerEnd: odometerEnd !== '' ? Number(odometerEnd) : undefined,
      hoursStart: hoursStart !== '' ? Number(hoursStart) : undefined,
      hoursEnd: hoursEnd !== '' ? Number(hoursEnd) : undefined,
      items: validItems.map(i => ({
        itemId: i.itemId,
        itemName: items.find(it => it.id === i.itemId)?.name || i.itemId,
        quantity: Number(i.quantity) || 0,
        unit: i.unit,
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || 0,
      })),
      itemId: primaryItem ? primaryItem.itemId : '',
      quantity: Number(totalQty) || 0,
      unit: primaryItem ? primaryItem.unit : 'Ton',
      rate: primaryItem ? Number(primaryItem.rate) || 0 : 0,
      materialTotal: Number(materialTotal) || 0,
      vehicleCharges: Number(vehicleCharges) || 0,
      discount: Number(discount) || 0,
      grandTotal: Number(grandTotal) || 0,
      paidAmount: Number(paidAmount) || 0,
      remainingBalance: (Number(grandTotal) || 0) - (Number(paidAmount) || 0),
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      expenses: [
        ...expenses.filter(e => e.category !== 'Diesel').map(e => ({
          category: e.category,
          amount: Number(e.amount) || 0,
          description: e.description || '',
        })),
        ...(tripDieselAmount > 0 ? [{
          category: 'Diesel',
          amount: tripDieselAmount,
          description: `Diesel: ${tripDieselLitres}L @ Rs. ${tripDieselRate}/L (${vendors.find(v => v.id === tripDieselVendorId)?.name || 'Fuel Pump'})`
        }] : [])
      ],
      totalExpenses: Number(totalExpenses) || 0,
      netTripProfit: Number(netTripProfit) || 0,
      from: from ? from.trim() : '',
      to: to ? to.trim() : '',
    };

    try {
      await saveTripTransaction(trip);

      // Automatically sync diesel entry to diesel_transactions page
      if (tripDieselAmount > 0) {
        const dieselTxId = `dsl-${tripId}`;
        const selectedPump = vendors.find(v => v.id === tripDieselVendorId);
        const dieselTx: DBDieselTransaction = {
          id: dieselTxId,
          date,
          vehicleId: vehicleId.trim() || 'unassigned',
          vehicleNumber: vehicles.find(v => v.id === vehicleId)?.number || vehicleId || undefined,
          driverName: driverName.trim() || undefined,
          vendorId: tripDieselVendorId || 'walk-in-pump',
          vendorName: selectedPump?.name || 'Fuel Pump',
          fuelPumpName: selectedPump?.name || 'Fuel Pump',
          slipNo: tripDieselSlipNo.trim() || undefined,
          litres: Number(tripDieselLitres) || 0,
          ratePerLitre: Number(tripDieselRate) || 0,
          totalAmount: tripDieselAmount,
          paidAmount: tripDieselPaymentType === 'Credit' ? 0 : tripDieselAmount,
          remainingBalance: tripDieselPaymentType === 'Credit' ? tripDieselAmount : 0,
          paymentType: tripDieselPaymentType,
          bankId: tripDieselPaymentType === 'Bank' ? tripDieselBankId : undefined,
          fuelType: 'Diesel',
          tripId: tripId,
          notes: `Trip ${tripId} Fuel - Route: ${from || 'Base'} to ${to || 'Site'}`
        };
        await saveDieselTransaction(dieselTx);
      }

      setIsFormOpen(false);
      await loadData();
      if (confirm('Print Receipt?\nDispatch / Rental voucher created successfully.')) {
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

  const handlePrintA4 = (trip: DBTrip) => {
    setActivePrintJob({ type: 'a4', data: trip });
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
    if (filteredTrips.length === 0) {
      alert('No trips found for the selected filter to download.');
      return;
    }

    const headers = [
      'Trip ID',
      'Date',
      'Billing Type',
      'Status',
      'Vehicle Number',
      'Vehicle Model',
      'Driver Name',
      'Driver Phone',
      'Customer Name',
      'Start Time',
      'End Time',
      'Total Hours',
      'Hourly Rate',
      'Material Total (PKR)',
      'Vehicle Freight / Rent (PKR)',
      'Trip Expenses (PKR)',
      'Discount (PKR)',
      'Net Profit (PKR)',
      'Grand Total (PKR)',
      'Paid Amount (PKR)',
      'Payment Type',
      'From Location',
      'Destination'
    ];

    const rows = filteredTrips.map(t => {
      const cust = customers.find(c => c.id === t.customerId)?.name || t.customerId;
      const veh = vehicles.find(v => v.id === t.vehicleId)?.number || t.vehicleId;
      return [
        `"${t.id}"`,
        `"${t.date}"`,
        `"${t.billingType || 'fixed'}"`,
        `"${t.tripStatus || 'completed'}"`,
        `"${veh}"`,
        `"${t.vehicleModel || ''}"`,
        `"${t.driverName || ''}"`,
        `"${t.driverPhone || ''}"`,
        `"${cust}"`,
        `"${t.startTime || ''}"`,
        `"${t.endTime || ''}"`,
        t.totalHours || 0,
        t.hourlyRate || 0,
        t.materialTotal || 0,
        t.vehicleCharges || 0,
        t.totalExpenses || 0,
        t.discount || 0,
        t.netTripProfit || 0,
        t.grandTotal || 0,
        t.paidAmount || 0,
        `"${t.paymentType}"`,
        `"${t.from || ''}"`,
        `"${t.to || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trips_and_rentals_${startDate || 'all'}_to_${endDate || 'latest'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    // Date filter
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;

    // Billing filter
    if (billingFilter === 'hourly' && t.billingType !== 'hourly') return false;
    if (billingFilter === 'fixed' && t.billingType === 'hourly') return false;

    // Search query filter
    if (!cleanSearch) return true;
    const cust = customers.find(c => c.id === t.customerId);
    const item = items.find(i => i.id === t.itemId);
    const veh = vehicles.find(v => v.id === t.vehicleId);
    return (
      t.id.toLowerCase().includes(cleanSearch) ||
      t.date.includes(cleanSearch) ||
      (t.driverName && t.driverName.toLowerCase().includes(cleanSearch)) ||
      (t.driverPhone && t.driverPhone.toLowerCase().includes(cleanSearch)) ||
      (t.from && t.from.toLowerCase().includes(cleanSearch)) ||
      (t.to && t.to.toLowerCase().includes(cleanSearch)) ||
      t.paymentType.toLowerCase().includes(cleanSearch) ||
      (cust && cust.name.toLowerCase().includes(cleanSearch)) ||
      (item && item.name.toLowerCase().includes(cleanSearch)) ||
      (veh && veh.number.toLowerCase().includes(cleanSearch))
    );
  });

  const paginatedTrips = filteredTrips.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return <div className="text-center py-10 font-bold text-slate-500">Loading trips and vehicle rentals ledger...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Thermal (80mm) Print Receipt Layout */}
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
            <p className="text-xs font-black uppercase tracking-wider text-black">
              {activePrintJob.data.billingType === 'hourly' ? 'VEHICLE HOURLY RENTAL SLIP (فی گھنٹہ کرایہ)' : 'MATERIAL DISPATCH & TRANSPORT SLIP'}
            </p>
            <div className="flex justify-between text-xs font-bold text-black mt-1">
              <span>Slip #: {activePrintJob.data.id}</span>
              <span>Date: {activePrintJob.data.date}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs font-mono text-black border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between">
              <span className="font-semibold">Vehicle No:</span>
              <span className="font-bold">
                {vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.number || (activePrintJob.data.vehicleId ? activePrintJob.data.vehicleId : 'Direct / Machine')}
                {activePrintJob.data.vehicleModel ? ` (${activePrintJob.data.vehicleModel})` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Driver:</span>
              <span className="font-bold">{activePrintJob.data.driverName || '—'} {activePrintJob.data.driverPhone ? `• ${activePrintJob.data.driverPhone}` : ''}</span>
            </div>
            {activePrintJob.data.driverCnic && (
              <div className="flex justify-between text-[11px]">
                <span>Driver CNIC:</span>
                <span className="font-bold">{activePrintJob.data.driverCnic}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-semibold">Customer:</span>
              <span className="font-bold">{customers.find(c => c.id === activePrintJob.data.customerId)?.name || (activePrintJob.data.customerId === 'walk-in' ? 'Walk-in Customer' : activePrintJob.data.customerId)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Route / Site:</span>
              <span className="font-bold">{activePrintJob.data.from || 'Base'} ➔ {activePrintJob.data.to || 'Site'}</span>
            </div>
          </div>

          {/* Hourly Rental Breakdown if applicable */}
          {activePrintJob.data.billingType === 'hourly' && (
            <div className="my-2 border-b border-dashed border-black pb-2 font-mono text-xs text-black space-y-1 bg-slate-50 p-1.5 rounded">
              <div className="font-bold uppercase text-[11px] border-b border-dashed border-black pb-0.5">Rental Duration &amp; Meter Readings</div>
              <div className="flex justify-between">
                <span>Start Time (روانگی):</span>
                <span className="font-bold">{activePrintJob.data.startTime || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Return Time (واپسی):</span>
                <span className="font-bold">{activePrintJob.data.endTime || '—'}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-dotted border-black pt-0.5">
                <span>Total Hours (کل گھنٹے):</span>
                <span className="font-black text-sm">{activePrintJob.data.totalHours || 0} Hours</span>
              </div>
              <div className="flex justify-between">
                <span>Hourly Rate (فی گھنٹہ ریٹ):</span>
                <span className="font-bold">Rs. {(activePrintJob.data.hourlyRate || 0).toLocaleString()} / Hr</span>
              </div>
              {(activePrintJob.data.odometerStart !== undefined || activePrintJob.data.odometerEnd !== undefined) && (
                <div className="flex justify-between text-[11px] pt-0.5 border-t border-dotted border-slate-300">
                  <span>Odometer:</span>
                  <span>{activePrintJob.data.odometerStart ?? '—'} km ➔ {activePrintJob.data.odometerEnd ?? '—'} km</span>
                </div>
              )}
            </div>
          )}

          {/* Dispatched Materials Table (if any) */}
          {activePrintJob.data.items && activePrintJob.data.items.length > 0 && activePrintJob.data.items.some(i => i.quantity > 0) && (
            <table className="w-full text-left border-collapse my-2 font-mono text-xs text-black">
              <thead>
                <tr className="border-b-2 border-dashed border-black font-bold uppercase">
                  <th className="py-1 text-left">Item</th>
                  <th className="py-1 text-right whitespace-nowrap">Qty</th>
                  <th className="py-1 text-center whitespace-nowrap">Unit</th>
                  <th className="py-1 text-right whitespace-nowrap">Rate</th>
                  <th className="py-1 text-right whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-300">
                {activePrintJob.data.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1 font-bold max-w-[85px] break-words">
                      {it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}
                    </td>
                    <td className="py-1 text-right font-bold whitespace-nowrap">{it.quantity}</td>
                    <td className="py-1 text-center font-semibold whitespace-nowrap">{it.unit}</td>
                    <td className="py-1 text-right font-semibold whitespace-nowrap">Rs. {it.rate.toLocaleString()}</td>
                    <td className="py-1 text-right font-black whitespace-nowrap">Rs. {it.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dashed border-black font-bold">
                  <td colSpan={3} className="py-1 text-left">
                    Total Items: {activePrintJob.data.items.length}
                  </td>
                  <td className="py-1 text-right font-bold">Mat Total:</td>
                  <td className="py-1 text-right font-black">Rs. {activePrintJob.data.materialTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* Itemized Trip Expenses Breakdown */}
          {activePrintJob.data.expenses && activePrintJob.data.expenses.length > 0 && (
            <div className="my-2 border-t border-b border-dashed border-black py-1.5 font-mono text-black">
              <div className="flex justify-between items-center font-black text-xs uppercase mb-1">
                <span>Trip Expenses &amp; Toll:</span>
                <span>Rs. {activePrintJob.data.totalExpenses.toLocaleString()}</span>
              </div>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-dashed border-slate-300 font-bold uppercase">
                    <th className="py-0.5 text-left">Expense Particulars</th>
                    <th className="py-0.5 text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dotted divide-slate-300">
                  {activePrintJob.data.expenses.map((exp, idx) => (
                    <tr key={idx}>
                      <td className="py-0.5 font-semibold">
                        {exp.category} {exp.description ? `(${exp.description})` : ''}
                      </td>
                      <td className="py-0.5 text-right font-bold whitespace-nowrap">
                        Rs. {Number(exp.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Financial Summary */}
          <div className="space-y-1 text-xs font-mono text-black">
            {activePrintJob.data.materialTotal > 0 && (
              <div className="flex justify-between font-semibold">
                <span>Material Total:</span>
                <span className="font-bold">Rs. {activePrintJob.data.materialTotal.toLocaleString()}</span>
              </div>
            )}
            {activePrintJob.data.vehicleCharges > 0 && (
              <div className="flex justify-between font-semibold">
                <span>{activePrintJob.data.billingType === 'hourly' ? 'Vehicle Rental Charges:' : 'Vehicle Freight Charges:'}</span>
                <span className="font-bold">+Rs. {activePrintJob.data.vehicleCharges.toLocaleString()}</span>
              </div>
            )}
            {activePrintJob.data.totalExpenses > 0 && (
              <div className="flex justify-between font-semibold">
                <span>Trip Expenses Billed:</span>
                <span className="font-bold">+Rs. {activePrintJob.data.totalExpenses.toLocaleString()}</span>
              </div>
            )}
            
            <div className="border-t border-dashed border-black my-1"></div>

            <div className="flex justify-between font-bold">
              <span>Gross Total:</span>
              <span>Rs. {(activePrintJob.data.materialTotal + activePrintJob.data.vehicleCharges + activePrintJob.data.totalExpenses).toLocaleString()}</span>
            </div>
            {activePrintJob.data.discount > 0 && (
              <div className="flex justify-between font-bold">
                <span>Discount Allowed:</span>
                <span>-Rs. {(activePrintJob.data.discount || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm border-t-2 border-b-2 border-double border-black py-1 my-1">
              <span>NET GRAND TOTAL:</span>
              <span>Rs. {activePrintJob.data.grandTotal.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between pt-1 font-semibold">
              <span>Payment Mode:</span>
              <span className="font-bold">{activePrintJob.data.paymentType}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Paid Amount:</span>
              <span className="font-black">
                Rs. {(activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.grandTotal : 0)).toLocaleString()}
              </span>
            </div>
            {(() => {
              const p = activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.grandTotal : 0);
              const diff = activePrintJob.data.grandTotal - p;
              if (diff > 0) {
                return (
                  <div className="flex justify-between font-bold border border-black p-1 rounded mt-1 bg-slate-50">
                    <span>Remaining Due (Credit):</span>
                    <span>Rs. {diff.toLocaleString()}</span>
                  </div>
                );
              } else if (diff < 0) {
                return (
                  <div className="flex justify-between font-bold border border-black p-1 rounded mt-1 bg-slate-50">
                    <span>Overpayment (Advance):</span>
                    <span>+Rs. {(-diff).toLocaleString()}</span>
                  </div>
                );
              } else {
                return (
                  <div className="flex justify-between font-bold pt-0.5 text-emerald-800">
                    <span>Payment Status:</span>
                    <span>✓ Fully Paid (Clear)</span>
                  </div>
                );
              }
            })()}
          </div>
          
          <div className="print-footer text-center mt-4 text-[10px] font-bold font-mono border-t border-dashed border-black pt-2">
            Software by Roonjha Developers - 03152914836
          </div>
        </div>
      )}

      {/* A4 Invoice Print Layout */}
      {activePrintJob && activePrintJob.type === 'a4' && (
        <div className="print-only print-a4 p-8 bg-white text-slate-900 font-sans max-w-4xl mx-auto">
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center space-x-4">
              <img src="/logo.jpeg" alt="Logo" className="h-20 w-auto object-contain" />
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">AL-MADINA CONSTRUCTION COMPANY</h1>
                <p className="text-sm font-bold text-slate-700">Dumping, Heavy Logistics, Civil Construction &amp; Earth Moving</p>
                <p className="text-xs text-slate-600 mt-1">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 | Haji Gul: 03458829298</p>
                <p className="text-xs text-slate-600">Main RCD Highway, Winder, District Lasbela, Balochistan</p>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded text-sm font-black uppercase tracking-wider mb-2">
                {activePrintJob.data.billingType === 'hourly' ? 'HOURLY RENTAL INVOICE' : 'LOGISTICS DISPATCH INVOICE'}
              </div>
              <p className="text-sm font-bold font-mono">Invoice #: {activePrintJob.data.id}</p>
              <p className="text-xs text-slate-600 font-semibold">Date: {activePrintJob.data.date}</p>
            </div>
          </div>

          {/* Billed To and Trip Profile Grid */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-sm">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Billed To (Customer)</h3>
              <p className="text-base font-bold text-slate-900">
                {customers.find(c => c.id === activePrintJob.data.customerId)?.name || (activePrintJob.data.customerId === 'walk-in' ? 'Walk-in Customer' : activePrintJob.data.customerId)}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Phone: {customers.find(c => c.id === activePrintJob.data.customerId)?.phone || '—'}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Address: {customers.find(c => c.id === activePrintJob.data.customerId)?.address || customers.find(c => c.id === activePrintJob.data.customerId)?.area || 'Counter'}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Fleet &amp; Driver Details</h3>
              <p className="font-bold text-slate-900">
                Vehicle: {vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.number || (activePrintJob.data.vehicleId ? activePrintJob.data.vehicleId : 'Direct Machine')}
                {activePrintJob.data.vehicleModel ? ` (${activePrintJob.data.vehicleModel})` : ''}
              </p>
              <p className="text-xs text-slate-600 font-medium">Driver: {activePrintJob.data.driverName || '—'} {activePrintJob.data.driverPhone ? `(${activePrintJob.data.driverPhone})` : ''}</p>
              {activePrintJob.data.driverCnic && <p className="text-xs text-slate-600 font-medium">Driver CNIC: {activePrintJob.data.driverCnic}</p>}
              <p className="text-xs text-slate-600 font-medium">Route: {activePrintJob.data.from || 'Base'} ➔ {activePrintJob.data.to || 'Site'}</p>
            </div>
          </div>

          {/* Hourly Breakdown in A4 */}
          {activePrintJob.data.billingType === 'hourly' && (
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 mb-6 text-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 mb-2 flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-indigo-700" />
                <span>Hourly Rental Specification (فی گھنٹہ کرایہ تفصیل)</span>
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-indigo-700 font-medium block">Departure Time:</span>
                  <span className="font-bold text-indigo-950">{activePrintJob.data.startTime || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-indigo-700 font-medium block">Return Time:</span>
                  <span className="font-bold text-indigo-950">{activePrintJob.data.endTime || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-indigo-700 font-medium block">Total Duration:</span>
                  <span className="font-black text-indigo-950 text-base">{activePrintJob.data.totalHours || 0} Hours</span>
                </div>
                <div>
                  <span className="text-xs text-indigo-700 font-medium block">Hourly Rate:</span>
                  <span className="font-black text-indigo-950 text-base">Rs. {(activePrintJob.data.hourlyRate || 0).toLocaleString()} / Hr</span>
                </div>
              </div>
            </div>
          )}

          {/* Items Table in A4 */}
          {activePrintJob.data.items && activePrintJob.data.items.length > 0 && activePrintJob.data.items.some(i => i.quantity > 0) && (
            <div className="mb-6">
              <table className="w-full text-left border-collapse border border-slate-200 text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                  <tr>
                    <th className="p-2.5 border border-slate-200">#</th>
                    <th className="p-2.5 border border-slate-200">Dispatched Material Description</th>
                    <th className="p-2.5 border border-slate-200 text-right">Quantity</th>
                    <th className="p-2.5 border border-slate-200 text-center">Unit</th>
                    <th className="p-2.5 border border-slate-200 text-right">Unit Rate (PKR)</th>
                    <th className="p-2.5 border border-slate-200 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activePrintJob.data.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 border border-slate-200 font-mono text-xs">{idx + 1}</td>
                      <td className="p-2.5 border border-slate-200 font-bold text-slate-800">
                        {it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-right font-bold">{it.quantity}</td>
                      <td className="p-2.5 border border-slate-200 text-center font-medium">{it.unit}</td>
                      <td className="p-2.5 border border-slate-200 text-right font-medium">{it.rate.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-200 text-right font-black">{it.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals and Signatures */}
          <div className="grid grid-cols-2 gap-8 items-start mb-12">
            <div>
              {activePrintJob.data.expenses && activePrintJob.data.expenses.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <h4 className="font-bold text-slate-700 mb-1 uppercase tracking-wide">Billed Expenses Breakdown</h4>
                  <div className="space-y-1">
                    {activePrintJob.data.expenses.map((e, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{e.category} {e.description ? `(${e.description})` : ''}:</span>
                        <span className="font-bold">Rs. {Number(e.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">Material Subtotal:</span>
                <span className="font-bold">Rs. {activePrintJob.data.materialTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">{activePrintJob.data.billingType === 'hourly' ? 'Vehicle Hourly Rent:' : 'Vehicle Freight:'}</span>
                <span className="font-bold">+Rs. {activePrintJob.data.vehicleCharges.toLocaleString()}</span>
              </div>
              {activePrintJob.data.totalExpenses > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Trip Expenses:</span>
                  <span className="font-bold">+Rs. {activePrintJob.data.totalExpenses.toLocaleString()}</span>
                </div>
              )}
              {activePrintJob.data.discount > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span className="font-semibold">Discount Allowed:</span>
                  <span className="font-bold">-Rs. {activePrintJob.data.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t-2 border-slate-800 pt-2 flex justify-between text-lg font-black text-slate-900">
                <span>Grand Total:</span>
                <span>Rs. {activePrintJob.data.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1">
                <span>Amount Paid ({activePrintJob.data.paymentType}):</span>
                <span className="font-bold text-emerald-700">
                  Rs. {(activePrintJob.data.paidAmount !== undefined ? activePrintJob.data.paidAmount : (activePrintJob.data.paymentType === 'Cash' || activePrintJob.data.paymentType === 'Bank' ? activePrintJob.data.grandTotal : 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-300 text-rose-800">
                <span>Balance Due:</span>
                <span>Rs. {Math.max(0, activePrintJob.data.grandTotal - (activePrintJob.data.paidAmount || 0)).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 text-center pt-8 border-t border-slate-200 text-xs font-semibold text-slate-600">
            <div>
              <div className="border-b border-slate-400 pb-8 mb-1"></div>
              <span>Driver / Logistics Incharge</span>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8 mb-1"></div>
              <span>Customer Signature / Receiver</span>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8 mb-1"></div>
              <span>Authorized Signatory</span>
            </div>
          </div>

          <div className="print-footer text-center mt-8 text-xs text-slate-400 font-mono">
            Software by Roonjha Developers - 03152914836
          </div>
        </div>
      )}

      {/* Main UI Workspace */}
      <div className={`space-y-6 ${activePrintJob ? 'no-print' : ''}`}>
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
              <Truck className="h-6 w-6 text-indigo-600" />
              <span>Logistics Trips &amp; Hourly Rentals (ٹرپ لاگنگ اور گھنٹہ کرایہ)</span>
            </h2>
            <p className="text-sm text-slate-500">Record vehicle materials deliveries, log hourly rentals, track driver revenues and route expenses</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTripsCSV}
              className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm"
              title="Download filtered trips as CSV spreadsheet"
            >
              <Download className="h-4 w-4" />
              <span>Download CSV</span>
            </button>
            <button
              onClick={handlePrintAllTripsLedger}
              className="flex items-center space-x-1.5 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm"
              title="Print complete ledger of dispatches"
            >
              <Printer className="h-4 w-4" />
              <span>Print Register</span>
            </button>
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Log Trip / Rental</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search trip no, vehicle, driver, customer, route, phone..."
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-slate-50/50"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
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

            {/* Mode Filter Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setBillingFilter('all')}
                className={`px-3 py-1.5 rounded-md transition ${billingFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All Entries ({trips.length})
              </button>
              <button
                type="button"
                onClick={() => setBillingFilter('fixed')}
                className={`px-3 py-1.5 rounded-md transition ${billingFilter === 'fixed' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Standard Trips ({trips.filter(t => t.billingType !== 'hourly').length})
              </button>
              <button
                type="button"
                onClick={() => setBillingFilter('hourly')}
                className={`px-3 py-1.5 rounded-md transition ${billingFilter === 'hourly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Hourly Rentals ({trips.filter(t => t.billingType === 'hourly').length})
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition flex items-center space-x-1"
                  title="Clear date filter"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtered Statistics Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Total Filtered</p>
            <p className="text-lg font-black text-slate-800">{filteredTrips.length}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Vehicle Freight / Rent</p>
            <p className="text-lg font-black text-indigo-700">Rs. {filteredTrips.reduce((s, t) => s + (t.vehicleCharges || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Trip Expenses</p>
            <p className="text-lg font-black text-rose-600">Rs. {filteredTrips.reduce((s, t) => s + (t.totalExpenses || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Net Logistics Profit</p>
            <p className="text-lg font-black text-emerald-600">Rs. {filteredTrips.reduce((s, t) => s + (t.netTripProfit || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
            <p className="text-[11px] font-medium text-slate-500">Total Invoiced</p>
            <p className="text-lg font-black text-slate-900">Rs. {filteredTrips.reduce((s, t) => s + (t.grandTotal || 0), 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Dispatches & Rentals Ledger Table */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-3 py-3.5 whitespace-nowrap">Date / ID</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Mode / Status</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Vehicle &amp; Driver</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Customer</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Route / Duration</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Materials Dispatched</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Freight / Rent</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Expenses</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Invoice Total</th>
                  <th className="px-3 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTrips.map(t => {
                  const cust = customers.find(c => c.id === t.customerId);
                  const veh = vehicles.find(v => v.id === t.vehicleId);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 block">{t.id}</span>
                        <span className="text-xs text-slate-500">{t.date}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {t.billingType === 'hourly' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="h-3 w-3" />
                            <span>Hourly ({t.totalHours || 0}h)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <Truck className="h-3 w-3" />
                            <span>Standard Trip</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{veh?.number || (t.vehicleId ? t.vehicleId : '— (Direct / None)')}</p>
                        <p className="text-xs text-slate-500">{t.driverName || '—'} {t.driverPhone ? `• ${t.driverPhone}` : ''}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{cust?.name || (t.customerId === 'walk-in' ? 'Walk-in Customer' : t.customerId)}</p>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{t.paymentType}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-xs font-semibold text-slate-700">
                          {t.from || 'Base'} ➔ {t.to || 'Site'}
                        </p>
                        {t.billingType === 'hourly' && (t.startTime || t.endTime) && (
                          <p className="text-[11px] font-mono text-amber-800">
                            {t.startTime || '—'} to {t.endTime || '—'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {t.items && t.items.length > 0 && t.items.some(i => i.quantity > 0) ? (
                          <div className="space-y-0.5">
                            {t.items.filter(i => i.quantity > 0).map((it, idx) => (
                              <div key={idx} className="text-xs leading-tight whitespace-nowrap">
                                <span className="font-semibold text-slate-700">{it.itemName || items.find(i => i.id === it.itemId)?.name || it.itemId}</span>
                                <span className="text-slate-500 ml-1 font-mono">({it.quantity} {it.unit})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No materials (Machine only)</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                        Rs. {t.vehicleCharges.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-rose-600 font-medium whitespace-nowrap">
                        Rs. {t.totalExpenses.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <p className="font-black text-slate-900">Rs. {t.grandTotal.toLocaleString()}</p>
                        {t.paidAmount !== undefined && t.paidAmount < t.grandTotal ? (
                          <p className="text-[10px] text-rose-600 font-bold">
                            Due: Rs. {(t.grandTotal - t.paidAmount).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-[10px] text-emerald-600 font-bold">Paid</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap no-print">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handlePrintReceipt(t)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Print 80mm Thermal Receipt"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrintA4(t)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Print A4 Invoice"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(t)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                            title="Edit Trip"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete Trip"
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
            totalItems={filteredTrips.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Main Create / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:px-6 flex items-center justify-between border-b border-indigo-900">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {editingId ? `Edit Dispatch / Rental (#${editingId})` : 'Log New Trip Dispatch / Hourly Rental'}
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Create delivery slip, deduct inventory materials, bill vehicle freight / per-hour charges
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Billing Mode Switcher */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Select Dispatch / Rental Mode:</span>
                  <span className="text-sm font-black text-slate-800">
                    {billingType === 'hourly' ? '⏱️ Hourly Rental (فی گھنٹہ کرایہ - گاڑی اور مشینری)' : '🚛 Standard Logistics Dispatch (پر ٹن / فکسڈ ٹرپ)'}
                  </span>
                </div>
                <div className="flex items-center bg-white p-1 rounded-lg border border-slate-300 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setBillingType('fixed')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                      billingType === 'fixed'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Standard Trip / By Ton</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillingType('hourly');
                      if (hourlyRate <= 0 && vehicleId) {
                        const v = vehicles.find(veh => veh.id === vehicleId);
                        if (v && v.hourlyRate) {
                          setHourlyRate(v.hourlyRate);
                          if (totalHours > 0) setVehicleCharges(Math.round(totalHours * v.hourlyRate));
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                      billingType === 'hourly'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Hourly Rental (فی گھنٹہ)</span>
                  </button>
                </div>
              </div>

              {/* Top Row: Date, Vehicle, Driver Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Vehicle (گاڑی / مشین منتخب کریں)
                  </label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'None / Direct Third-Party' },
                      ...vehicles.map(v => ({
                        value: v.id,
                        label: `${v.number} (${v.type || 'Vehicle'})`,
                        subLabel: `${v.driver ? `Driver: ${v.driver}` : 'No driver'} • Cat: ${v.category || 'tons'}${v.hourlyRate ? ` • Rs. ${v.hourlyRate}/hr` : ''}`,
                        searchTerms: `${v.number} ${v.type} ${v.driver || ''} ${v.model || ''}`,
                      }))
                    ]}
                    value={vehicleId}
                    onChange={val => handleSelectVehicle(val)}
                    placeholder="-- Select Vehicle / Dumper --"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Driver Name &amp; Phone
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder="Driver Name"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Driver Phone"
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Hourly Rental Specific Panel (Active when Hourly selected) */}
              {billingType === 'hourly' && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-amber-700" />
                      <h4 className="font-bold text-amber-950 text-sm">Hourly Rental Parameters (فی گھنٹہ حساب کتاب)</h4>
                    </div>
                    <span className="text-xs font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      Auto-calculates hours &amp; total rent
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Departure Time */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-amber-950">Start Time (روانگی)</label>
                        <button
                          type="button"
                          onClick={() => handleTimeChange(getNowTimeStr(), endTime)}
                          className="text-[10px] text-amber-800 font-bold bg-amber-200/80 px-1.5 py-0.5 rounded hover:bg-amber-300 transition"
                        >
                          Now
                        </button>
                      </div>
                      <input
                        type="time"
                        value={startTime}
                        onChange={e => handleTimeChange(e.target.value, endTime)}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white font-semibold text-slate-800 focus:outline-none focus:border-amber-600"
                      />
                    </div>

                    {/* Return Time */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-amber-950">Return Time (واپسی)</label>
                        <button
                          type="button"
                          onClick={() => handleTimeChange(startTime, getNowTimeStr())}
                          className="text-[10px] text-amber-800 font-bold bg-amber-200/80 px-1.5 py-0.5 rounded hover:bg-amber-300 transition"
                        >
                          Now
                        </button>
                      </div>
                      <input
                        type="time"
                        value={endTime}
                        onChange={e => handleTimeChange(startTime, e.target.value)}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white font-semibold text-slate-800 focus:outline-none focus:border-amber-600"
                      />
                    </div>

                    {/* Total Hours */}
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">Total Hours (گھنٹے)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={totalHours === 0 ? '' : totalHours}
                        onChange={e => handleTotalHoursChange(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="e.g. 4.5"
                        className="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-sm bg-white font-black text-amber-900 focus:outline-none focus:border-amber-600"
                      />
                    </div>

                    {/* Hourly Rate */}
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">Rate / Hour (روپے فی گھنٹہ)</label>
                      <input
                        type="number"
                        min="0"
                        value={hourlyRate === 0 ? '' : hourlyRate}
                        onChange={e => handleHourlyRateChange(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="e.g. 1000"
                        className="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-sm bg-white font-black text-amber-900 focus:outline-none focus:border-amber-600"
                      />
                    </div>
                  </div>

                  {/* Meter Readings & Driver CNIC */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-amber-200 text-xs">
                    <div>
                      <label className="block font-semibold text-amber-900 mb-1">Meter Start (km / hr)</label>
                      <input
                        type="number"
                        value={odometerStart}
                        onChange={e => setOdometerStart(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Start Reading"
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-amber-900 mb-1">Meter End (km / hr)</label>
                      <input
                        type="number"
                        value={odometerEnd}
                        onChange={e => setOdometerEnd(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="End Reading"
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-amber-900 mb-1">Driver CNIC</label>
                      <input
                        type="text"
                        value={driverCnic}
                        onChange={e => setDriverCnic(e.target.value)}
                        placeholder="xxxxx-xxxxxxx-x"
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-amber-900 mb-1">Vehicle Model</label>
                      <input
                        type="text"
                        value={vehicleModel}
                        onChange={e => setVehicleModel(e.target.value)}
                        placeholder="e.g. Hino 500 / CAT 320"
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pickup and Drop Locations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center space-x-1">
                    <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Pickup Location (روانگی کی جگہ / Quarry / Yard)</span>
                  </label>
                  <input
                    type="text"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    placeholder="e.g. Winder Yard / Quarry Site"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center space-x-1">
                    <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Drop Location (منزل / Customer Site)</span>
                  </label>
                  <input
                    type="text"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    placeholder="e.g. Al-Madina Project Site / Hub"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Optional Material Items Dispatched (Stock Reduction) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Dispatched Material Items (اسٹاک آئٹم کمی - اگر کوئی مال لے جا رہے ہوں)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Stock automatically decreases in Inventory Ledger
                  </span>
                </div>

                {/* Quick Add Bar */}
                <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex-1 min-w-[180px]">
                    <SearchableSelect
                      options={[
                        { value: '', label: '-- Quick Pick Item --' },
                        ...items.map(i => {
                          const stock = balances?.itemStocks[i.id] || 0;
                          return {
                            value: i.id,
                            label: i.name,
                            subLabel: `Stock: ${stock} ${i.unit} • Rate: Rs. ${i.saleRate}`,
                            searchTerms: `${i.name} ${i.unit}`
                          };
                        })
                      ]}
                      value={quickItemId}
                      onChange={val => {
                        setQuickItemId(val);
                        const it = items.find(i => i.id === val);
                        if (it) setQuickRate(it.saleRate);
                      }}
                      placeholder="Select Material Item..."
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty (e.g. 650.50)"
                    value={quickQty === 0 ? '' : quickQty}
                    onChange={e => setQuickQty(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Rate (Rs.)"
                    value={quickRate === 0 ? '' : quickRate}
                    onChange={e => setQuickRate(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddItem}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    + Add Item
                  </button>
                </div>

                {/* Items List Rows */}
                <div className="space-y-2">
                  {tripItems.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                      <div className="col-span-5">
                        <select
                          value={row.itemId}
                          onChange={e => handleItemChange(idx, 'itemId', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">-- No Material Selected --</option>
                          {items.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.quantity === 0 ? '' : row.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                          placeholder="Qty (650.50)"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-right font-semibold"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.rate === 0 ? '' : row.rate}
                          onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                          placeholder="Rate"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-right font-semibold"
                        />
                      </div>
                      <div className="col-span-2 text-right font-bold text-xs text-slate-800">
                        Rs. {(row.amount || 0).toLocaleString()}
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dedicated Diesel / Fuel Section (Syncs directly with Diesel Management page) */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <Fuel className="h-5 w-5 text-amber-600" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        Trip Diesel &amp; Fueling (ڈیزل اندراج - خودکار ڈیزل پیج اور پمپ کھاتہ میں جائے گا)
                      </h4>
                      <p className="text-[11px] text-amber-700">
                        Fuel refilled for this trip will automatically appear on Diesel Management page
                      </p>
                    </div>
                  </div>
                  {tripDieselAmount > 0 && (
                    <span className="text-xs font-black text-amber-900 bg-amber-200 px-2.5 py-1 rounded-md border border-amber-300">
                      Total Diesel: Rs. {tripDieselAmount.toLocaleString()} ({tripDieselLitres} Litres)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-white p-3.5 rounded-xl border border-amber-200">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Fuel Pump / Vendor (پمپ یا وینڈر منتخب کریں)
                    </label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '-- Select Fuel Pump Vendor --' },
                        ...vendors.map(v => ({
                          value: v.id,
                          label: v.name,
                          subLabel: `${v.category || 'Fuel Supplier'} • Outstanding: Rs. ${(balances?.vendorBalances[v.id]?.outstanding || 0).toLocaleString()}`,
                          searchTerms: `${v.name} ${v.phone || ''}`
                        }))
                      ]}
                      value={tripDieselVendorId}
                      onChange={val => setTripDieselVendorId(val)}
                      placeholder="Select Fuel Pump..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Litres Filled (لیٹر)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="e.g. 80"
                      value={tripDieselLitres === 0 ? '' : tripDieselLitres}
                      onChange={e => handleTripDieselChange(e.target.value === '' ? '' : Number(e.target.value), tripDieselRate)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Rate / Litre (ریٹ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="280"
                      value={tripDieselRate === '' ? '' : tripDieselRate}
                      onChange={e => handleTripDieselChange(tripDieselLitres, e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Slip / Invoice #
                    </label>
                    <input
                      type="text"
                      placeholder="Pump Slip #"
                      value={tripDieselSlipNo}
                      onChange={e => setTripDieselSlipNo(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={tripDieselPaymentType}
                      onChange={e => setTripDieselPaymentType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                    >
                      <option value="Credit">Credit / Pay Later (پمپ ادھار کھاتہ)</option>
                      <option value="Cash">Cash (روکڑا ادائیگی)</option>
                      <option value="Bank">Bank Transfer (بینک ادائیگی)</option>
                    </select>
                  </div>

                  {tripDieselPaymentType === 'Bank' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Bank Account
                      </label>
                      <select
                        value={tripDieselBankId}
                        onChange={e => setTripDieselBankId(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{b.name} - {b.accountNumber}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="sm:col-span-2 md:col-span-3 lg:col-span-6 flex justify-between items-center bg-amber-100/50 p-2.5 rounded-lg border border-amber-200">
                    <span className="text-xs font-bold text-amber-900">
                      Calculated Diesel Cost:
                    </span>
                    <span className="text-sm font-black text-amber-950">
                      Rs. {tripDieselAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trip Expenses Breakdown (Toll, Food, Mistri, etc.) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Other Route Expenses &amp; Tolls (ٹول پلازہ، کھانا، مستری خرچہ)
                  </h4>
                  <span className="text-xs font-bold text-rose-600">
                    Total: Rs. {totalExpenses.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                  <select
                    value={currentExpCategory}
                    onChange={e => setCurrentExpCategory(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {categoriesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount (Rs.)"
                    value={currentExpAmount === 0 ? '' : currentExpAmount}
                    onChange={e => setCurrentExpAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Description / Remarks"
                    value={currentExpDesc}
                    onChange={e => setCurrentExpDesc(e.target.value)}
                    className="flex-1 min-w-[150px] px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddExpense}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition"
                  >
                    + Add Expense
                  </button>
                </div>

                {expenses.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {expenses.map((exp, idx) => (
                      <span key={idx} className="inline-flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs px-2.5 py-1 rounded-lg">
                        <span className="font-bold">{exp.category}:</span>
                        <span>Rs. {exp.amount.toLocaleString()}</span>
                        {exp.description && <span className="text-slate-500">({exp.description})</span>}
                        <button
                          type="button"
                          onClick={() => handleRemoveExpense(idx)}
                          className="text-rose-400 hover:text-rose-700 ml-1 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Split Section: Customer & Payment on Golden Card vs Charges Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Charges Summary */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2">
                      Charges &amp; Freight Summary
                    </h4>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Material Items Total:</span>
                      <span className="font-bold text-slate-800">Rs. {materialTotal.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <label className="text-indigo-900 font-bold">
                        {billingType === 'hourly' ? 'Vehicle Hourly Rent (روپے):' : 'Vehicle Freight / Charges (روپے):'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={vehicleCharges === 0 ? '' : vehicleCharges}
                        onChange={e => setVehicleCharges(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-32 px-3 py-1.5 border-2 border-indigo-200 rounded-lg text-sm text-right font-black text-indigo-900 bg-indigo-50/40"
                      />
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Trip Expenses &amp; Commissions:</span>
                      <span className="font-bold text-rose-600">Rs. {totalExpenses.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <label className="text-slate-600 font-medium">Discount Allowed (Rs.):</label>
                      <input
                        type="number"
                        min="0"
                        value={discount === 0 ? '' : discount}
                        onChange={e => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-right font-semibold"
                      />
                    </div>

                    <div className="border-t-2 border-slate-800 pt-3 flex justify-between items-center">
                      <span className="text-base font-black text-slate-900">NET GRAND TOTAL:</span>
                      <span className="text-xl font-black text-indigo-700">Rs. {grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right Golden Card: Customer Profile & Payment */}
                <div className="lg:col-span-6 bg-gradient-to-br from-amber-50 to-amber-100/70 border-2 border-amber-300 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-amber-950">Customer Account</h4>
                          <p className="text-[11px] text-amber-800/80">Select customer or default walk-in</p>
                        </div>
                      </div>
                      <div>
                        {custBalInfo.outstanding > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                            Outstanding: Rs. {custBalInfo.outstanding.toLocaleString()}
                          </span>
                        ) : custBalInfo.advance > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Advance: Rs. {custBalInfo.advance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            Clear: Rs. 0
                          </span>
                        )}
                      </div>
                    </div>

                    <SearchableSelect
                      options={[
                        { value: 'walk-in', label: 'Walk-in Customer (General Counter Sales)', searchTerms: 'walk in cash counter' },
                        ...customers.filter(c => c.id !== 'walk-in').map(c => {
                          const bal = balances?.customerBalances[c.id] || { outstanding: 0, advance: 0 };
                          const curBal = bal.outstanding > 0 ? bal.outstanding : bal.advance;
                          const status = bal.outstanding > 0 ? 'Outstanding' : (bal.advance > 0 ? 'Advance' : 'Clear');
                          return {
                            value: c.id,
                            label: c.name,
                            subLabel: `${c.phone ? `Ph: ${c.phone}` : ''}${c.area ? ` • ${c.area}` : ''}`,
                            badge: `Rs. ${curBal.toLocaleString()} (${status})`,
                            badgeColor: (bal.outstanding > 0 ? 'rose' : bal.advance > 0 ? 'emerald' : 'slate') as any,
                            searchTerms: `${c.name} ${c.phone || ''} ${c.area || ''}`
                          };
                        })
                      ]}
                      value={customerId}
                      onChange={val => setCustomerId(val)}
                      placeholder="-- Select Customer --"
                    />

                    {/* Payment Mode Buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentType('Cash');
                          if (!isPaidTouched) setPaidAmount(grandTotal);
                        }}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition ${
                          paymentType === 'Cash'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        💵 Cash
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaymentType('Credit');
                          if (!isPaidTouched) setPaidAmount(0);
                        }}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition ${
                          paymentType === 'Credit'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        📋 Credit (Udhaar)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaymentType('Bank');
                          if (!isPaidTouched) setPaidAmount(grandTotal);
                        }}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition ${
                          paymentType === 'Bank'
                            ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
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
                          <option key={b.id} value={b.id}>{b.name} ({b.accountNumber || 'Account'})</option>
                        ))}
                      </select>
                    )}

                    {/* Paid Amount Input */}
                    <div className="bg-white p-3 rounded-lg border border-amber-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                          Amount Received (روپے)
                        </label>
                        <div className="flex space-x-1">
                          <button
                            type="button"
                            onClick={() => { setPaidAmount(grandTotal); setIsPaidTouched(true); }}
                            className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded font-bold hover:bg-emerald-200"
                          >
                            Full: Rs. {grandTotal.toLocaleString()}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPaidAmount(0); setIsPaidTouched(true); }}
                            className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded font-bold hover:bg-slate-200"
                          >
                            Rs. 0
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
                        className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg text-base font-black text-indigo-900 focus:outline-none focus:border-indigo-600 bg-white"
                        placeholder="0"
                      />

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        {paidAmount < grandTotal ? (
                          <span className="font-black text-rose-600">
                            Unpaid Due (Credit): Rs. {(grandTotal - paidAmount).toLocaleString()}
                          </span>
                        ) : paidAmount > grandTotal ? (
                          <span className="font-black text-emerald-700">
                            Overpayment (Advance): +Rs. {(paidAmount - grandTotal).toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700">✓ Fully Paid (Clear)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition flex items-center space-x-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{editingId ? 'Save & Update Record' : 'Save & Issue Dispatch / Rental Slip'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
