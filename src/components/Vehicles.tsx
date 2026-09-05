import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBVehicle, DBTrip, DBCustomer, DBItem } from '../db/indexedDB';
import { Truck, Plus, Edit, Trash, Printer, BookOpen, Search, X, ArrowLeft, FileText, Calendar, DollarSign, ArrowRight } from 'lucide-react';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Navigation States
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLedgerVehicle, setViewLedgerVehicle] = useState<DBVehicle | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');
  const [activeTripModal, setActiveTripModal] = useState<DBTrip | null>(null);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [type, setType] = useState('');
  const [driver, setDriver] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [active, setActive] = useState(true);

  const loadData = async () => {
    try {
      const allVehicles = await getAllRecords<DBVehicle>('vehicles');
      setVehicles(allVehicles);

      const allTrips = await getAllRecords<DBTrip>('trips');
      allTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTrips(allTrips);

      const allCustomers = await getAllRecords<DBCustomer>('customers');
      setCustomers(allCustomers);

      const allItems = await getAllRecords<DBItem>('items');
      setItems(allItems);

      setLoading(false);
    } catch (err) {
      console.error('Failed to load vehicles data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = (veh?: DBVehicle) => {
    if (veh) {
      setEditingId(veh.id);
      setNumber(veh.number);
      setType(veh.type || '');
      setDriver(veh.driver || '');
      setCapacity(veh.capacity || 0);
      setActive(veh.active);
    } else {
      setEditingId(null);
      setNumber('');
      setType('');
      setDriver('');
      setCapacity(0);
      setActive(true);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim()) {
      alert('Please enter a vehicle registration number');
      return;
    }

    try {
      const vehData: DBVehicle = {
        id: editingId || `veh_${Date.now()}`,
        number: number.trim().toUpperCase(),
        type: type.trim(),
        driver: driver.trim(),
        capacity: Number(capacity) || 0,
        active: active,
      };

      await putRecord<DBVehicle>('vehicles', vehData);
      await loadData();
      setIsFormOpen(false);
    } catch (err) {
      console.error('Failed to save vehicle:', err);
      alert('Error saving vehicle record');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await deleteRecord('vehicles', id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  };

  // Filtered vehicles for directory
  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredVehicles = vehicles.filter(v => {
    if (!cleanSearch) return true;
    return (
      v.number.toLowerCase().includes(cleanSearch) ||
      (v.type && v.type.toLowerCase().includes(cleanSearch)) ||
      (v.driver && v.driver.toLowerCase().includes(cleanSearch)) ||
      v.id.toLowerCase().includes(cleanSearch)
    );
  });

  // Vehicle Ledger Calculations
  let vehicleTrips: DBTrip[] = [];
  let vehicleExpensesList: {
    date: string;
    tripId: string;
    category: string;
    description: string;
    amount: number;
  }[] = [];

  if (viewLedgerVehicle) {
    const vId = viewLedgerVehicle.id;
    const vNum = viewLedgerVehicle.number.toUpperCase();

    // Match either by vehicleId foreign key or vehicle number
    vehicleTrips = trips.filter(t => t.vehicleId === vId || (t.vehicleId && t.vehicleId.toUpperCase() === vNum));

    // Collect all trip expenses
    vehicleTrips.forEach(t => {
      if (t.expenses && t.expenses.length > 0) {
        t.expenses.forEach(exp => {
          vehicleExpensesList.push({
            date: t.date,
            tripId: t.id,
            category: exp.category,
            description: exp.description || '—',
            amount: exp.amount,
          });
        });
      }
    });

    vehicleExpensesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Filter vehicle trips by search and date range
  const cleanLedgerSearch = ledgerSearch.toLowerCase().trim();
  const filteredVehicleTrips = vehicleTrips.filter(t => {
    if (ledgerDateFrom && t.date < ledgerDateFrom) return false;
    if (ledgerDateTo && t.date > ledgerDateTo) return false;
    if (!cleanLedgerSearch) return true;

    const cust = customers.find(c => c.id === t.customerId);
    const item = items.find(i => i.id === t.itemId);

    return (
      t.id.toLowerCase().includes(cleanLedgerSearch) ||
      t.date.includes(cleanLedgerSearch) ||
      t.driverName.toLowerCase().includes(cleanLedgerSearch) ||
      (t.from && t.from.toLowerCase().includes(cleanLedgerSearch)) ||
      (t.to && t.to.toLowerCase().includes(cleanLedgerSearch)) ||
      (cust && cust.name.toLowerCase().includes(cleanLedgerSearch)) ||
      (item && item.name.toLowerCase().includes(cleanLedgerSearch))
    );
  });

  // Filter vehicle expenses
  const filteredVehicleExpenses = vehicleExpensesList.filter(exp => {
    if (ledgerDateFrom && exp.date < ledgerDateFrom) return false;
    if (ledgerDateTo && exp.date > ledgerDateTo) return false;
    if (!cleanLedgerSearch) return true;

    return (
      exp.tripId.toLowerCase().includes(cleanLedgerSearch) ||
      exp.category.toLowerCase().includes(cleanLedgerSearch) ||
      exp.description.toLowerCase().includes(cleanLedgerSearch) ||
      exp.date.includes(cleanLedgerSearch)
    );
  });

  // Summary Totals
  const totalTripsCount = filteredVehicleTrips.length;
  const totalQtyTransported = filteredVehicleTrips.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const totalFreightEarned = filteredVehicleTrips.reduce((sum, t) => sum + (t.vehicleCharges || 0), 0);
  const totalExpensesIncurred = filteredVehicleTrips.reduce((sum, t) => sum + (t.totalExpenses || 0), 0);
  const totalNetProfit = totalFreightEarned - totalExpensesIncurred;
  const lastTripDate = filteredVehicleTrips.length > 0 ? filteredVehicleTrips[0].date : 'None logged';

  return (
    <div className="space-y-6">
      {/* 1. Vehicles Master Directory (Shown when NOT viewing an individual ledger) */}
      {!viewLedgerVehicle && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Vehicles Master Registry</h2>
              <p className="text-sm text-slate-500">Manage fleet trucks, assign drivers, and inspect vehicle trip ledgers</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Directory Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search vehicle no, driver, type..."
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
                <span>Add New Vehicle</span>
              </button>
            </div>
          </div>

          <div className="print-a4 print-container space-y-4">
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
                VEHICLES & FLEET DIRECTORY
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Total Vehicles: {filteredVehicles.length}</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Vehicle Number</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Assigned Driver</th>
                      <th className="px-6 py-4">Capacity (Tons/Qty)</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredVehicles.map(veh => (
                      <tr key={veh.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-800">{veh.number}</td>
                        <td className="px-6 py-4 text-slate-500">{veh.type || 'N/A'}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{veh.driver || 'Unassigned'}</td>
                        <td className="px-6 py-4 text-slate-500">{veh.capacity.toLocaleString()} Tons</td>
                        <td className="px-6 py-4">
                          {veh.active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap no-print">
                          <button
                            onClick={() => setViewLedgerVehicle(veh)}
                            className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                            title="View Vehicle Ledger"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>View Ledger</span>
                          </button>
                          <button
                            onClick={() => handleOpenForm(veh)}
                            className="text-slate-400 hover:text-indigo-600 p-1 transition"
                            title="Edit Vehicle"
                          >
                            <Edit className="h-4 w-4 inline" />
                          </button>
                          <button
                            onClick={() => handleDelete(veh.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition"
                            title="Delete Vehicle"
                          >
                            <Trash className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredVehicles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          <Truck className="h-10 w-10 mx-auto mb-2 stroke-1" />
                          <p className="text-sm font-medium">
                            {searchQuery ? `No matching vehicles found for "${searchQuery}".` : 'No vehicles registered. Register a dumper/truck to log trips.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredVehicles.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        <td colSpan={3} className="px-6 py-3 font-black">Fleet Totals ({filteredVehicles.length} Vehicles):</td>
                        <td className="px-6 py-3 font-black text-indigo-300">
                          {filteredVehicles.reduce((sum, v) => sum + (v.capacity || 0), 0).toLocaleString()} Tons
                        </td>
                        <td colSpan={2} className="no-print"></td>
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
      )}

      {/* 2. Individual Vehicle Ledger Statement View */}
      {viewLedgerVehicle && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print border-b border-slate-200 pb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setViewLedgerVehicle(null)}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
                title="Back to Vehicles Master"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                  <span>Vehicle Ledger: {viewLedgerVehicle.number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${viewLedgerVehicle.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {viewLedgerVehicle.active ? 'Active Fleet' : 'Inactive'}
                  </span>
                </h2>
                <p className="text-sm text-slate-500">
                  Complete history of dispatches, trip destinations, freight revenues, and maintenance expenses
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ledger</span>
              </button>
              <button
                onClick={() => setViewLedgerVehicle(null)}
                className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                Close Ledger
              </button>
            </div>
          </div>

          {/* Printable Layout Container */}
          <div className="print-a4 print-container space-y-6">
            {/* Printable Header */}
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
                VEHICLE TRIP DISPATCHES & EXPENSE LEDGER
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Vehicle No: {viewLedgerVehicle.number} ({viewLedgerVehicle.type || 'Dumper/Truck'})</div>
                <div>Driver: {viewLedgerVehicle.driver || 'Unassigned'}</div>
                <div>Capacity: {viewLedgerVehicle.capacity} Tons</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* Vehicle Current Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 no-print">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Trips</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{totalTripsCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Dispatches logged</p>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Qty Carried</p>
                <p className="text-2xl font-black text-indigo-700 mt-1">{totalQtyTransported.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tons / Units transported</p>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vehicle Charges</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">Rs. {totalFreightEarned.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Vehicle trip freight revenue</p>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</p>
                <p className="text-2xl font-black text-rose-600 mt-1">Rs. {totalExpensesIncurred.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Diesel, repair & tolls</p>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Vehicle Profit</p>
                <p className={`text-2xl font-black mt-1 ${totalNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Rs. {totalNetProfit.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Charges minus expenses</p>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Trip Date</p>
                <p className="text-sm font-bold text-slate-700 mt-2 font-mono">{lastTripDate}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Driver: {viewLedgerVehicle.driver || 'N/A'}</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4 no-print">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative min-w-[260px]">
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={e => setLedgerSearch(e.target.value)}
                    placeholder="Search trip no, destination, customer..."
                    className="w-full pl-8 pr-7 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                  />
                  <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-3" />
                  {ledgerSearch && (
                    <button
                      type="button"
                      onClick={() => setLedgerSearch('')}
                      className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5 p-0.5 rounded"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Date From */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500">From:</span>
                  <input
                    type="date"
                    value={ledgerDateFrom}
                    onChange={e => setLedgerDateFrom(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Date To */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500">To:</span>
                  <input
                    type="date"
                    value={ledgerDateTo}
                    onChange={e => setLedgerDateTo(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {(ledgerSearch || ledgerDateFrom || ledgerDateTo) && (
                  <button
                    onClick={() => {
                      setLedgerSearch('');
                      setLedgerDateFrom('');
                      setLedgerDateTo('');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              <div className="text-xs font-medium text-slate-500">
                Showing <span className="font-bold text-slate-800">{filteredVehicleTrips.length}</span> matching trips
              </div>
            </div>

            {/* Section 1: Vehicle Trip Dispatches Ledger */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <Truck className="h-4 w-4 text-indigo-600" />
                  <span>Trip Dispatches & Routes History (Where the vehicle went)</span>
                </h3>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs md:text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Trip No.</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Route (Destination)</th>
                        <th className="px-4 py-3">Driver</th>
                        <th className="px-4 py-3">Material & Qty</th>
                        <th className="px-4 py-3 text-right">Vehicle Charges</th>
                        <th className="px-4 py-3 text-right">Expenses</th>
                        <th className="px-4 py-3 text-right">Net Profit</th>
                        <th className="px-4 py-3 text-right no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredVehicleTrips.map(t => {
                        const cust = customers.find(c => c.id === t.customerId);
                        const item = items.find(i => i.id === t.itemId);

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{t.date}</td>
                            <td className="px-4 py-3 font-mono font-bold text-indigo-700 whitespace-nowrap">{t.id}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{cust?.name || t.customerId}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-700">{t.from || 'Origin'}</span>
                              <span className="mx-1 text-slate-400">➔</span>
                              <span className="font-semibold text-indigo-700">{t.to || 'Destination'}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{t.driverName}</td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-slate-700">{item?.name || t.itemId}</span>
                              <span className="text-xs text-slate-500 block">
                                {t.quantity} {item?.unit || t.unit} @ Rs. {t.rate.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                              Rs. {t.vehicleCharges.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-rose-600 font-medium">
                              Rs. {t.totalExpenses.toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${t.netTripProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              Rs. {t.netTripProfit.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap no-print">
                              <button
                                onClick={() => setActiveTripModal(t)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded text-xs font-semibold transition"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredVehicleTrips.length === 0 && (
                        <tr>
                          <td colSpan={10} className="text-center py-10 text-slate-400">
                            <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">
                              {ledgerSearch || ledgerDateFrom || ledgerDateTo
                                ? 'No trips match the active search and date filters.'
                                : `No trips logged yet for vehicle ${viewLedgerVehicle.number}.`}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {filteredVehicleTrips.length > 0 && (
                      <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right font-black">
                            Grand Totals ({filteredVehicleTrips.length} Trips):
                          </td>
                          <td className="px-4 py-3 font-black text-indigo-300">
                            {totalQtyTransported.toLocaleString()} Tons
                          </td>
                          <td className="px-4 py-3 text-right text-indigo-300 font-black">
                            Rs. {totalFreightEarned.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-300 font-black">
                            Rs. {totalExpensesIncurred.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-300 font-black">
                            Rs. {totalNetProfit.toLocaleString()}
                          </td>
                          <td className="no-print"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            {/* Section 2: Vehicle Itemized Expenses Ledger */}
            <div className="space-y-3 pt-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-rose-600" />
                  <span>Itemized Vehicle Expenses (Fuel, Maintenance, Toll, Tax, Kanta)</span>
                </h3>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs md:text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Trip Reference</th>
                        <th className="px-4 py-3">Expense Category</th>
                        <th className="px-4 py-3">Description / Remarks</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredVehicleExpenses.map((exp, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{exp.date}</td>
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600">{exp.tripId}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                              {exp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{exp.description}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600">
                            Rs. {exp.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {filteredVehicleExpenses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">
                            No vehicle expenses recorded for the selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {filteredVehicleExpenses.length > 0 && (
                      <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm font-mono">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right font-black">
                            Total Vehicle Expenses ({filteredVehicleExpenses.length} Entries):
                          </td>
                          <td className="px-4 py-3 text-right text-rose-300 font-black">
                            Rs. {filteredVehicleExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
              Software by Roonjha Developer - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* 3. Trip Details Modal (Accessible from Vehicle Ledger) */}
      {activeTripModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 no-print p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Trip Details: {activeTripModal.id}</h3>
                <p className="text-xs text-slate-400">Recorded on {activeTripModal.date}</p>
              </div>
              <button
                onClick={() => setActiveTripModal(null)}
                className="text-slate-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm">
              {/* Core Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Vehicle & Driver</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {vehicles.find(v => v.id === activeTripModal.vehicleId)?.number || activeTripModal.vehicleId}
                  </p>
                  <p className="text-xs text-slate-500">Driver: {activeTripModal.driverName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Customer</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {customers.find(c => c.id === activeTripModal.customerId)?.name || activeTripModal.customerId}
                  </p>
                  <p className="text-xs text-slate-500">
                    Phone: {customers.find(c => c.id === activeTripModal.customerId)?.phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Route & Destination</p>
                  <p className="font-bold text-indigo-700 mt-0.5">
                    {activeTripModal.from || 'Origin'} ➔ {activeTripModal.to || 'Destination'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Payment Channel</p>
                  <p className="font-bold text-slate-800 mt-0.5">{activeTripModal.paymentType}</p>
                </div>
              </div>

              {/* Material & Financials */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Material Breakdown</h4>
                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>
                      {items.find(i => i.id === activeTripModal.itemId)?.name || activeTripModal.itemId}
                    </span>
                    <span>
                      {activeTripModal.quantity} {activeTripModal.unit} @ Rs. {activeTripModal.rate.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                    <span>Material Total:</span>
                    <span>Rs. {activeTripModal.materialTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                    <span>Vehicle Charges:</span>
                    <span>Rs. {activeTripModal.vehicleCharges.toLocaleString()}</span>
                  </div>
                  {activeTripModal.discount > 0 && (
                    <div className="flex justify-between text-xs text-rose-600">
                      <span>Discount Allowed:</span>
                      <span>-Rs. {activeTripModal.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                    <span>Invoice Net Total:</span>
                    <span>Rs. {activeTripModal.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Expenses Breakdown */}
              {activeTripModal.expenses && activeTripModal.expenses.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trip Expenses</h4>
                  <table className="min-w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeTripModal.expenses.map((exp, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{exp.category}</td>
                          <td className="px-3 py-2 text-slate-500">{exp.description || '—'}</td>
                          <td className="px-3 py-2 text-right font-bold text-rose-600">Rs. {exp.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-right">Total Expenses:</td>
                        <td className="px-3 py-2 text-right text-rose-600">Rs. {activeTripModal.totalExpenses.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Net Earnings Summary */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-emerald-800 uppercase">Net Trip Profit (Earnings)</p>
                  <p className="text-[11px] text-emerald-600">Freight (Rs. {activeTripModal.vehicleCharges.toLocaleString()}) - Expenses (Rs. {activeTripModal.totalExpenses.toLocaleString()})</p>
                </div>
                <p className="text-xl font-black text-emerald-700">
                  Rs. {activeTripModal.netTripProfit.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveTripModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Vehicle Info' : 'Add New Vehicle'}
              </h3>
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
                  Vehicle Number / Registration
                </label>
                <input
                  type="text"
                  required
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                  placeholder="e.g. TAF-637, C-4912"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Vehicle Type
                  </label>
                  <input
                    type="text"
                    value={type}
                    onChange={e => setType(e.target.value)}
                    placeholder="e.g. 6-Wheeler Dumper"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Carrying Capacity (Tons)
                  </label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={e => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Default Driver
                </label>
                <input
                  type="text"
                  value={driver}
                  onChange={e => setDriver(e.target.value)}
                  placeholder="Driver Name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="active" className="text-sm font-semibold text-slate-600">
                  Vehicle is Active & Available for Operations
                </label>
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
                  {editingId ? 'Save Changes' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
