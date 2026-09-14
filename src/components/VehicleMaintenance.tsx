import React, { useEffect, useState } from 'react';
import { 
  getAllRecords, 
  putRecord, 
  deleteRecord, 
  DBVehicleMaintenance, 
  DBVendor, 
  DBVehicle, 
  DBStaff, 
  DBBank, 
  DBMaintenanceCategory 
} from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveVehicleMaintenanceTransaction, deleteVehicleMaintenanceTransaction } from '../db/transactions';
import { 
  Wrench, Plus, Trash, Edit, Printer, Download, Search, X, 
  Truck, Building2, Calendar, CheckCircle, AlertTriangle, Clock, ShieldCheck, FileText
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

export default function VehicleMaintenance() {
  const [maintenanceRecords, setMaintenanceRecords] = useState<DBVehicleMaintenance[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [categories, setCategories] = useState<DBMaintenanceCategory[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal & Print
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activePrintJob, setActivePrintJob] = useState<{ type: 'thermal' | 'a4'; data: DBVehicleMaintenance } | null>(null);

  // Form Fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [workshopVendorId, setWorkshopVendorId] = useState('');
  const [workshopName, setWorkshopName] = useState('');
  const [category, setCategory] = useState('Engine & Oil Change');
  const [maintenanceType, setMaintenanceType] = useState('Routine Service');
  const [description, setDescription] = useState('');
  const [partsCost, setPartsCost] = useState<number>(0);
  const [labourCost, setLabourCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isPaidTouched, setIsPaidTouched] = useState(false);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit'>('Cash');
  const [bankId, setBankId] = useState('');
  const [odometer, setOdometer] = useState<number | ''>('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [nextServiceOdometer, setNextServiceOdometer] = useState<number | ''>('');
  const [status, setStatus] = useState<'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'>('Completed');
  const [notes, setNotes] = useState('');

  const defaultCategories = [
    'Engine & Oil Change',
    'Brake & Hydraulic System',
    'Tyres & Wheel Alignment',
    'Suspension, Leaf Springs & Kamani',
    'Transmission & Gearbox',
    'Electrical, Battery & Self',
    'Body, Dumper Hydraulic & Welding',
    'Filters & General Consumables',
    'Accident / Major Overhaul'
  ];

  const loadData = async () => {
    try {
      const [allMaint, allVendors, allVehicles, allBanks, allCats] = await Promise.all([
        getAllRecords<DBVehicleMaintenance>('vehicle_maintenance'),
        getAllRecords<DBVendor>('vendors'),
        getAllRecords<DBVehicle>('vehicles'),
        getAllRecords<DBBank>('banks'),
        getAllRecords<DBMaintenanceCategory>('maintenance_categories')
      ]);

      allMaint.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMaintenanceRecords(allMaint);
      setVendors(allVendors);
      setVehicles(allVehicles);
      setBanks(allBanks);
      if (allBanks.length > 0 && !bankId) setBankId(allBanks[0].id);
      setCategories(allCats);

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      setLoading(false);
    } catch (err) {
      console.error('Error loading maintenance data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCostChange = (pCost: number, lCost: number, oCost: number) => {
    setPartsCost(pCost);
    setLabourCost(lCost);
    setOtherCost(oCost);
    const sum = Number(pCost || 0) + Number(lCost || 0) + Number(oCost || 0);
    setTotalCost(sum);
    if (!isPaidTouched) {
      if (paymentType === 'Cash' || paymentType === 'Bank') setPaidAmount(sum);
    }
  };

  const handleOpenForm = (m?: DBVehicleMaintenance) => {
    if (m) {
      setEditingId(m.id);
      setDate(m.date);
      setVehicleId(m.vehicleId || '');
      setDriverName(m.driverName || '');
      setWorkshopVendorId(m.workshopVendorId || '');
      setWorkshopName(m.workshopName || '');
      setCategory(m.category || 'Engine & Oil Change');
      setMaintenanceType(m.maintenanceType || 'Routine Service');
      setDescription(m.description || '');
      setPartsCost(m.partsCost || 0);
      setLabourCost(m.labourCost || 0);
      setOtherCost(m.otherCost || 0);
      setTotalCost(m.totalCost || 0);
      setPaidAmount(m.paidAmount !== undefined ? m.paidAmount : (m.paymentType === 'Credit' ? 0 : m.totalCost));
      setIsPaidTouched(true);
      setPaymentType(m.paymentType || 'Cash');
      setBankId(m.bankId || (banks.length > 0 ? banks[0].id : ''));
      setOdometer(m.odometer !== undefined ? m.odometer : '');
      setNextServiceDate(m.nextServiceDate || '');
      setNextServiceOdometer(m.nextServiceOdometer !== undefined ? m.nextServiceOdometer : '');
      setStatus(m.status || 'Completed');
      setNotes(m.notes || '');
    } else {
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setVehicleId('');
      setDriverName('');
      setWorkshopVendorId('');
      setWorkshopName('');
      setCategory('Engine & Oil Change');
      setMaintenanceType('Routine Service');
      setDescription('');
      setPartsCost(0);
      setLabourCost(0);
      setOtherCost(0);
      setTotalCost(0);
      setPaidAmount(0);
      setIsPaidTouched(false);
      setPaymentType('Cash');
      setBankId(banks.length > 0 ? banks[0].id : '');
      setOdometer('');
      setNextServiceDate('');
      setNextServiceOdometer('');
      setStatus('Completed');
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
    if (totalCost <= 0) {
      alert('Total maintenance cost must be greater than 0.');
      return;
    }

    let mId = editingId;
    if (!mId) {
      const prefix = 'mnt-';
      const existingIds = maintenanceRecords.map(r => r.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
      mId = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }

    const veh = vehicles.find(v => v.id === vehicleId);
    const ven = vendors.find(v => v.id === workshopVendorId);

    const record: DBVehicleMaintenance = {
      id: mId,
      date,
      vehicleId,
      vehicleNumber: veh?.number || vehicleId,
      driverName: driverName.trim() || veh?.driver || '',
      workshopVendorId: workshopVendorId || undefined,
      workshopName: workshopName.trim() || ven?.name || 'Local Workshop',
      category,
      maintenanceType,
      description: description.trim() || category,
      partsCost: Number(partsCost) || 0,
      labourCost: Number(labourCost) || 0,
      otherCost: Number(otherCost) || 0,
      totalCost: Number(totalCost),
      paidAmount: Number(paidAmount) || 0,
      remainingBalance: Math.max(0, Number(totalCost) - (Number(paidAmount) || 0)),
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      odometer: odometer !== '' ? Number(odometer) : undefined,
      nextServiceDate: nextServiceDate || undefined,
      nextServiceOdometer: nextServiceOdometer !== '' ? Number(nextServiceOdometer) : undefined,
      status,
      notes: notes.trim() || undefined
    };

    try {
      await saveVehicleMaintenanceTransaction(record);
      setIsFormOpen(false);
      await loadData();
      if (confirm('Print Maintenance Work Order / Slip?')) {
        setActivePrintJob({ type: 'thermal', data: record });
        setTimeout(() => {
          window.print();
          setActivePrintJob(null);
        }, 150);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to save maintenance record: ' + (err?.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this maintenance record? All financial ledger entries will be reversed.')) {
      await deleteVehicleMaintenanceTransaction(id);
      loadData();
    }
  };

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredRecords = maintenanceRecords.filter(m => {
    if (startDate && m.date < startDate) return false;
    if (endDate && m.date > endDate) return false;
    if (selectedVehicleId && m.vehicleId !== selectedVehicleId) return false;
    if (selectedCategory && m.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && m.status !== selectedStatus) return false;

    if (!cleanSearch) return true;
    const v = vehicles.find(veh => veh.id === m.vehicleId);
    const ven = vendors.find(vn => vn.id === m.workshopVendorId);

    return (
      m.id.toLowerCase().includes(cleanSearch) ||
      m.date.includes(cleanSearch) ||
      (m.category && m.category.toLowerCase().includes(cleanSearch)) ||
      (m.description && m.description.toLowerCase().includes(cleanSearch)) ||
      (m.workshopName && m.workshopName.toLowerCase().includes(cleanSearch)) ||
      (v && v.number.toLowerCase().includes(cleanSearch)) ||
      (ven && ven.name.toLowerCase().includes(cleanSearch))
    );
  });

  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalFilteredCost = filteredRecords.reduce((s, m) => s + (m.totalCost || 0), 0);
  const totalPartsCost = filteredRecords.reduce((s, m) => s + (m.partsCost || 0), 0);
  const totalLabourCost = filteredRecords.reduce((s, m) => s + (m.labourCost || 0), 0);
  const totalPayable = filteredRecords.reduce((s, m) => s + (m.remainingBalance || 0), 0);

  if (loading) {
    return <div className="text-center py-10 font-bold text-slate-500">Loading Vehicle Maintenance records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 80mm Print Slip */}
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
            <p className="text-xs font-black uppercase tracking-wider text-black">VEHICLE MAINTENANCE &amp; WORKSHOP SLIP</p>
            <div className="flex justify-between text-xs font-bold text-black mt-1">
              <span>Job #: {activePrintJob.data.id}</span>
              <span>Date: {activePrintJob.data.date}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs font-mono text-black border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between">
              <span className="font-semibold">Vehicle:</span>
              <span className="font-bold">{vehicles.find(v => v.id === activePrintJob.data.vehicleId)?.number || activePrintJob.data.vehicleId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Workshop / Mistri:</span>
              <span className="font-bold">{activePrintJob.data.workshopName || 'Internal / Workshop'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Category:</span>
              <span className="font-bold">{activePrintJob.data.category}</span>
            </div>
            {activePrintJob.data.odometer && (
              <div className="flex justify-between">
                <span className="font-semibold">Current Odometer:</span>
                <span className="font-bold">{activePrintJob.data.odometer} km</span>
              </div>
            )}
          </div>

          <div className="py-2 border-b border-dashed border-black text-xs font-mono space-y-1">
            <div className="font-bold">Work Particulars / Repairs Done:</div>
            <p className="text-slate-800">{activePrintJob.data.description}</p>
            <div className="pt-1 space-y-0.5 border-t border-dotted border-black">
              <div className="flex justify-between">
                <span>Spare Parts Cost:</span>
                <span>Rs. {activePrintJob.data.partsCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Mistri / Labour Charges:</span>
                <span>Rs. {activePrintJob.data.labourCost.toLocaleString()}</span>
              </div>
              {activePrintJob.data.otherCost ? (
                <div className="flex justify-between">
                  <span>Other / Lathe Machine:</span>
                  <span>Rs. {activePrintJob.data.otherCost.toLocaleString()}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1 text-xs font-mono text-black pt-2">
            <div className="flex justify-between text-sm font-black border-b border-dashed border-black pb-1">
              <span>TOTAL MAINTENANCE:</span>
              <span>Rs. {activePrintJob.data.totalCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1">
              <span>Payment Mode:</span>
              <span className="font-bold">{activePrintJob.data.paymentType}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Paid:</span>
              <span className="font-black text-emerald-800">Rs. {activePrintJob.data.paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Payable to Workshop:</span>
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
              <Wrench className="h-6 w-6 text-indigo-600" />
              <span>Fleet Maintenance &amp; Workshop Repairs (گاڑیوں کی مرمت اور سروس)</span>
            </h2>
            <p className="text-sm text-slate-500">Log spare parts, mistri labour charges, schedule periodic services, and track vehicle investment</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Log Maintenance Job</span>
            </button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Maintenance Cost</p>
            <p className="text-2xl font-black text-slate-900 mt-1">Rs. {totalFilteredCost.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">{filteredRecords.length} maintenance jobs</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-indigo-600 uppercase">Parts &amp; Materials</p>
            <p className="text-2xl font-black text-indigo-700 mt-1">Rs. {totalPartsCost.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Tyres, filters, oil, springs</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-amber-600 uppercase">Mistri &amp; Labour Charges</p>
            <p className="text-2xl font-black text-amber-700 mt-1">Rs. {totalLabourCost.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Workshop services</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-rose-600 uppercase">Workshop Payable Due</p>
            <p className="text-2xl font-black text-rose-700 mt-1">Rs. {totalPayable.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Vendor Udhaar</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search job, vehicle, workshop, description..."
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
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50"
              >
                <option value="">-- All Maintenance Heads --</option>
                {defaultCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
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

        {/* Maintenance Table */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-3 py-3.5 whitespace-nowrap">Date / ID</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Vehicle &amp; Driver</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Workshop / Mistri</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Service Head</th>
                  <th className="px-3 py-3.5 whitespace-nowrap">Description / Work Done</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Parts</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Labour</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Total Cost</th>
                  <th className="px-3 py-3.5 text-right whitespace-nowrap">Payable Due</th>
                  <th className="px-3 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map(m => {
                  const veh = vehicles.find(v => v.id === m.vehicleId);
                  const ven = vendors.find(v => v.id === m.workshopVendorId);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 block">{m.id}</span>
                        <span className="text-xs text-slate-500">{m.date}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{veh?.number || m.vehicleNumber || m.vehicleId}</p>
                        <p className="text-xs text-slate-500">{m.driverName || '—'}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{m.workshopName || ven?.name || 'Local Workshop'}</p>
                        {m.odometer && <p className="text-xs text-slate-400 font-mono">Odo: {m.odometer.toLocaleString()} km</p>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {m.category}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-semibold text-slate-700 max-w-xs truncate">{m.description}</p>
                        {m.nextServiceDate && (
                          <p className="text-[10px] text-amber-700 font-bold">
                            Next Service: {m.nextServiceDate} {m.nextServiceOdometer ? `(${m.nextServiceOdometer} km)` : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                        Rs. {m.partsCost.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                        Rs. {m.labourCost.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                        Rs. {m.totalCost.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {m.remainingBalance > 0 ? (
                          <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                            Rs. {m.remainingBalance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700 text-xs">✓ Cleared</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap no-print">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => {
                              setActivePrintJob({ type: 'thermal', data: m });
                              setTimeout(() => { window.print(); setActivePrintJob(null); }, 150);
                            }}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Print Work Order"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(m)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
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
            totalItems={filteredRecords.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Modal for Create / Edit Maintenance */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wrench className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-base">
                  {editingId ? `Edit Maintenance Record (#${editingId})` : 'Log Vehicle Maintenance / Workshop Job'}
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
                      if (veh && veh.currentOdometer) setOdometer(veh.currentOdometer);
                    }}
                    placeholder="-- Select Vehicle --"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Workshop / Vendor</label>
                  <SearchableSelect
                    options={vendors.map(v => ({
                      value: v.id,
                      label: v.name,
                      subLabel: `Payable: Rs. ${(balances?.vendorBalances[v.id]?.outstanding || 0).toLocaleString()}`,
                      searchTerms: `${v.name} ${v.phone || ''}`
                    }))}
                    value={workshopVendorId}
                    onChange={val => {
                      setWorkshopVendorId(val);
                      const ven = vendors.find(v => v.id === val);
                      if (ven) setWorkshopName(ven.name);
                    }}
                    placeholder="-- Select Workshop Vendor --"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Maintenance Category *</label>
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Current Odometer (km)</label>
                  <input
                    type="number"
                    placeholder="e.g. 145000"
                    value={odometer}
                    onChange={e => setOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Work Done / Details *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Oil change, fuel filter replacement, and front brake shoe replacement done at Al-Madina Workshop"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Cost Breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Parts Cost (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={partsCost === 0 ? '' : partsCost}
                    onChange={e => handleCostChange(e.target.value === '' ? 0 : Number(e.target.value), labourCost, otherCost)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Labour Cost (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={labourCost === 0 ? '' : labourCost}
                    onChange={e => handleCostChange(partsCost, e.target.value === '' ? 0 : Number(e.target.value), otherCost)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Other / Lathe (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={otherCost === 0 ? '' : otherCost}
                    onChange={e => handleCostChange(partsCost, labourCost, e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-900 uppercase mb-1">Total Bill (Rs.)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={totalCost === 0 ? '' : totalCost}
                    onChange={e => {
                      const tot = e.target.value === '' ? 0 : Number(e.target.value);
                      setTotalCost(tot);
                      if (!isPaidTouched && (paymentType === 'Cash' || paymentType === 'Bank')) setPaidAmount(tot);
                    }}
                    className="w-full px-3 py-2 border-2 border-indigo-400 rounded-lg text-xs font-black text-indigo-900 bg-white"
                  />
                </div>
              </div>

              {/* Next Service Scheduling */}
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-amber-950 uppercase mb-1">Next Scheduled Service Date</label>
                  <input
                    type="date"
                    value={nextServiceDate}
                    onChange={e => setNextServiceDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-950 uppercase mb-1">Next Service Odometer (km)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150000"
                    value={nextServiceOdometer}
                    onChange={e => setNextServiceOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase">Payment Method</label>
                  <span className="text-xs font-black text-slate-900">Total: Rs. {totalCost.toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Cash');
                      if (!isPaidTouched) setPaidAmount(totalCost);
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
                      setPaymentType('Credit');
                      if (!isPaidTouched) setPaidAmount(0);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      paymentType === 'Credit' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    📋 Credit (Udhaar Workshop)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('Bank');
                      if (!isPaidTouched) setPaidAmount(totalCost);
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
                    <label className="block text-xs font-bold text-slate-800">Amount Paid to Workshop (Rs.)</label>
                    <div className="space-x-1">
                      <button
                        type="button"
                        onClick={() => { setPaidAmount(totalCost); setIsPaidTouched(true); }}
                        className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold rounded"
                      >
                        Full Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPaidAmount(0); setIsPaidTouched(true); }}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 font-bold rounded"
                      >
                        Zero (Udhaar)
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
                    <span>Payable Balance to Workshop:</span>
                    <span className={totalCost - paidAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      Rs. {Math.max(0, totalCost - paidAmount).toLocaleString()}
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Save Maintenance Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
