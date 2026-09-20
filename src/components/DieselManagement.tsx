import React, { useEffect, useState } from 'react';
import { 
  getAllRecords, 
  putRecord, 
  deleteRecord, 
  DBDieselTransaction, 
  DBDieselUsage, 
  DBVendor, 
  DBVehicle, 
  DBStaff, 
  DBBank 
} from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveDieselTransaction, deleteDieselTransaction } from '../db/transactions';
import { 
  Fuel, Plus, Trash, Edit, Printer, Download, Search, X, 
  Truck, Building2, User, Gauge, BarChart2, Calendar, CheckCircle, TrendingUp
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';
import ThermalReceipt from './ThermalReceipt';

export default function DieselManagement() {
  const [dieselLogs, setDieselLogs] = useState<DBDieselTransaction[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'procurement' | 'analytics'
  const [activeTab, setActiveTab] = useState<'procurement' | 'analytics'>('procurement');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activePrintJob, setActivePrintJob] = useState<{ type: 'thermal' | 'a4'; data: DBDieselTransaction } | null>(null);

  // Form Fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [fuelPumpName, setFuelPumpName] = useState('');
  const [slipNo, setSlipNo] = useState('');
  const [litres, setLitres] = useState<number | ''>('');
  const [ratePerLitre, setRatePerLitre] = useState<number | ''>(280);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isPaidTouched, setIsPaidTouched] = useState(false);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit'>('Credit');
  const [bankId, setBankId] = useState('');
  const [odometerReading, setOdometerReading] = useState<number | ''>('');
  const [fuelType, setFuelType] = useState<'Diesel' | 'Petrol' | 'Mobil Oil'>('Diesel');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const [allDiesel, allVendors, allVehicles, allStaff, allBanks] = await Promise.all([
        getAllRecords<DBDieselTransaction>('diesel_transactions'),
        getAllRecords<DBVendor>('vendors'),
        getAllRecords<DBVehicle>('vehicles'),
        getAllRecords<DBStaff>('staff'),
        getAllRecords<DBBank>('banks')
      ]);

      allDiesel.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDieselLogs(allDiesel);
      setVendors(allVendors);
      setVehicles(allVehicles);
      setStaffList(allStaff);
      setBanks(allBanks);
      if (allBanks.length > 0 && !bankId) setBankId(allBanks[0].id);

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      setLoading(false);
    } catch (err) {
      console.error('Error loading diesel data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLitresOrRateChange = (newLitres: number | '', newRate: number | '') => {
    setLitres(newLitres);
    setRatePerLitre(newRate);
    if (typeof newLitres === 'number' && typeof newRate === 'number' && newLitres > 0 && newRate > 0) {
      const calcTot = Math.round(newLitres * newRate);
      setTotalAmount(calcTot);
      if (!isPaidTouched) {
        if (paymentType === 'Cash' || paymentType === 'Bank') setPaidAmount(calcTot);
      }
    }
  };

  const handleOpenForm = (d?: DBDieselTransaction) => {
    if (d) {
      setEditingId(d.id);
      setDate(d.date);
      setVehicleId(d.vehicleId || '');
      setDriverName(d.driverName || '');
      setVendorId(d.vendorId || '');
      setFuelPumpName(d.fuelPumpName || '');
      setSlipNo(d.slipNo || '');
      setLitres(d.litres || '');
      setRatePerLitre(d.ratePerLitre || 280);
      setTotalAmount(d.totalAmount || 0);
      setPaidAmount(d.paidAmount !== undefined ? d.paidAmount : (d.paymentType === 'Credit' ? 0 : d.totalAmount));
      setIsPaidTouched(true);
      setPaymentType(d.paymentType || 'Credit');
      setBankId(d.bankId || (banks.length > 0 ? banks[0].id : ''));
      setOdometerReading(d.odometerReading !== undefined ? d.odometerReading : '');
      setFuelType(d.fuelType || 'Diesel');
      setNotes(d.notes || '');
    } else {
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setVehicleId('');
      setDriverName('');
      setVendorId('');
      setFuelPumpName('');
      setSlipNo('');
      setLitres('');
      setRatePerLitre(280);
      setTotalAmount(0);
      setPaidAmount(0);
      setIsPaidTouched(false);
      setPaymentType('Credit');
      setBankId(banks.length > 0 ? banks[0].id : '');
      setOdometerReading('');
      setFuelType('Diesel');
      setNotes('');
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      alert('Please select a vehicle / dumper.');
      return;
    }
    if (!vendorId) {
      alert('Please select a diesel supplier / fuel pump vendor.');
      return;
    }
    if (typeof litres !== 'number' || litres <= 0) {
      alert('Please enter a valid quantity of litres.');
      return;
    }

    let dId = editingId;
    if (!dId) {
      const prefix = 'dsl-';
      const existingIds = dieselLogs.map(l => l.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
      dId = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }

    const veh = vehicles.find(v => v.id === vehicleId);
    const ven = vendors.find(v => v.id === vendorId);

    const tx: DBDieselTransaction = {
      id: dId,
      date,
      vehicleId,
      vehicleNumber: veh?.number || vehicleId,
      driverName: driverName.trim() || veh?.driver || '',
      vendorId,
      vendorName: ven?.name || vendorId,
      fuelPumpName: fuelPumpName.trim() || ven?.name || 'Winder Fuel Pump',
      slipNo: slipNo.trim() || undefined,
      litres: Number(litres),
      ratePerLitre: Number(ratePerLitre) || 0,
      totalAmount: Number(totalAmount),
      paidAmount: Number(paidAmount) || 0,
      remainingBalance: Math.max(0, Number(totalAmount) - (Number(paidAmount) || 0)),
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      odometerReading: odometerReading !== '' ? Number(odometerReading) : undefined,
      fuelType,
      notes: notes.trim() || undefined
    };

    try {
      await saveDieselTransaction(tx);
      setIsFormOpen(false);
      await loadData();
      if (confirm('Print Diesel Filling Slip?')) {
        setActivePrintJob({ type: 'thermal', data: tx });
        setTimeout(() => {
          window.print();
          setActivePrintJob(null);
        }, 150);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to save diesel record: ' + (err?.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this diesel transaction? All ledger entries will be reversed.')) {
      await deleteDieselTransaction(id);
      loadData();
    }
  };

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredLogs = dieselLogs.filter(d => {
    if (startDate && d.date < startDate) return false;
    if (endDate && d.date > endDate) return false;
    if (selectedVehicleId && d.vehicleId !== selectedVehicleId) return false;
    if (selectedVendorId && d.vendorId !== selectedVendorId) return false;

    if (!cleanSearch) return true;
    const v = vehicles.find(veh => veh.id === d.vehicleId);
    const ven = vendors.find(vn => vn.id === d.vendorId);

    return (
      d.id.toLowerCase().includes(cleanSearch) ||
      d.date.includes(cleanSearch) ||
      (d.slipNo && d.slipNo.toLowerCase().includes(cleanSearch)) ||
      (d.driverName && d.driverName.toLowerCase().includes(cleanSearch)) ||
      (v && v.number.toLowerCase().includes(cleanSearch)) ||
      (ven && ven.name.toLowerCase().includes(cleanSearch)) ||
      (d.fuelPumpName && d.fuelPumpName.toLowerCase().includes(cleanSearch))
    );
  });

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Statistics
  const totalLitres = filteredLogs.reduce((s, d) => s + (d.litres || 0), 0);
  const totalCost = filteredLogs.reduce((s, d) => s + (d.totalAmount || 0), 0);
  const totalPaid = filteredLogs.reduce((s, d) => s + (d.paidAmount || 0), 0);
  const totalUnpaid = filteredLogs.reduce((s, d) => s + (d.remainingBalance || 0), 0);
  const avgRate = totalLitres > 0 ? (totalCost / totalLitres).toFixed(1) : 0;

  if (loading) {
    return <div className="text-center py-10 font-bold text-slate-500">Loading Diesel Management ledger...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 80mm Print Slip */}
      {activePrintJob && activePrintJob.type === 'thermal' && (
        <ThermalReceipt
          receiptTitle="DIESEL RECEIPT"
          receiptNo={activePrintJob.data.id}
          date={activePrintJob.data.date}
          vehicleNo={vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.number || activePrintJob.data.vehicleId}
          driverName={activePrintJob.data.driverName || undefined}
          pumpVendorName={activePrintJob.data.fuelPumpName || vendors.find(v => v.id === activePrintJob.data.vendorId)?.name || 'Fuel Station'}
          slipNo={activePrintJob.data.slipNo || undefined}
          paymentType={activePrintJob.data.paymentType}
          extraFields={activePrintJob.data.odometerReading ? [{ label: 'Odometer Reading:', value: `${activePrintJob.data.odometerReading} km` }] : []}
          items={[
            {
              name: 'Diesel Fuel (High Speed)',
              qty: activePrintJob.data.litres,
              unit: 'Litres',
              rate: activePrintJob.data.ratePerLitre,
              total: activePrintJob.data.totalAmount,
            }
          ]}
          grossTotal={activePrintJob.data.totalAmount}
          netTotal={activePrintJob.data.totalAmount}
          amountReceived={activePrintJob.data.paidAmount}
          remainingDue={activePrintJob.data.remainingBalance}
        />
      )}

      {/* Main UI */}
      <div className={`space-y-6 ${activePrintJob ? 'no-print' : ''}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
              <Fuel className="h-6 w-6 text-amber-600" />
              <span>Fleet Diesel &amp; Fuel Accounting (ڈیزل کھاتہ اور گاڑی لاگ)</span>
            </h2>
            <p className="text-sm text-slate-500">Track fuel purchases from petrol pumps, monitor consumption per vehicle and optimize fleet mileage</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Log Diesel Filling</span>
            </button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Diesel Consumed</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{totalLitres.toLocaleString()} Litres</p>
            <p className="text-xs text-slate-400 mt-0.5">{filteredLogs.length} total fillings</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Fuel Expenditure</p>
            <p className="text-2xl font-black text-slate-900 mt-1">Rs. {totalCost.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Avg Rate: Rs. {avgRate}/L</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-emerald-600 uppercase">Paid on Spot</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">Rs. {totalPaid.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Cash / Bank settlement</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-rose-600 uppercase">Payable to Fuel Pumps</p>
            <p className="text-2xl font-black text-rose-700 mt-1">Rs. {totalUnpaid.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Vendor Udhaar (Credit)</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search slip #, driver, pump..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
              >
                <option value="">-- All Fleet Vehicles --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.number} ({v.type})</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
              >
                <option value="">-- All Fuel Pumps / Vendors --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {/* Diesel Table */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-3 py-3.5 whitespace-nowrap">Date / ID</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Vehicle &amp; Driver</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Fuel Pump / Supplier</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Meter Reading</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Litres</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Rate / Litre</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Total Amount</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Paid</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Payable Due</th>
                  <th className="px-3 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map(d => {
                  const veh = vehicles.find(v => v.id === d.vehicleId);
                  const ven = vendors.find(v => v.id === d.vendorId);

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-amber-700 block">{d.id}</span>
                        <span className="text-xs text-slate-500">{d.date}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{veh?.number || d.vehicleNumber || d.vehicleId}</p>
                        <p className="text-xs text-slate-500">{d.driverName || '—'}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{d.fuelPumpName || ven?.name || d.vendorId}</p>
                        {d.slipNo && <p className="text-xs text-slate-400 font-mono">Slip: {d.slipNo}</p>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-slate-600">
                        {d.odometerReading ? `${d.odometerReading.toLocaleString()} km` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-amber-900 whitespace-nowrap">
                        {d.litres.toLocaleString()} L
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                        Rs. {d.ratePerLitre.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                        Rs. {d.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        Rs. {d.paidAmount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {d.remainingBalance > 0 ? (
                          <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                            Rs. {d.remainingBalance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700 text-xs">✓ Cleared</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap no-print">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => {
                              setActivePrintJob({ type: 'thermal', data: d });
                              setTimeout(() => { window.print(); setActivePrintJob(null); }, 150);
                            }}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Print Diesel Slip"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(d)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete"
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
            totalItems={filteredLogs.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Modal for Create / Edit Diesel Entry */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-amber-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Fuel className="h-5 w-5" />
                <h3 className="font-bold text-base">
                  {editingId ? `Edit Diesel Entry (#${editingId})` : 'Log Vehicle Diesel Filling (ڈیزل اندراج)'}
                </h3>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-amber-200 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vehicle *</label>
                  <SearchableSelect
                    options={vehicles.map(v => ({
                      value: v.id,
                      label: `${v.number} (${v.type})`,
                      subLabel: `Driver: ${v.driver || 'None'} • Odo: ${v.currentOdometer || '—'} km`,
                      searchTerms: `${v.number} ${v.driver || ''}`
                    }))}
                    value={vehicleId}
                    onChange={val => {
                      setVehicleId(val);
                      const veh = vehicles.find(v => v.id === val);
                      if (veh && veh.driver) setDriverName(veh.driver);
                      if (veh && veh.currentOdometer) setOdometerReading(veh.currentOdometer);
                    }}
                    placeholder="-- Select Vehicle --"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fuel Station / Vendor *</label>
                  <SearchableSelect
                    options={vendors.map(v => ({
                      value: v.id,
                      label: v.name,
                      subLabel: `Payable: Rs. ${(balances?.vendorBalances[v.id]?.outstanding || 0).toLocaleString()}`,
                      searchTerms: `${v.name} ${v.phone || ''}`
                    }))}
                    value={vendorId}
                    onChange={val => {
                      setVendorId(val);
                      const ven = vendors.find(v => v.id === val);
                      if (ven) setFuelPumpName(ven.name);
                    }}
                    placeholder="-- Select Fuel Pump / Vendor --"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Driver Name</label>
                  <input
                    type="text"
                    placeholder="Driver Name"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pump Slip #</label>
                  <input
                    type="text"
                    placeholder="e.g. SLIP-8021"
                    value={slipNo}
                    onChange={e => setSlipNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Odometer / Meter Reading (km)</label>
                  <input
                    type="number"
                    placeholder="Current Vehicle Mileage"
                    value={odometerReading}
                    onChange={e => setOdometerReading(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Litres, Rate, Total */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black text-amber-950 uppercase mb-1">Quantity (Litres) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.1"
                    placeholder="e.g. 150"
                    value={litres}
                    onChange={e => handleLitresOrRateChange(e.target.value === '' ? '' : Number(e.target.value), ratePerLitre)}
                    className="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-base font-black text-amber-950 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-950 uppercase mb-1">Rate / Litre (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    placeholder="e.g. 280"
                    value={ratePerLitre}
                    onChange={e => handleLitresOrRateChange(litres, e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-base font-black text-amber-950 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-amber-950 uppercase mb-1">Total Cost (Rs.)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={totalAmount === 0 ? '' : totalAmount}
                    onChange={e => {
                      const tot = e.target.value === '' ? 0 : Number(e.target.value);
                      setTotalAmount(tot);
                      if (!isPaidTouched && (paymentType === 'Cash' || paymentType === 'Bank')) setPaidAmount(tot);
                    }}
                    className="w-full px-3 py-2 border-2 border-amber-500 rounded-lg text-base font-black text-amber-950 bg-white"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase">Payment Method</label>
                  <span className="text-xs font-black text-slate-900">Total: Rs. {totalAmount.toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Credit');
                      if (!isPaidTouched) setPaidAmount(0);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      paymentType === 'Credit' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    📋 Credit (Udhaar Pump)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Cash');
                      if (!isPaidTouched) setPaidAmount(totalAmount);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      paymentType === 'Cash' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    💵 Cash Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Bank');
                      if (!isPaidTouched) setPaidAmount(totalAmount);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      paymentType === 'Bank' ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-white text-slate-700 border-slate-300'
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
                    <label className="block text-xs font-bold text-slate-800">Amount Paid to Pump (Rs.)</label>
                    <div className="space-x-1">
                      <button
                        type="button"
                        onClick={() => { setPaidAmount(totalAmount); setIsPaidTouched(true); }}
                        className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold rounded"
                      >
                        Full Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPaidAmount(0); setIsPaidTouched(true); }}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 font-bold rounded"
                      >
                        Zero (All Udhaar)
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
                    <span>Payable Balance to Fuel Station:</span>
                    <span className={totalAmount - paidAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      Rs. {Math.max(0, totalAmount - paidAmount).toLocaleString()}
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
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Save Diesel Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
