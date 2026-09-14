import React, { useEffect, useState, useMemo } from 'react';
import { 
  getAllRecords, 
  putRecord, 
  deleteRecord, 
  DBVehicle, 
  DBTrip, 
  DBCustomer, 
  DBItem, 
  DBStaff, 
  DBDriverAssignment,
  DBDieselTransaction,
  DBDieselUsage,
  DBVehicleMaintenance,
  DBDriverAdvance
} from '../db/firestore';
import { saveDriverAssignment } from '../db/transactions';
import { 
  Truck, 
  Plus, 
  Edit, 
  Trash, 
  Printer, 
  BookOpen, 
  Search, 
  X, 
  ArrowLeft, 
  FileText, 
  Calendar, 
  DollarSign, 
  ArrowRight,
  Compass,
  Gauge,
  Clock,
  Weight,
  UserCheck,
  Fuel,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Shield,
  MapPin,
  RefreshCw,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import Pagination from './Pagination';
import SearchableSelect from './SearchableSelect';

export default function Vehicles() {
  const [activeMainTab, setActiveMainTab] = useState<'directory' | 'availability' | 'assignments'>('directory');
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [assignments, setAssignments] = useState<DBDriverAssignment[]>([]);
  const [dieselTxs, setDieselTxs] = useState<DBDieselTransaction[]>([]);
  const [dieselUsages, setDieselUsages] = useState<DBDieselUsage[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<DBVehicleMaintenance[]>([]);
  const [driverAdvances, setDriverAdvances] = useState<DBDriverAdvance[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('active'); // 'all', 'active', 'inactive'

  // Modal / Detail States
  const [viewDetailVehicle, setViewDetailVehicle] = useState<DBVehicle | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<'profile' | 'trips' | 'diesel' | 'maintenance' | 'advances' | 'profitability'>('profile');
  const [detailDateFrom, setDetailDateFrom] = useState('');
  const [detailDateTo, setDetailDateTo] = useState('');

  // Vehicle Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState<'tons' | 'hours' | 'trips' | 'truck'>('tons');
  const [measurement, setMeasurement] = useState<'tons' | 'hours' | 'trips'>('tons');
  const [type, setType] = useState('Dump Truck 10-Wheeler');
  const [make, setMake] = useState('Hino');
  const [model, setModel] = useState('');
  const [manufacturingYear, setManufacturingYear] = useState('');
  const [chassisNo, setChassisNo] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [capacity, setCapacity] = useState<number>(30);
  const [capacityUnit, setCapacityUnit] = useState<'Ton' | 'KG' | 'Hour' | 'Trip'>('Ton');
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [perTripRate, setPerTripRate] = useState<number>(0);
  const [perTonRate, setPerTonRate] = useState<number>(0);
  const [currentOdometer, setCurrentOdometer] = useState<number>(0);
  const [currentEngineHours, setCurrentEngineHours] = useState<number>(0);
  const [status, setStatus] = useState<'active' | 'inactive' | 'available' | 'on_trip' | 'maintenance'>('available');
  const [active, setActive] = useState(true);
  const [driverId, setDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverCnic, setDriverCnic] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverAddress, setDriverAddress] = useState('');
  const [ownerName, setOwnerName] = useState('Al-Madina Construction');
  const [ownerContact, setOwnerContact] = useState('03458829298');
  const [regExpiry, setRegExpiry] = useState('');
  const [fitnessExpiry, setFitnessExpiry] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [notes, setNotes] = useState('');

  // Driver Substitution Modal State
  const [isSubstitutionModalOpen, setIsSubstitutionModalOpen] = useState(false);
  const [subVehicle, setSubVehicle] = useState<DBVehicle | null>(null);
  const [subReplacementDriverId, setSubReplacementDriverId] = useState('');
  const [subReason, setSubReason] = useState('');
  const [subAuthorizedBy, setSubAuthorizedBy] = useState('Admin');

  const loadData = async () => {
    try {
      const [
        allVehicles, 
        allTrips, 
        allStaff, 
        allCustomers, 
        allItems, 
        allAssignments,
        allDieselTx,
        allDieselUsage,
        allMaint,
        allAdv
      ] = await Promise.all([
        getAllRecords<DBVehicle>('vehicles'),
        getAllRecords<DBTrip>('trips'),
        getAllRecords<DBStaff>('staff'),
        getAllRecords<DBCustomer>('customers'),
        getAllRecords<DBItem>('items'),
        getAllRecords<DBDriverAssignment>('driver_assignments'),
        getAllRecords<DBDieselTransaction>('diesel_transactions'),
        getAllRecords<DBDieselUsage>('diesel_usage'),
        getAllRecords<DBVehicleMaintenance>('vehicle_maintenance'),
        getAllRecords<DBDriverAdvance>('driver_advances'),
      ]);

      allTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      allAssignments.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      allDieselTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      allMaint.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setVehicles(allVehicles);
      setTrips(allTrips);
      setStaff(allStaff);
      setCustomers(allCustomers);
      setItems(allItems);
      setAssignments(allAssignments);
      setDieselTxs(allDieselTx);
      setDieselUsages(allDieselUsage);
      setMaintenanceRecords(allMaint);
      setDriverAdvances(allAdv);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load vehicles data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = (veh?: DBVehicle) => {
    if (veh) {
      setEditingId(veh.id);
      setNumber(veh.number);
      setCategory(veh.category || 'tons');
      setMeasurement(veh.measurement || 'tons');
      setType(veh.type || 'Dump Truck');
      setMake(veh.make || '');
      setModel(veh.model || '');
      setManufacturingYear(veh.manufacturingYear || '');
      setChassisNo(veh.chassisNo || '');
      setEngineNo(veh.engineNo || '');
      setCapacity(veh.capacity || 0);
      setCapacityUnit(veh.capacityUnit || 'Ton');
      setHourlyRate(veh.hourlyRate || 0);
      setPerTripRate(veh.perTripRate || 0);
      setPerTonRate(veh.perTonRate || 0);
      setCurrentOdometer(veh.currentOdometer || 0);
      setCurrentEngineHours(veh.currentEngineHours || 0);
      setStatus(veh.status || 'available');
      setActive(veh.active !== false);
      setDriverId(veh.driverId || '');
      setDriverName(veh.driver || '');
      setDriverCnic(veh.driverCnic || '');
      setDriverPhone(veh.driverPhone || '');
      setDriverAddress(veh.driverAddress || '');
      setOwnerName(veh.ownerName || 'Al-Madina Construction');
      setOwnerContact(veh.ownerContact || '');
      setRegExpiry(veh.regExpiry || '');
      setFitnessExpiry(veh.fitnessExpiry || '');
      setInsuranceExpiry(veh.insuranceExpiry || '');
      setNotes(veh.notes || '');
    } else {
      setEditingId(null);
      setNumber('');
      setCategory('tons');
      setMeasurement('tons');
      setType('Dump Truck 10-Wheeler');
      setMake('Hino');
      setModel('');
      setManufacturingYear('');
      setChassisNo('');
      setEngineNo('');
      setCapacity(30);
      setCapacityUnit('Ton');
      setHourlyRate(0);
      setPerTripRate(0);
      setPerTonRate(0);
      setCurrentOdometer(0);
      setCurrentEngineHours(0);
      setStatus('available');
      setActive(true);
      setDriverId('');
      setDriverName('');
      setDriverCnic('');
      setDriverPhone('');
      setDriverAddress('');
      setOwnerName('Al-Madina Construction');
      setOwnerContact('03458829298');
      setRegExpiry('');
      setFitnessExpiry('');
      setInsuranceExpiry('');
      setNotes('');
    }
    setIsFormOpen(true);
  };

  const handleDriverSelect = (stId: string) => {
    setDriverId(stId);
    const selected = staff.find(s => s.id === stId);
    if (selected) {
      setDriverName(selected.name);
      setDriverPhone(selected.phone || '');
      setDriverCnic(selected.cnic || '');
      setDriverAddress(selected.address || '');
    }
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
        category,
        measurement,
        type: type.trim(),
        make: make.trim(),
        model: model.trim(),
        manufacturingYear: manufacturingYear.trim(),
        chassisNo: chassisNo.trim(),
        engineNo: engineNo.trim(),
        capacity: Number(capacity) || 0,
        capacityUnit,
        hourlyRate: Number(hourlyRate) || 0,
        perTripRate: Number(perTripRate) || 0,
        perTonRate: Number(perTonRate) || 0,
        currentOdometer: Number(currentOdometer) || 0,
        currentEngineHours: Number(currentEngineHours) || 0,
        status,
        active,
        driver: driverName.trim(),
        driverId: driverId.trim(),
        driverCnic: driverCnic.trim(),
        driverPhone: driverPhone.trim(),
        driverAddress: driverAddress.trim(),
        ownerName: ownerName.trim(),
        ownerContact: ownerContact.trim(),
        regExpiry,
        fitnessExpiry,
        insuranceExpiry,
        notes: notes.trim(),
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
    if (!window.confirm('Are you sure you want to delete this vehicle? Historical trip records will be preserved.')) return;
    try {
      await deleteRecord('vehicles', id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  };

  const handleOpenSubstitution = (veh: DBVehicle) => {
    setSubVehicle(veh);
    setSubReplacementDriverId('');
    setSubReason('');
    setSubAuthorizedBy('Admin / Manager');
    setIsSubstitutionModalOpen(true);
  };

  const handleSaveSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subVehicle || !subReplacementDriverId) {
      alert('Please select a replacement driver');
      return;
    }

    const replacementStaff = staff.find(s => s.id === subReplacementDriverId);
    if (!replacementStaff) return;

    try {
      const assignmentRecord: DBDriverAssignment = {
        id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        vehicleId: subVehicle.id,
        vehicleNumber: subVehicle.number,
        driverId: replacementStaff.id,
        driverName: replacementStaff.name,
        originalDriverId: subVehicle.driverId || undefined,
        originalDriverName: subVehicle.driver || undefined,
        replacementDriverId: replacementStaff.id,
        replacementDriverName: replacementStaff.name,
        reason: subReason.trim() || 'Driver substitution / shift change',
        startDateTime: new Date().toISOString(),
        authorizedBy: subAuthorizedBy,
        createdDate: new Date().toISOString().split('T')[0],
      };

      await saveDriverAssignment(assignmentRecord);
      await loadData();
      setIsSubstitutionModalOpen(false);
      alert(`Driver substituted successfully. Vehicle ${subVehicle.number} is now assigned to ${replacementStaff.name}.`);
    } catch (err) {
      console.error('Failed to record driver substitution:', err);
      alert('Error updating driver assignment');
    }
  };

  // Filtered vehicles for directory
  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (filterActive === 'active' && v.active === false) return false;
      if (filterActive === 'inactive' && v.active !== false) return false;
      if (filterCategory !== 'all' && v.category !== filterCategory) return false;
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      if (!cleanSearch) return true;
      return (
        v.number.toLowerCase().includes(cleanSearch) ||
        (v.type && v.type.toLowerCase().includes(cleanSearch)) ||
        (v.make && v.make.toLowerCase().includes(cleanSearch)) ||
        (v.model && v.model.toLowerCase().includes(cleanSearch)) ||
        (v.driver && v.driver.toLowerCase().includes(cleanSearch)) ||
        (v.driverCnic && v.driverCnic.toLowerCase().includes(cleanSearch)) ||
        (v.driverPhone && v.driverPhone.toLowerCase().includes(cleanSearch)) ||
        (v.ownerName && v.ownerName.toLowerCase().includes(cleanSearch)) ||
        v.id.toLowerCase().includes(cleanSearch)
      );
    });
  }, [vehicles, filterActive, filterCategory, filterStatus, cleanSearch]);

  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredVehicles, currentPage, pageSize]);

  // Grand Totals Calculation for Dashboard Bar
  const fleetSummary = useMemo(() => {
    const totalCount = vehicles.length;
    const activeCount = vehicles.filter(v => v.active !== false).length;
    const availableCount = vehicles.filter(v => v.active !== false && (v.status === 'available' || !v.status)).length;
    const onTripCount = vehicles.filter(v => v.status === 'on_trip').length;
    const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
    const inactiveCount = vehicles.filter(v => v.active === false || v.status === 'inactive').length;

    const totalFreightRevenue = trips.reduce((sum, t) => sum + (t.vehicleCharges || 0), 0);
    const totalDieselCost = dieselTxs.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
    const totalMaintenanceCost = maintenanceRecords.reduce((sum, m) => sum + (m.totalCost || 0), 0);
    const totalTripExpenses = trips.reduce((sum, t) => sum + (t.totalExpenses || 0), 0);
    const netFleetProfit = totalFreightRevenue - (totalTripExpenses + totalMaintenanceCost);

    return {
      totalCount,
      activeCount,
      availableCount,
      onTripCount,
      maintenanceCount,
      inactiveCount,
      totalFreightRevenue,
      totalDieselCost,
      totalMaintenanceCost,
      netFleetProfit
    };
  }, [vehicles, trips, dieselTxs, maintenanceRecords]);

  // Detail Modal Metrics for selected vehicle
  const selectedVehMetrics = useMemo(() => {
    if (!viewDetailVehicle) return null;
    const vehTrips = trips.filter(t => {
      if (t.vehicleId !== viewDetailVehicle.id && t.vehicleId !== viewDetailVehicle.number) return false;
      if (detailDateFrom && t.date < detailDateFrom) return false;
      if (detailDateTo && t.date > detailDateTo) return false;
      return true;
    });

    const vehDiesel = dieselTxs.filter(d => {
      if (d.vehicleId !== viewDetailVehicle.id && d.vehicleNumber !== viewDetailVehicle.number) return false;
      if (detailDateFrom && d.date < detailDateFrom) return false;
      if (detailDateTo && d.date > detailDateTo) return false;
      return true;
    });

    const vehDieselUsage = dieselUsages.filter(u => {
      if (u.vehicleId !== viewDetailVehicle.id && u.vehicleNumber !== viewDetailVehicle.number) return false;
      if (detailDateFrom && u.date < detailDateFrom) return false;
      if (detailDateTo && u.date > detailDateTo) return false;
      return true;
    });

    const vehMaint = maintenanceRecords.filter(m => {
      if (m.vehicleId !== viewDetailVehicle.id && m.vehicleNumber !== viewDetailVehicle.number) return false;
      if (detailDateFrom && m.date < detailDateFrom) return false;
      if (detailDateTo && m.date > detailDateTo) return false;
      return true;
    });

    const vehAdvances = driverAdvances.filter(a => {
      if (a.vehicleId !== viewDetailVehicle.id && a.vehicleId !== viewDetailVehicle.number) return false;
      if (detailDateFrom && a.date < detailDateFrom) return false;
      if (detailDateTo && a.date > detailDateTo) return false;
      return true;
    });

    const totalTripsCount = vehTrips.length;
    const totalFreightEarned = vehTrips.reduce((sum, t) => sum + (t.vehicleCharges || 0), 0);
    const totalMaterialDispatched = vehTrips.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalTripExpenses = vehTrips.reduce((sum, t) => sum + (t.totalExpenses || 0), 0);
    const totalHoursOperated = vehTrips.reduce((sum, t) => sum + (t.totalHours || 0), 0);

    const totalLitresPurchased = vehDiesel.reduce((sum, d) => sum + (d.litres || 0), 0);
    const totalDieselCost = vehDiesel.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
    const totalLitresUsed = vehDieselUsage.reduce((sum, u) => sum + (u.litresUsed || 0), 0);

    const totalPartsCost = vehMaint.reduce((sum, m) => sum + (m.partsCost || 0), 0);
    const totalLabourCost = vehMaint.reduce((sum, m) => sum + (m.labourCost || 0), 0);
    const totalMaintCost = vehMaint.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    const netVehProfit = totalFreightEarned - (totalTripExpenses + totalMaintCost);

    return {
      vehTrips,
      vehDiesel,
      vehDieselUsage,
      vehMaint,
      vehAdvances,
      totalTripsCount,
      totalFreightEarned,
      totalMaterialDispatched,
      totalTripExpenses,
      totalHoursOperated,
      totalLitresPurchased,
      totalDieselCost,
      totalLitresUsed,
      totalPartsCost,
      totalLabourCost,
      totalMaintCost,
      netVehProfit
    };
  }, [viewDetailVehicle, trips, dieselTxs, dieselUsages, maintenanceRecords, driverAdvances, detailDateFrom, detailDateTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Main Navigation Tabs */}
      <div className="flex border-b border-slate-200 no-print">
        <button
          onClick={() => { setActiveMainTab('directory'); setCurrentPage(1); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeMainTab === 'directory' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>Vehicles &amp; Fleet Directory</span>
        </button>
        <button
          onClick={() => { setActiveMainTab('availability'); setCurrentPage(1); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeMainTab === 'availability' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>Fleet Availability &amp; Locations Overview</span>
        </button>
        <button
          onClick={() => { setActiveMainTab('assignments'); setCurrentPage(1); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeMainTab === 'assignments' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Driver Substitution &amp; Assignments History</span>
        </button>
      </div>

      {/* Fleet Executive Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Fleet</p>
          <h4 className="text-xl font-black text-slate-900 mt-1">{fleetSummary.totalCount} <span className="text-xs font-semibold text-slate-400">Vehicles</span></h4>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Available (Free)</p>
          <h4 className="text-xl font-black text-emerald-700 mt-1">{fleetSummary.availableCount}</h4>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">On Active Trip</p>
          <h4 className="text-xl font-black text-blue-700 mt-1">{fleetSummary.onTripCount}</h4>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">In Maintenance</p>
          <h4 className="text-xl font-black text-amber-700 mt-1">{fleetSummary.maintenanceCount}</h4>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-sm">
          <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Freight Revenue</p>
          <h4 className="text-lg font-black text-indigo-700 mt-1">Rs. {fleetSummary.totalFreightRevenue.toLocaleString()}</h4>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Fleet Profit</p>
          <h4 className={`text-lg font-black mt-1 ${fleetSummary.netFleetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            Rs. {fleetSummary.netFleetProfit.toLocaleString()}
          </h4>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FLEET DIRECTORY & VEHICLE MASTERS */}
      {/* ========================================================================= */}
      {activeMainTab === 'directory' && (
        <div className="space-y-4">
          {/* Action and Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search vehicle #, model, driver..."
                  className="w-full pl-8 pr-7 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500 bg-white"
                />
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-3" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Operating Category Filter */}
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">🚛 All Categories</option>
                <option value="tons">Tons-based (Dumpers/Loaders)</option>
                <option value="hours">Hours-based (Machinery/Excavator)</option>
                <option value="trips">Trips-based (Flat Freight)</option>
                <option value="truck">Truck Category</option>
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">⚡ All Statuses</option>
                <option value="available">🟢 Available (Free)</option>
                <option value="on_trip">🔵 On Active Trip</option>
                <option value="maintenance">🟡 Maintenance / Workshop</option>
                <option value="inactive">🔴 Inactive / Out of Service</option>
              </select>

              {/* Active Toggle Filter */}
              <select
                value={filterActive}
                onChange={e => setFilterActive(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="active">Active Fleet Only</option>
                <option value="inactive">Inactive Fleet Only</option>
                <option value="all">Show All (Active + Inactive)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Fleet Roster</span>
              </button>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Register Vehicle</span>
              </button>
            </div>
          </div>

          {/* Printable Container */}
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
              <p className="text-sm font-bold text-slate-600 tracking-wider uppercase mt-1">FLEET MASTERS &amp; VEHICLE DIRECTORY</p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Total Fleet: {vehicles.length} Vehicles</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* Vehicle Table View */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Vehicle / Reg #</th>
                      <th className="px-5 py-3.5">Category &amp; Make</th>
                      <th className="px-5 py-3.5">Assigned Driver</th>
                      <th className="px-5 py-3.5">Capacity / Measurement</th>
                      <th className="px-5 py-3.5">Default Rates</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedVehicles.map(veh => {
                      const isFree = veh.active !== false && (veh.status === 'available' || !veh.status);
                      const isOnTrip = veh.status === 'on_trip';
                      const isMaint = veh.status === 'maintenance';
                      const isInactive = veh.active === false || veh.status === 'inactive';

                      return (
                        <tr key={veh.id} className="hover:bg-slate-50/75 transition">
                          <td className="px-5 py-3.5">
                            <div className="font-black text-slate-900 text-sm tracking-wide">{veh.number}</div>
                            <div className="text-[11px] font-medium text-slate-500">{veh.type || 'Commercial Vehicle'}</div>
                            {veh.ownerName && (
                              <div className="text-[10px] text-slate-400">Owner: {veh.ownerName}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {veh.category || 'Tons'}
                            </span>
                            <div className="text-slate-600 font-medium mt-1">
                              {veh.make} {veh.model ? `(${veh.model})` : ''}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {veh.driver ? (
                              <div>
                                <div className="font-bold text-slate-800">{veh.driver}</div>
                                {veh.driverPhone && (
                                  <div className="text-[11px] font-mono text-slate-500 flex items-center space-x-1">
                                    <Phone className="h-3 w-3 inline text-slate-400" />
                                    <span>{veh.driverPhone}</span>
                                  </div>
                                )}
                                {veh.driverCnic && (
                                  <div className="text-[10px] text-slate-400 font-mono">CNIC: {veh.driverCnic}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No Driver Assigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-800">
                              {veh.capacity ? `${veh.capacity} ${veh.capacityUnit || 'Ton'}` : '—'}
                            </div>
                            <div className="text-[11px] text-slate-500 capitalize">
                              Mode: {veh.measurement || 'tons'}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 space-y-0.5">
                            {veh.hourlyRate ? (
                              <div className="font-bold text-indigo-700">Rs. {veh.hourlyRate.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">/ hr</span></div>
                            ) : null}
                            {veh.perTonRate ? (
                              <div className="font-medium text-slate-700">Rs. {veh.perTonRate.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">/ ton</span></div>
                            ) : null}
                            {veh.perTripRate ? (
                              <div className="font-medium text-slate-700">Rs. {veh.perTripRate.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">/ trip</span></div>
                            ) : null}
                            {!veh.hourlyRate && !veh.perTonRate && !veh.perTripRate && (
                              <span className="text-slate-400">Standard Freight</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {isFree && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                🟢 Available
                              </span>
                            )}
                            {isOnTrip && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                🔵 On Trip
                              </span>
                            )}
                            {isMaint && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                🟡 Maintenance
                              </span>
                            )}
                            {isInactive && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                🔴 Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap no-print">
                            <button
                              onClick={() => { setViewDetailVehicle(veh); setDetailSubTab('profile'); }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-semibold transition border border-indigo-200"
                              title="View Full Vehicle Ledger & History"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              <span>Ledger</span>
                            </button>
                            <button
                              onClick={() => handleOpenSubstitution(veh)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition border border-slate-300"
                              title="Substitute / Replace Driver"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Driver</span>
                            </button>
                            <button
                              onClick={() => handleOpenForm(veh)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition"
                              title="Edit Vehicle"
                            >
                              <Edit className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDelete(veh.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition"
                              title="Delete Vehicle"
                            >
                              <Trash className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredVehicles.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          {searchQuery ? `No matching vehicles found for "${searchQuery}".` : 'No vehicles registered yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredVehicles.length}
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

      {/* ========================================================================= */}
      {/* TAB 2: FLEET AVAILABILITY & LIVE LOCATIONS OVERVIEW */}
      {/* ========================================================================= */}
      {activeMainTab === 'availability' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h3 className="text-base font-bold text-slate-800">Fleet Availability &amp; Assignment Matrix</h3>
              <p className="text-xs text-slate-500">Live operational status, assigned drivers, and active work locations</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Availability Matrix</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Vehicle</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Measurement</th>
                    <th className="px-5 py-3.5">Current Driver</th>
                    <th className="px-5 py-3.5">Operational Location</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Current Trip</th>
                    <th className="px-5 py-3.5 text-right no-print">Quick Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map(v => {
                    const isAvail = v.active !== false && (v.status === 'available' || !v.status);
                    const currentTrip = trips.find(t => t.id === v.currentTripId || (t.vehicleId === v.id && t.tripStatus === 'active'));

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/75 transition">
                        <td className="px-5 py-3.5">
                          <div className="font-black text-slate-900 text-sm">{v.number}</div>
                          <div className="text-[11px] text-slate-500">{v.make} {v.model}</div>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700 uppercase">{v.category || 'Tons'}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-600 capitalize">{v.measurement || 'tons'}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-800">{v.driver || '—'}</div>
                          {v.driverPhone && <div className="text-[11px] font-mono text-slate-500">{v.driverPhone}</div>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-700 flex items-center space-x-1">
                            <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span>{v.currentLocation || currentTrip?.to || 'Yard / Base Site'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 italic">Latest Trip Destination</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {isAvail && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🟢 Available (Free)
                            </span>
                          )}
                          {v.status === 'on_trip' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              🔵 On Active Trip
                            </span>
                          )}
                          {v.status === 'maintenance' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              🟡 Maintenance
                            </span>
                          )}
                          {v.active === false && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              🔴 Out of Service
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {currentTrip ? (
                            <div>
                              <div className="font-bold text-indigo-600">{currentTrip.id}</div>
                              <div className="text-[11px] text-slate-500">{currentTrip.from} → {currentTrip.to}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right no-print">
                          <button
                            onClick={() => { setViewDetailVehicle(v); setDetailSubTab('profile'); }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                          >
                            View Specs →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DRIVER SUBSTITUTION & ASSIGNMENT AUDIT LOG */}
      {/* ========================================================================= */}
      {activeMainTab === 'assignments' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h3 className="text-base font-bold text-slate-800">Driver Substitution &amp; Assignment Audit Trail</h3>
              <p className="text-xs text-slate-500">Historical logs of vehicle-to-driver assignments, emergency replacements, and authorized reasons</p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Audit Trail</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Date &amp; Time</th>
                    <th className="px-5 py-3.5">Vehicle #</th>
                    <th className="px-5 py-3.5">Original Assigned Driver</th>
                    <th className="px-5 py-3.5">Replacement Driver</th>
                    <th className="px-5 py-3.5">Reason for Substitution</th>
                    <th className="px-5 py-3.5">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map(asgn => (
                    <tr key={asgn.id} className="hover:bg-slate-50/75 transition">
                      <td className="px-5 py-3.5 font-mono text-slate-500">
                        {asgn.startDateTime ? new Date(asgn.startDateTime).toLocaleString('en-GB') : asgn.createdDate}
                      </td>
                      <td className="px-5 py-3.5 font-black text-slate-800">{asgn.vehicleNumber}</td>
                      <td className="px-5 py-3.5 text-slate-600">{asgn.originalDriverName || '—'}</td>
                      <td className="px-5 py-3.5 font-bold text-indigo-700">{asgn.replacementDriverName || asgn.driverName}</td>
                      <td className="px-5 py-3.5 text-slate-700">{asgn.reason}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-600">{asgn.authorizedBy || 'Admin'}</td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        No driver substitutions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VEHICLE DETAILS & COMPREHENSIVE LEDGER MODAL */}
      {/* ========================================================================= */}
      {viewDetailVehicle && selectedVehMetrics && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black">{viewDetailVehicle.number}</h3>
                  <p className="text-xs text-slate-300">
                    {viewDetailVehicle.make} {viewDetailVehicle.model} | Driver: {viewDetailVehicle.driver || 'Unassigned'} | Category: {viewDetailVehicle.category || 'Tons'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewDetailVehicle(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 shrink-0">
              <button
                onClick={() => setDetailSubTab('profile')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition ${detailSubTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Technical Profile
              </button>
              <button
                onClick={() => setDetailSubTab('trips')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition ${detailSubTab === 'trips' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Trips &amp; Revenue ({selectedVehMetrics.totalTripsCount})
              </button>
              <button
                onClick={() => setDetailSubTab('diesel')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition ${detailSubTab === 'diesel' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Diesel Ledger
              </button>
              <button
                onClick={() => setDetailSubTab('maintenance')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition ${detailSubTab === 'maintenance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Maintenance &amp; Workshop
              </button>
              <button
                onClick={() => setDetailSubTab('profitability')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition ${detailSubTab === 'profitability' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Vehicle Investment &amp; Net Profit
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Profile SubTab */}
              {detailSubTab === 'profile' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">Vehicle Technical Specifications</h4>
                    <div className="grid grid-cols-2 gap-3 text-slate-700">
                      <div><span className="text-slate-400 font-medium">Registration:</span> <span className="font-bold">{viewDetailVehicle.number}</span></div>
                      <div><span className="text-slate-400 font-medium">Operating Category:</span> <span className="font-bold uppercase">{viewDetailVehicle.category || 'Tons'}</span></div>
                      <div><span className="text-slate-400 font-medium">Measurement:</span> <span className="font-bold capitalize">{viewDetailVehicle.measurement || 'tons'}</span></div>
                      <div><span className="text-slate-400 font-medium">Vehicle Make:</span> <span className="font-bold">{viewDetailVehicle.make || '—'}</span></div>
                      <div><span className="text-slate-400 font-medium">Model:</span> <span className="font-bold">{viewDetailVehicle.model || '—'}</span></div>
                      <div><span className="text-slate-400 font-medium">Year:</span> <span className="font-bold">{viewDetailVehicle.manufacturingYear || '—'}</span></div>
                      <div><span className="text-slate-400 font-medium">Chassis #:</span> <span className="font-mono">{viewDetailVehicle.chassisNo || '—'}</span></div>
                      <div><span className="text-slate-400 font-medium">Engine #:</span> <span className="font-mono">{viewDetailVehicle.engineNo || '—'}</span></div>
                      <div><span className="text-slate-400 font-medium">Capacity:</span> <span className="font-bold">{viewDetailVehicle.capacity} {viewDetailVehicle.capacityUnit || 'Ton'}</span></div>
                      <div><span className="text-slate-400 font-medium">Odometer:</span> <span className="font-mono">{viewDetailVehicle.currentOdometer || 0} KM</span></div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">Assigned Driver &amp; Rates</h4>
                    <div className="space-y-2 text-slate-700">
                      <div><span className="text-slate-400 font-medium">Driver Name:</span> <span className="font-bold text-indigo-700">{viewDetailVehicle.driver || 'No Driver Assigned'}</span></div>
                      <div><span className="text-slate-400 font-medium">Driver Phone:</span> <span className="font-mono">{viewDetailVehicle.driverPhone || '—'}</span></div>
                      <div><span className="text-slate-400 font-medium">Driver CNIC:</span> <span className="font-mono">{viewDetailVehicle.driverCnic || '—'}</span></div>
                      <div><span className="text-slate-400 font-medium">Hourly Rate:</span> <span className="font-bold text-emerald-700">Rs. {(viewDetailVehicle.hourlyRate || 0).toLocaleString()} / hr</span></div>
                      <div><span className="text-slate-400 font-medium">Per Ton Rate:</span> <span className="font-bold">Rs. {(viewDetailVehicle.perTonRate || 0).toLocaleString()} / ton</span></div>
                      <div><span className="text-slate-400 font-medium">Per Trip Rate:</span> <span className="font-bold">Rs. {(viewDetailVehicle.perTripRate || 0).toLocaleString()} / trip</span></div>
                      <div><span className="text-slate-400 font-medium">Owner:</span> <span className="font-bold">{viewDetailVehicle.ownerName || 'Al-Madina'} ({viewDetailVehicle.ownerContact})</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Trips & Revenue SubTab */}
              {detailSubTab === 'trips' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                      <p className="text-indigo-600 font-semibold uppercase text-[10px]">Total Trips</p>
                      <h4 className="text-lg font-black text-indigo-900">{selectedVehMetrics.totalTripsCount}</h4>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <p className="text-emerald-600 font-semibold uppercase text-[10px]">Total Freight Revenue</p>
                      <h4 className="text-lg font-black text-emerald-900">Rs. {selectedVehMetrics.totalFreightEarned.toLocaleString()}</h4>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <p className="text-rose-600 font-semibold uppercase text-[10px]">Trip Route Expenses</p>
                      <h4 className="text-lg font-black text-rose-900">Rs. {selectedVehMetrics.totalTripExpenses.toLocaleString()}</h4>
                    </div>
                  </div>

                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Trip ID</th>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5">Route</th>
                        <th className="px-4 py-2.5 text-right">Freight Charges</th>
                        <th className="px-4 py-2.5 text-right">Expenses</th>
                        <th className="px-4 py-2.5 text-right">Net Trip Kamai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedVehMetrics.vehTrips.map(t => (
                        <tr key={t.id}>
                          <td className="px-4 py-2 font-mono text-slate-500">{t.date}</td>
                          <td className="px-4 py-2 font-bold text-indigo-600">{t.id}</td>
                          <td className="px-4 py-2 text-slate-700">{customers.find(c => c.id === t.customerId)?.name || t.customerId}</td>
                          <td className="px-4 py-2 text-slate-600">{t.from} → {t.to}</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-800">Rs. {t.vehicleCharges.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-rose-600">Rs. {t.totalExpenses.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-black text-emerald-600">Rs. {t.netTripProfit.toLocaleString()}</td>
                        </tr>
                      ))}
                      {selectedVehMetrics.vehTrips.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-6 text-slate-400">No trips recorded for this vehicle.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Diesel Ledger SubTab */}
              {detailSubTab === 'diesel' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-slate-400 font-semibold uppercase text-[10px]">Total Litres Purchased</p>
                      <h4 className="text-lg font-black text-slate-900">{selectedVehMetrics.totalLitresPurchased} L</h4>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-amber-600 font-semibold uppercase text-[10px]">Total Diesel Cost</p>
                      <h4 className="text-lg font-black text-amber-900">Rs. {selectedVehMetrics.totalDieselCost.toLocaleString()}</h4>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-blue-600 font-semibold uppercase text-[10px]">Litres Consumed</p>
                      <h4 className="text-lg font-black text-blue-900">{selectedVehMetrics.totalLitresUsed} L</h4>
                    </div>
                  </div>

                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Vendor / Fuel Pump</th>
                        <th className="px-4 py-2.5">Litres</th>
                        <th className="px-4 py-2.5">Rate / L</th>
                        <th className="px-4 py-2.5 text-right">Total Cost</th>
                        <th className="px-4 py-2.5">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedVehMetrics.vehDiesel.map(d => (
                        <tr key={d.id}>
                          <td className="px-4 py-2 font-mono text-slate-500">{d.date}</td>
                          <td className="px-4 py-2 font-semibold text-slate-700">{d.vendorName || d.vendorId}</td>
                          <td className="px-4 py-2 font-bold">{d.litres} L</td>
                          <td className="px-4 py-2">Rs. {d.ratePerLitre}</td>
                          <td className="px-4 py-2 text-right font-black text-slate-800">Rs. {d.totalAmount.toLocaleString()}</td>
                          <td className="px-4 py-2 font-medium">{d.paymentType}</td>
                        </tr>
                      ))}
                      {selectedVehMetrics.vehDiesel.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-6 text-slate-400">No diesel purchases recorded for this vehicle.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Maintenance SubTab */}
              {detailSubTab === 'maintenance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-slate-400 font-semibold uppercase text-[10px]">Spare Parts Cost</p>
                      <h4 className="text-lg font-black text-slate-900">Rs. {selectedVehMetrics.totalPartsCost.toLocaleString()}</h4>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-slate-400 font-semibold uppercase text-[10px]">Labour / Workshop Cost</p>
                      <h4 className="text-lg font-black text-slate-900">Rs. {selectedVehMetrics.totalLabourCost.toLocaleString()}</h4>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <p className="text-rose-600 font-semibold uppercase text-[10px]">Total Maintenance Cost</p>
                      <h4 className="text-lg font-black text-rose-900">Rs. {selectedVehMetrics.totalMaintCost.toLocaleString()}</h4>
                    </div>
                  </div>

                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Workshop / Description</th>
                        <th className="px-4 py-2.5 text-right">Parts</th>
                        <th className="px-4 py-2.5 text-right">Labour</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedVehMetrics.vehMaint.map(m => (
                        <tr key={m.id}>
                          <td className="px-4 py-2 font-mono text-slate-500">{m.date}</td>
                          <td className="px-4 py-2 font-bold text-slate-700">{m.category}</td>
                          <td className="px-4 py-2 text-slate-600">{m.workshopVendor} - {m.description}</td>
                          <td className="px-4 py-2 text-right">Rs. {m.partsCost.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">Rs. {m.labourCost.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-black text-rose-700">Rs. {m.totalCost.toLocaleString()}</td>
                        </tr>
                      ))}
                      {selectedVehMetrics.vehMaint.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-6 text-slate-400">No maintenance records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Profitability SubTab */}
              {detailSubTab === 'profitability' && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Vehicle Life-Cycle Investment &amp; Profitability Statement</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Total Freight Revenues Generated:</span>
                      <span className="font-black text-emerald-700">+ Rs. {selectedVehMetrics.totalFreightEarned.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Trip Expenses (Kanta, Toll, Driver Food, Commission):</span>
                      <span className="font-black text-rose-600">- Rs. {selectedVehMetrics.totalTripExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Total Workshop Maintenance &amp; Parts Cost:</span>
                      <span className="font-black text-rose-600">- Rs. {selectedVehMetrics.totalMaintCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 bg-slate-900 text-white px-4 rounded-xl mt-3 font-bold text-base">
                      <span>Net Life-Cycle Operating Profit:</span>
                      <span className={selectedVehMetrics.netVehProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        Rs. {selectedVehMetrics.netVehProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VEHICLE REGISTRATION & EDIT FORM MODAL */}
      {/* ========================================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-black text-base">
                {editingId ? 'Edit Vehicle Profile' : 'Register New Vehicle in Fleet'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Vehicle / Reg # *</label>
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={e => setNumber(e.target.value)}
                    placeholder="e.g. TLK-1234, T-440"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Operating Category *</label>
                  <select
                    value={category}
                    onChange={e => {
                      const cat = e.target.value as any;
                      setCategory(cat);
                      if (cat === 'tons') setMeasurement('tons');
                      if (cat === 'hours') setMeasurement('hours');
                      if (cat === 'trips') setMeasurement('trips');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="tons">Tons-based (Dumpers/Loaders)</option>
                    <option value="hours">Hours-based (Machinery/Excavator)</option>
                    <option value="trips">Trips-based (Per-trip flat)</option>
                    <option value="truck">Truck Category</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Operating Measurement</label>
                  <select
                    value={measurement}
                    onChange={e => setMeasurement(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="tons">Tons (Weight)</option>
                    <option value="hours">Hours (Operating Time)</option>
                    <option value="trips">Trips (Flat Count)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Vehicle Type / Body</label>
                  <input
                    type="text"
                    value={type}
                    onChange={e => setType(e.target.value)}
                    placeholder="e.g. Dump Truck, Excavator, Crane"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Make / Brand</label>
                  <input
                    type="text"
                    value={make}
                    onChange={e => setMake(e.target.value)}
                    placeholder="e.g. Hino, Isuzu, CAT, Komatsu"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Model &amp; Year</label>
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="e.g. 500 Series (2022)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Capacity</label>
                  <div className="flex">
                    <input
                      type="number"
                      step="0.01"
                      value={capacity}
                      onChange={e => setCapacity(Number(e.target.value))}
                      className="w-2/3 px-3 py-2 border border-r-0 border-slate-200 rounded-l-lg font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={capacityUnit}
                      onChange={e => setCapacityUnit(e.target.value as any)}
                      className="w-1/3 px-2 py-2 border border-slate-200 rounded-r-lg font-semibold bg-slate-50"
                    >
                      <option value="Ton">Ton</option>
                      <option value="KG">KG</option>
                      <option value="Hour">Hour</option>
                      <option value="Trip">Trip</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Default Hourly Rate (Rs./hr)</label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(Number(e.target.value))}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-indigo-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="available">🟢 Available (Free)</option>
                    <option value="on_trip">🔵 On Active Trip</option>
                    <option value="maintenance">🟡 Maintenance / Workshop</option>
                    <option value="inactive">🔴 Inactive / Out of Service</option>
                  </select>
                </div>
              </div>

              {/* Driver Details Section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Assigned Driver Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Select from Staff / Drivers</label>
                    <select
                      value={driverId}
                      onChange={e => handleDriverSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold bg-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Custom / Direct Driver --</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.designation || 'Staff'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Driver Name</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      placeholder="e.g. Mohammad Ali"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Driver Phone / Mobile</label>
                    <input
                      type="text"
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      placeholder="e.g. 0300-1234567"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Driver CNIC</label>
                    <input
                      type="text"
                      value={driverCnic}
                      onChange={e => setDriverCnic(e.target.value)}
                      placeholder="e.g. 42101-1234567-1"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Driver Address</label>
                    <input
                      type="text"
                      value={driverAddress}
                      onChange={e => setDriverAddress(e.target.value)}
                      placeholder="e.g. Winder / Hub, Balochistan"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle Checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="vehActiveCheck"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="vehActiveCheck" className="font-bold text-slate-700 cursor-pointer">
                  Vehicle is Active (Uncheck if vehicle is retired or permanently out of service)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition"
                >
                  {editingId ? 'Save Changes' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRIVER SUBSTITUTION MODAL */}
      {/* ========================================================================= */}
      {isSubstitutionModalOpen && subVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">Substitute Driver for {subVehicle.number}</h3>
              <button onClick={() => setIsSubstitutionModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubstitution} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500 font-medium">Currently Assigned Driver:</p>
                <p className="font-black text-slate-800 text-sm mt-0.5">{subVehicle.driver || 'No Driver Assigned'}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Replacement Driver *</label>
                <select
                  required
                  value={subReplacementDriverId}
                  onChange={e => setSubReplacementDriverId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg font-semibold bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Driver --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.designation || 'Driver'}) — {s.phone || 'No phone'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Substitution *</label>
                <textarea
                  required
                  rows={3}
                  value={subReason}
                  onChange={e => setSubReason(e.target.value)}
                  placeholder="e.g. Original driver on leave / shift replacement / emergency"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Authorized By</label>
                <input
                  type="text"
                  value={subAuthorizedBy}
                  onChange={e => setSubAuthorizedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSubstitutionModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
