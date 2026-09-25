import React, { useEffect, useState, useMemo } from 'react';
import { 
  getAllRecords, 
  putRecord, 
  deleteRecord, 
  DBStaff, 
  DBStaffPayment, 
  DBBank, 
  DBVehicle,
  DBTrip,
  DBDriverAdvance,
  DBDriverExpenseSubmission,
  DBStaffCategory
} from '../db/firestore';
import { 
  calculateLiveBalances, 
  LiveBalances, 
  saveStaffPaymentTransaction, 
  deleteStaffPaymentTransaction, 
  migrateLegacyStaffAndPayments,
  saveDriverAdvanceTransaction,
  deleteDriverAdvanceTransaction,
  saveDriverExpenseSettlementTransaction
} from '../db/transactions';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash, 
  DollarSign, 
  Wallet, 
  ClipboardList, 
  Printer, 
  Search, 
  X, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft,
  ChevronRight,
  UserCheck,
  Truck,
  Shield,
  CreditCard,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  Upload,
  Camera,
  Eye,
  Download,
  Building2
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

export default function StaffManagement() {
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'payments' | 'driver_advances' | 'ledger'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Ledger Specific States
  const [activeLedgerStaffId, setActiveLedgerStaffId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');

  // Data States
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [payments, setPayments] = useState<DBStaffPayment[]>([]);
  const [driverAdvances, setDriverAdvances] = useState<DBDriverAdvance[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<DBDriverExpenseSubmission[]>([]);
  const [vehicles, setVehicles] = useState<DBVehicle[]>([]);
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  // Form States
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isDriverAdvFormOpen, setIsDriverAdvFormOpen] = useState(false);
  const [isDriverExpenseFormOpen, setIsDriverExpenseFormOpen] = useState(false);
  const [viewCnicModal, setViewCnicModal] = useState<{ staffName: string; cnic: string; url: string } | null>(null);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // Staff Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [category, setCategory] = useState('Driver');
  const [cnic, setCnic] = useState('');
  const [cnicDocUrl, setCnicDocUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [salaryType, setSalaryType] = useState<'Monthly' | 'Daily' | 'Trip-based' | 'Commission'>('Monthly');
  const [basicSalary, setBasicSalary] = useState(0);
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Filter States
  const [plantFilter, setPlantFilter] = useState<'all' | 'plant1' | 'plant2'>('all');

  // Payment Form fields
  const [payStaffId, setPayStaffId] = useState('');
  const [payType, setPayType] = useState<'salary' | 'advance' | 'loan' | 'settlement' | 'advance_repayment' | 'loan_repayment'>('salary');
  const [payAmount, setPayAmount] = useState(0); // Gross salary, Advance/Loan amount, or Repayment amount
  const [payAdvanceAdjusted, setPayAdvanceAdjusted] = useState(0);
  const [payLoanAdjusted, setPayLoanAdjusted] = useState(0);
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [payBankId, setPayBankId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDesc, setPayDesc] = useState('');

  // Driver Advance Form fields
  const [advDriverId, setAdvDriverId] = useState('');
  const [advVehicleId, setAdvVehicleId] = useState('');
  const [advTripId, setAdvTripId] = useState('');
  const [advAmount, setAdvAmount] = useState<number>(0);
  const [advPaymentType, setAdvPaymentType] = useState<'Cash' | 'Bank'>('Cash');
  const [advBankId, setAdvBankId] = useState('');
  const [advPurpose, setAdvPurpose] = useState('Route Fuel & Trip Expenses');
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);

  // Driver Expense Settlement Form fields
  const [expDriverId, setExpDriverId] = useState('');
  const [expVehicleId, setExpVehicleId] = useState('');
  const [expTripId, setExpTripId] = useState('');
  const [expCategory, setExpCategory] = useState('Diesel');
  const [expDesc, setExpDesc] = useState('');
  const [expClaimed, setExpClaimed] = useState<number>(0);
  const [expApproved, setExpApproved] = useState<number>(0);
  const [expCashReturned, setExpCashReturned] = useState<number>(0);
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  const [editingAdvId, setEditingAdvId] = useState<string | null>(null);

  const defaultCategories = [
    'Plant 1',
    'Plant 2',
    'Driver',
    'Caleender / Cleaner (کلینڈر)',
    'Labour (مزدور)',
    'Munshi / Clerk',
    'Accountant',
    'Mechanic / Mistri',
    'Dohbi / Loader',
    'Chowkidar / Security',
    'Site Supervisor',
    'Management / Admin'
  ];

  const loadData = async () => {
    try {
      await migrateLegacyStaffAndPayments();

      const [
        allStaff, 
        allPayments, 
        allAdvances, 
        allExpenses, 
        allVehicles, 
        allTrips, 
        allBanks
      ] = await Promise.all([
        getAllRecords<DBStaff>('staff'),
        getAllRecords<DBStaffPayment>('staff_payments'),
        getAllRecords<DBDriverAdvance>('driver_advances'),
        getAllRecords<DBDriverExpenseSubmission>('driver_expenses'),
        getAllRecords<DBVehicle>('vehicles'),
        getAllRecords<DBTrip>('trips'),
        getAllRecords<DBBank>('banks')
      ]);

      setStaff(allStaff);
      if (allStaff.length > 0 && !payStaffId) {
        setPayStaffId(allStaff[0].id);
      }

      allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(allPayments);

      allAdvances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDriverAdvances(allAdvances);

      allExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDriverExpenses(allExpenses);

      setVehicles(allVehicles);
      setTrips(allTrips);
      setBanks(allBanks);
      if (allBanks.length > 0 && !payBankId) setPayBankId(allBanks[0].id);

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      setLoading(false);
    } catch (err) {
      console.error('Error loading staff data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Recalculate net paid dynamically for salary form
  useEffect(() => {
    if (payType === 'salary' || payType === 'settlement') {
      const remaining = payAmount - payAdvanceAdjusted;
      if (remaining < 0) {
        setPayAdvanceAdjusted(payAmount);
      }
    } else {
      setPayAdvanceAdjusted(0);
    }
  }, [payAmount, payAdvanceAdjusted, payType]);

  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WebP, etc.)');
      return;
    }
    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            setCnicDocUrl(dataUrl);
          } else {
            setCnicDocUrl(e.target?.result as string);
          }
        } catch (err) {
          console.error('Error compressing image:', err);
          setCnicDocUrl(e.target?.result as string);
        } finally {
          setIsUploadingImage(false);
        }
      };
      img.onerror = () => {
        setIsUploadingImage(false);
        alert('Could not process image file. Please try another image.');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      alert('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleOpenStaffForm = (st?: DBStaff) => {
    if (st) {
      setEditingStaffId(st.id);
      setName(st.name);
      setPhone(st.phone || '');
      setDesignation(st.designation || '');
      setCategory(st.category || 'Driver');
      setCnic(st.cnic || '');
      setCnicDocUrl(st.cnicDocUrl || '');
      setLicenseNo(st.licenseNo || '');
      setLicenseExpiry(st.licenseExpiry || '');
      setSalaryType(st.salaryType || 'Monthly');
      setBasicSalary(st.basicSalary || 0);
      setAddress(st.address || '');
      setEmergencyContact(st.emergencyContact || '');
    } else {
      setEditingStaffId(null);
      setName('');
      setPhone('');
      setDesignation('');
      setCategory('Driver');
      setCnic('');
      setCnicDocUrl('');
      setLicenseNo('');
      setLicenseExpiry('');
      setSalaryType('Monthly');
      setBasicSalary(0);
      setAddress('');
      setEmergencyContact('');
    }
    setIsStaffFormOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let stId = editingStaffId;
    if (!stId) {
      let maxNum = 0;
      const prefixes = ['staf-', 'stf-', 'staff-'];
      for (const s of staff) {
        for (const pref of prefixes) {
          if (s.id && s.id.startsWith(pref)) {
            const numPart = parseInt(s.id.replace(pref, ''), 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        }
      }
      stId = `staf-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const savedStaff: DBStaff = {
      id: stId,
      name: name.trim(),
      phone: phone.trim(),
      designation: designation.trim() || category,
      category,
      cnic: cnic.trim() || undefined,
      cnicDocUrl: cnicDocUrl.trim() || undefined,
      licenseNo: licenseNo.trim() || undefined,
      licenseExpiry: licenseExpiry || undefined,
      salaryType,
      basicSalary: Number(basicSalary) || 0,
      address: address.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined
    };

    await putRecord<DBStaff>('staff', savedStaff);
    setIsStaffFormOpen(false);
    loadData();
  };

  const handleDeleteStaff = async (id: string) => {
    if (confirm('Are you sure you want to delete this staff profile?')) {
      await deleteRecord('staff', id);
      loadData();
    }
  };

  const handleOpenPaymentForm = (
    pmt?: DBStaffPayment,
    initialType?: 'salary' | 'advance' | 'loan' | 'settlement' | 'advance_repayment' | 'loan_repayment',
    initialStaffId?: string
  ) => {
    if (pmt) {
      setEditingPaymentId(pmt.id);
      setPayStaffId(pmt.staffId);
      setPayType(pmt.type);
      setPayAmount(pmt.amount);
      setPayAdvanceAdjusted(pmt.advanceAdjusted || 0);
      setPayLoanAdjusted(pmt.loanAdjusted || 0);
      setPayMethod(pmt.paymentType);
      setPayBankId(pmt.bankId || (banks.length > 0 ? banks[0].id : ''));
      setPayDate(pmt.date);
      setPayDesc(pmt.description);
    } else {
      setEditingPaymentId(null);
      const chosenType = initialType || 'salary';
      setPayType(chosenType);
      const targetId = initialStaffId || (activeLedgerStaffId !== 'all' ? activeLedgerStaffId : (staff.length > 0 ? staff[0].id : ''));
      setPayStaffId(targetId);
      const foundStaff = staff.find(s => s.id === targetId);
      const bal = balances?.staffBalances[targetId];

      if (chosenType === 'salary') {
        setPayAmount(foundStaff ? foundStaff.basicSalary : 0);
        setPayAdvanceAdjusted(0);
        setPayLoanAdjusted(0);
      } else if (chosenType === 'advance_repayment') {
        const curAdv = bal?.advanceBalance !== undefined ? bal.advanceBalance : (bal?.advanceLoanBalance || 0);
        setPayAmount(curAdv > 0 ? curAdv : 0);
        setPayAdvanceAdjusted(0);
        setPayLoanAdjusted(0);
      } else if (chosenType === 'loan_repayment') {
        const curLoan = bal?.loanBalance || 0;
        setPayAmount(curLoan > 0 ? curLoan : 0);
        setPayAdvanceAdjusted(0);
        setPayLoanAdjusted(0);
      } else {
        setPayAmount(0);
        setPayAdvanceAdjusted(0);
        setPayLoanAdjusted(0);
      }

      setPayMethod('Cash');
      setPayDate(new Date().toISOString().split('T')[0]);
      setPayDesc('');
      if (banks.length > 0 && !payBankId) setPayBankId(banks[0].id);
    }
    setIsPaymentFormOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payStaffId) {
      alert('Please select an employee.');
      return;
    }
    if (payAmount <= 0) {
      alert('Amount must be greater than 0.');
      return;
    }

    let payId = editingPaymentId;
    if (!payId) {
      let maxNum = 0;
      for (const p of payments) {
        if (p.id && p.id.startsWith('pay-')) {
          const numPart = parseInt(p.id.replace('pay-', ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
      payId = `pay-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const netPayout = (payType === 'salary' || payType === 'settlement')
      ? Math.max(0, payAmount - (payAdvanceAdjusted || 0) - (payLoanAdjusted || 0))
      : payAmount;

    const payment: DBStaffPayment = {
      id: payId,
      date: payDate,
      staffId: payStaffId,
      type: payType,
      amount: Number(payAmount),
      advanceAdjusted: (payType === 'salary' || payType === 'settlement') ? Number(payAdvanceAdjusted || 0) : 0,
      loanAdjusted: (payType === 'salary' || payType === 'settlement') ? Number(payLoanAdjusted || 0) : 0,
      netPaid: Number(netPayout),
      paymentType: payMethod,
      bankId: payMethod === 'Bank' ? payBankId : undefined,
      description: payDesc.trim() || `${payType.replace('_', ' ').toUpperCase()} for ${payStaffId}`
    };

    try {
      await saveStaffPaymentTransaction(payment);
      setIsPaymentFormOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save staff payment: ' + (err?.message || err));
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (confirm('Are you sure you want to delete this staff payment? All ledger entries will be reversed.')) {
      await deleteStaffPaymentTransaction(id);
      loadData();
    }
  };

  // Driver Advance Handlers
  const handleOpenDriverAdvForm = (adv?: DBDriverAdvance) => {
    if (adv) {
      setEditingAdvId(adv.id);
      setAdvDriverId(adv.driverId);
      setAdvVehicleId(adv.vehicleId || '');
      setAdvTripId(adv.tripId || '');
      setAdvAmount(adv.amount);
      setAdvPaymentType(adv.paymentType || 'Cash');
      setAdvBankId(adv.bankId || (banks.length > 0 ? banks[0].id : ''));
      setAdvPurpose(adv.purpose || 'Trip Advance');
      setAdvDate(adv.date);
    } else {
      setEditingAdvId(null);
      setAdvDriverId(staff.length > 0 ? staff[0].id : '');
      setAdvVehicleId('');
      setAdvTripId('');
      setAdvAmount(0);
      setAdvPaymentType('Cash');
      setAdvBankId(banks.length > 0 ? banks[0].id : '');
      setAdvPurpose('Route Fuel & Trip Expenses');
      setAdvDate(new Date().toISOString().split('T')[0]);
    }
    setIsDriverAdvFormOpen(true);
  };

  const handleSaveDriverAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advDriverId) {
      alert('Please select a driver / staff member.');
      return;
    }
    if (advAmount <= 0) {
      alert('Advance amount must be greater than 0.');
      return;
    }

    let advId = editingAdvId;
    if (!advId) {
      const prefix = 'dadv-';
      const existingIds = driverAdvances.map(a => a.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const n = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
      advId = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }
    const driver = staff.find(s => s.id === advDriverId);

    const adv: DBDriverAdvance = {
      id: advId,
      date: advDate,
      driverId: advDriverId,
      driverName: driver ? driver.name : advDriverId,
      vehicleId: advVehicleId || undefined,
      tripId: advTripId || undefined,
      amount: Number(advAmount),
      paymentType: advPaymentType,
      bankId: advPaymentType === 'Bank' ? advBankId : undefined,
      purpose: advPurpose.trim() || 'Trip Advance',
      status: 'Approved'
    };

    try {
      await saveDriverAdvanceTransaction(adv);
      setIsDriverAdvFormOpen(false);
      setAdvAmount(0);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save driver advance: ' + (err?.message || err));
    }
  };

  const handleDeleteDriverAdvance = async (id: string) => {
    if (confirm('Are you sure you want to delete this driver advance?')) {
      await deleteDriverAdvanceTransaction(id);
      loadData();
    }
  };

  // Driver Settlement Handlers
  const handleSaveDriverExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDriverId) {
      alert('Please select a driver.');
      return;
    }
    if (expClaimed <= 0) {
      alert('Claimed amount must be greater than 0.');
      return;
    }

    const prefix = 'dexp-';
    const existingIds = driverExpenses.map(a => a.id).filter(id => id.startsWith(prefix));
    let maxNum = 0;
    for (const id of existingIds) {
      const n = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    const expId = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    const driver = staff.find(s => s.id === expDriverId);

    const sub: DBDriverExpenseSubmission = {
      id: expId,
      date: expDate,
      driverId: expDriverId,
      driverName: driver ? driver.name : expDriverId,
      vehicleId: expVehicleId || undefined,
      tripId: expTripId || undefined,
      category: expCategory,
      description: expDesc.trim() || expCategory,
      amountClaimed: Number(expClaimed),
      amountApproved: Number(expApproved || expClaimed),
      amountRejected: Math.max(0, Number(expClaimed) - Number(expApproved || expClaimed)),
      status: 'Settled'
    };

    try {
      await saveDriverExpenseSettlementTransaction(sub, expCashReturned > 0 ? Number(expCashReturned) : undefined);
      setIsDriverExpenseFormOpen(false);
      setExpClaimed(0);
      setExpApproved(0);
      setExpCashReturned(0);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save expense settlement: ' + (err?.message || err));
    }
  };

  const handleOpenLedger = (st: DBStaff) => {
    setActiveLedgerStaffId(st.id);
    setActiveSubTab('ledger');
  };

  // Filters
  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredStaff = staff.filter(s => {
    if (plantFilter === 'plant1') {
      const isP1 = (s.category && s.category.toLowerCase().includes('plant 1')) ||
                   (s.designation && s.designation.toLowerCase().includes('plant 1')) ||
                   (s.address && s.address.toLowerCase().includes('plant 1')) ||
                   (s.notes && s.notes.toLowerCase().includes('plant 1'));
      if (!isP1) return false;
    }
    if (plantFilter === 'plant2') {
      const isP2 = (s.category && s.category.toLowerCase().includes('plant 2')) ||
                   (s.designation && s.designation.toLowerCase().includes('plant 2')) ||
                   (s.address && s.address.toLowerCase().includes('plant 2')) ||
                   (s.notes && s.notes.toLowerCase().includes('plant 2'));
      if (!isP2) return false;
    }
    if (!cleanSearch) return true;
    return (
      s.name.toLowerCase().includes(cleanSearch) ||
      (s.phone && s.phone.includes(cleanSearch)) ||
      (s.designation && s.designation.toLowerCase().includes(cleanSearch)) ||
      (s.category && s.category.toLowerCase().includes(cleanSearch)) ||
      (s.cnic && s.cnic.includes(cleanSearch)) ||
      s.id.toLowerCase().includes(cleanSearch)
    );
  });

  const filteredPayments = payments.filter(p => {
    const stMember = staff.find(s => s.id === p.staffId);
    if (plantFilter === 'plant1') {
      const isP1 = stMember && (
        (stMember.category && stMember.category.toLowerCase().includes('plant 1')) ||
        (stMember.designation && stMember.designation.toLowerCase().includes('plant 1')) ||
        (stMember.address && stMember.address.toLowerCase().includes('plant 1'))
      );
      if (!isP1) return false;
    }
    if (plantFilter === 'plant2') {
      const isP2 = stMember && (
        (stMember.category && stMember.category.toLowerCase().includes('plant 2')) ||
        (stMember.designation && stMember.designation.toLowerCase().includes('plant 2')) ||
        (stMember.address && stMember.address.toLowerCase().includes('plant 2'))
      );
      if (!isP2) return false;
    }
    if (!cleanSearch) return true;
    return (
      p.id.toLowerCase().includes(cleanSearch) ||
      p.date.includes(cleanSearch) ||
      p.type.toLowerCase().includes(cleanSearch) ||
      p.paymentType.toLowerCase().includes(cleanSearch) ||
      (p.description && p.description.toLowerCase().includes(cleanSearch)) ||
      (stMember && stMember.name.toLowerCase().includes(cleanSearch))
    );
  });

  const paginatedStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Selected ledger staff calculations
  const selectedLedgerStaff = useMemo(() => {
    if (activeLedgerStaffId === 'all') return null;
    return staff.find(s => s.id === activeLedgerStaffId) || null;
  }, [staff, activeLedgerStaffId]);

  const staffEnrichedTransactions = useMemo(() => {
    if (!selectedLedgerStaff) return [];
    const list = payments.filter(p => p.staffId === selectedLedgerStaff.id);
    const sortedAsc = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBal = 0;
    return sortedAsc.map(p => {
      const advanceGiven = p.type === 'advance' ? p.amount : 0;
      const loanGiven = p.type === 'loan' ? p.amount : 0;
      const totalGiven = advanceGiven + loanGiven;

      const advanceDeducted = (p.type === 'salary' || p.type === 'settlement') ? (p.advanceAdjusted || 0) : 0;
      const loanDeducted = (p.type === 'salary' || p.type === 'settlement') ? (p.loanAdjusted || 0) : 0;
      const advanceCashRepaid = p.type === 'advance_repayment' ? p.amount : 0;
      const loanCashRepaid = p.type === 'loan_repayment' ? p.amount : 0;
      const totalRepaid = advanceDeducted + loanDeducted + advanceCashRepaid + loanCashRepaid;

      runningBal += (totalGiven - totalRepaid);
      return {
        ...p,
        advanceGiven,
        loanGiven,
        advanceDeducted,
        loanDeducted,
        advanceCashRepaid,
        loanCashRepaid,
        totalGiven,
        totalRepaid,
        runningBal
      };
    });
  }, [selectedLedgerStaff, payments]);

  if (loading) {
    return <div className="text-center py-10 font-bold text-slate-500">Loading staff & payroll records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-slate-200 no-print">
        <button
          onClick={() => { setActiveSubTab('roster'); setCurrentPage(1); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeSubTab === 'roster' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Staff Profiles &amp; Roster</span>
        </button>
        <button
          onClick={() => { setActiveSubTab('payments'); setCurrentPage(1); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeSubTab === 'payments' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>Salaries &amp; Vouchers</span>
        </button>
        <button
          onClick={() => { setActiveSubTab('driver_advances'); setCurrentPage(1); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeSubTab === 'driver_advances' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>Driver Advances &amp; Route Settlements</span>
        </button>
        <button
          onClick={() => { setActiveSubTab('ledger'); setCurrentPage(1); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeSubTab === 'ledger' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Staff Ledger &amp; Statements</span>
        </button>
      </div>

      {/* Header and Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {activeSubTab === 'roster' && 'Staff Directory & Profiles'}
            {activeSubTab === 'payments' && 'Salary Payouts & Payroll Register'}
            {activeSubTab === 'driver_advances' && 'Driver Route Advances & Expense Settlements'}
            {activeSubTab === 'ledger' && (selectedLedgerStaff ? `Staff Ledger: ${selectedLedgerStaff.name}` : 'Staff Payroll Statements')}
          </h2>
          <p className="text-sm text-slate-500">
            {activeSubTab === 'roster' && 'Manage employee files, CNIC documents, designations and basic salaries'}
            {activeSubTab === 'payments' && 'Disburse monthly salaries, deduct advances and ensure exact calculations without duplication'}
            {activeSubTab === 'driver_advances' && 'Issue trip advances, approve fuel/toll claims, record cash returns without double counting'}
            {activeSubTab === 'ledger' && 'Month-by-month earnings, advances taken, adjustments and running balances'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Plant 1 & Plant 2 Filters */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setPlantFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                plantFilter === 'all'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Plants ({staff.length})
            </button>
            <button
              type="button"
              onClick={() => { setPlantFilter('plant1'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                plantFilter === 'plant1'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Plant 1 ({staff.filter(s => (s.category && s.category.toLowerCase().includes('plant 1')) || (s.designation && s.designation.toLowerCase().includes('plant 1'))).length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setPlantFilter('plant2'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                plantFilter === 'plant2'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Plant 2 ({staff.filter(s => (s.category && s.category.toLowerCase().includes('plant 2')) || (s.designation && s.designation.toLowerCase().includes('plant 2'))).length})</span>
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search staff, CNIC, Plant 1, Plant 2..."
              className="w-full pl-8 pr-7 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-3" />
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 bg-slate-800 text-white px-3.5 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>

          {activeSubTab === 'roster' && (
            <button
              onClick={() => handleOpenStaffForm()}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Staff Profile</span>
            </button>
          )}

          {activeSubTab === 'payments' && (
            <button
              onClick={() => handleOpenPaymentForm()}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Process Salary / Advance / Loan</span>
            </button>
          )}

          {activeSubTab === 'driver_advances' && (
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setAdvAmount(0);
                  setIsDriverAdvFormOpen(true);
                }}
                className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Issue Driver Advance</span>
              </button>
              <button
                onClick={() => {
                  setExpClaimed(0);
                  setExpApproved(0);
                  setExpCashReturned(0);
                  setIsDriverExpenseFormOpen(true);
                }}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-sm"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Settle Route Expenses</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: STAFF ROSTER */}
      {activeSubTab === 'roster' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold">
                <tr>
                  <th className="px-5 py-3.5">Employee Name &amp; ID</th>
                  <th className="px-5 py-3.5">Category / Role</th>
                  <th className="px-5 py-3.5">Phone &amp; CNIC</th>
                  <th className="px-5 py-3.5">Salary Type &amp; Base</th>
                  <th className="px-5 py-3.5">Advance / Loan Balance</th>
                  <th className="px-5 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedStaff.map(st => {
                  const staffBal = balances?.staffBalances[st.id];
                  const advBal = staffBal?.advanceBalance !== undefined ? staffBal.advanceBalance : (staffBal?.advanceLoanBalance || 0);
                  const loanBal = staffBal?.loanBalance || 0;
                  const totalDue = staffBal?.advanceLoanBalance !== undefined ? staffBal.advanceLoanBalance : (advBal + loanBal);

                  const isPlant1 = (st.category && st.category.toLowerCase().includes('plant 1')) || (st.designation && st.designation.toLowerCase().includes('plant 1'));
                  const isPlant2 = (st.category && st.category.toLowerCase().includes('plant 2')) || (st.designation && st.designation.toLowerCase().includes('plant 2'));

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/75 transition">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{st.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{st.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            isPlant1
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : isPlant2
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {st.category || st.designation || 'Staff'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-700 font-medium">{st.phone || '—'}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
                          {st.cnic && <span>CNIC: {st.cnic}</span>}
                          {st.cnicDocUrl && (
                            <button
                              type="button"
                              onClick={() => setViewCnicModal({ staffName: st.name, cnic: st.cnic || '', url: st.cnicDocUrl || '' })}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition font-sans"
                            >
                              <ImageIcon className="h-3 w-3 text-indigo-600" />
                              View Photo
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-700">
                        Rs. {st.basicSalary.toLocaleString()} 
                        <span className="text-xs font-normal text-slate-400 block">{st.salaryType || 'Monthly'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1 min-w-[140px] text-xs">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-500 font-medium">Advance:</span>
                            <span className={`font-bold ${advBal > 0 ? 'text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200' : 'text-slate-400'}`}>
                              Rs. {advBal.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-500 font-medium">Loan:</span>
                            <span className={`font-bold ${loanBal > 0 ? 'text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200' : 'text-slate-400'}`}>
                              Rs. {loanBal.toLocaleString()}
                            </span>
                          </div>
                          {totalDue > 0 && (
                            <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-100 font-black text-rose-700">
                              <span>Total Due:</span>
                              <span>Rs. {totalDue.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap no-print">
                        {advBal > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentForm(undefined, 'advance_repayment', st.id)}
                            title="Clear Advance with Cash/Bank"
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-[11px] font-bold transition border border-amber-300"
                          >
                            Clear Adv
                          </button>
                        )}
                        {loanBal > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentForm(undefined, 'loan_repayment', st.id)}
                            title="Clear Loan with Cash/Bank"
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-md text-[11px] font-bold transition border border-indigo-300"
                          >
                            Clear Loan
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentForm(undefined, 'salary', st.id)}
                          title="Process Monthly Salary"
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md text-[11px] font-bold transition border border-emerald-300"
                        >
                          Salary
                        </button>
                        <button
                          onClick={() => handleOpenLedger(st)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition border border-slate-300"
                        >
                          Ledger
                        </button>
                        <button 
                          onClick={() => handleOpenStaffForm(st)} 
                          className="p-1.5 text-slate-400 hover:text-indigo-600 transition"
                        >
                          <Edit className="h-4 w-4 inline" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStaff(st.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash className="h-4 w-4 inline" />
                        </button>
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
            totalItems={filteredStaff.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* TAB 2: SALARIES & PAYMENTS */}
      {activeSubTab === 'payments' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold">
                <tr>
                  <th className="px-5 py-3.5">Date / ID</th>
                  <th className="px-5 py-3.5">Employee Name</th>
                  <th className="px-5 py-3.5">Payment Type</th>
                  <th className="px-5 py-3.5">Particulars / Description</th>
                  <th className="px-5 py-3.5 text-right">Gross Salary / Amount</th>
                  <th className="px-5 py-3.5 text-right">Adv &amp; Loan Adjusted</th>
                  <th className="px-5 py-3.5 text-right">Net Cash/Bank Flow</th>
                  <th className="px-5 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPayments.map(p => {
                  const emp = staff.find(s => s.id === p.staffId);
                  const isRepayment = p.type === 'advance_repayment' || p.type === 'loan_repayment';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/75 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 block">{p.id}</span>
                        <span className="text-xs text-slate-500">{p.date}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{emp?.name || p.staffId}</p>
                        <p className="text-xs text-slate-400">{emp?.category || emp?.designation || 'Staff'}</p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.type === 'salary'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : p.type === 'advance'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : p.type === 'loan'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : p.type === 'advance_repayment'
                            ? 'bg-teal-100 text-teal-800 border border-teal-300'
                            : p.type === 'loan_repayment'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}>
                          {p.type === 'salary' && 'Salary Payout'}
                          {p.type === 'advance' && 'Advance (Given)'}
                          {p.type === 'loan' && 'Loan (Given)'}
                          {p.type === 'advance_repayment' && 'Adv Repaid (Cash/Bank)'}
                          {p.type === 'loan_repayment' && 'Loan Repaid (Cash/Bank)'}
                          {p.type === 'settlement' && 'Settlement'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-slate-600">
                        {p.description}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                        Rs. {p.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs whitespace-nowrap space-y-0.5">
                        {p.advanceAdjusted ? (
                          <div className="text-amber-700 font-bold">Adv: -Rs. {p.advanceAdjusted.toLocaleString()}</div>
                        ) : null}
                        {p.loanAdjusted ? (
                          <div className="text-indigo-700 font-bold">Loan: -Rs. {p.loanAdjusted.toLocaleString()}</div>
                        ) : null}
                        {!p.advanceAdjusted && !p.loanAdjusted && <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black whitespace-nowrap">
                        {isRepayment ? (
                          <div>
                            <span className="text-emerald-700 font-black">+Rs. {p.amount.toLocaleString()}</span>
                            <span className="block text-[10px] text-teal-600 font-bold uppercase">Received (Debt Cleared)</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-900 font-black">Rs. {p.netPaid.toLocaleString()}</span>
                            <span className="block text-[10px] text-slate-400 uppercase font-medium">{p.paymentType} Out</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap no-print space-x-1">
                        <button
                          onClick={() => handleOpenPaymentForm(p)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 transition"
                          title="Edit Payment"
                        >
                          <Edit className="h-4 w-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                          title="Delete Payment"
                        >
                          <Trash className="h-4 w-4 inline" />
                        </button>
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
            totalItems={filteredPayments.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* TAB 3: DRIVER ADVANCES & ROUTE SETTLEMENTS */}
      {activeSubTab === 'driver_advances' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Advances Issued Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                  <Wallet className="h-4 w-4 text-amber-600" />
                  <span>Route Advances Issued (ڈرائیور پیشگی رقم)</span>
                </h3>
                <span className="text-xs font-bold text-amber-800">
                  Total: Rs. {driverAdvances.reduce((s, a) => s + (a.amount || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Date / ID</th>
                      <th className="px-3 py-2.5">Driver Name</th>
                      <th className="px-3 py-2.5">Purpose / Route</th>
                      <th className="px-3 py-2.5 text-right">Advance Amount</th>
                      <th className="px-3 py-2.5 text-right no-print">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {driverAdvances.map(adv => (
                      <tr key={adv.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-amber-700 block">{adv.id}</span>
                          <span className="text-slate-400">{adv.date}</span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                          {adv.driverName || staff.find(s => s.id === adv.driverId)?.name || adv.driverId}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{adv.purpose}</td>
                        <td className="px-3 py-2.5 text-right font-black text-amber-900 whitespace-nowrap">
                          Rs. {adv.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right no-print space-x-1">
                          <button
                            onClick={() => handleOpenDriverAdvForm(adv)}
                            className="p-1 text-slate-400 hover:text-indigo-600"
                            title="Edit Advance"
                          >
                            <Edit className="h-3.5 w-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleDeleteDriverAdvance(adv.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete Advance"
                          >
                            <Trash className="h-3.5 w-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expense Settlements Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>Expense Claims &amp; Settlements (خرچہ واؤچر)</span>
                </h3>
                <span className="text-xs font-bold text-emerald-800">
                  Approved: Rs. {driverExpenses.reduce((s, e) => s + (e.amountApproved || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Date / ID</th>
                      <th className="px-3 py-2.5">Driver</th>
                      <th className="px-3 py-2.5">Category &amp; Remarks</th>
                      <th className="px-3 py-2.5 text-right">Claimed</th>
                      <th className="px-3 py-2.5 text-right">Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {driverExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-emerald-700 block">{exp.id}</span>
                          <span className="text-slate-400">{exp.date}</span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                          {exp.driverName || staff.find(s => s.id === exp.driverId)?.name || exp.driverId}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-bold text-slate-700">{exp.category}: </span>
                          <span className="text-slate-500">{exp.description}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-600 whitespace-nowrap">
                          Rs. {exp.amountClaimed.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-emerald-700 whitespace-nowrap">
                          Rs. {exp.amountApproved.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STAFF LEDGER & STATEMENTS */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Select Staff Member:</span>
              <select
                value={activeLedgerStaffId}
                onChange={e => setActiveLedgerStaffId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
              >
                <option value="all">-- All Staff Members Overview --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.category || s.designation})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedLedgerStaff ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              {(() => {
                const bal = balances?.staffBalances[selectedLedgerStaff.id];
                const curAdv = bal?.advanceBalance !== undefined ? bal.advanceBalance : (bal?.advanceLoanBalance || 0);
                const curLoan = bal?.loanBalance || 0;
                const totalDebt = bal?.advanceLoanBalance !== undefined ? bal.advanceLoanBalance : (curAdv + curLoan);

                return (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-slate-900">{selectedLedgerStaff.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {selectedLedgerStaff.category || selectedLedgerStaff.designation}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        ID: <span className="font-mono font-bold text-slate-700">{selectedLedgerStaff.id}</span> • Base Salary: <span className="font-bold text-emerald-700">Rs. {selectedLedgerStaff.basicSalary.toLocaleString()}</span> / mo • Phone: {selectedLedgerStaff.phone || 'N/A'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg text-center">
                        <span className="text-[10px] uppercase font-bold text-amber-800 block">Advance Due</span>
                        <span className="text-sm font-black text-amber-900">Rs. {curAdv.toLocaleString()}</span>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg text-center">
                        <span className="text-[10px] uppercase font-bold text-indigo-800 block">Loan Due</span>
                        <span className="text-sm font-black text-indigo-900">Rs. {curLoan.toLocaleString()}</span>
                      </div>

                      <div className="bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg text-center">
                        <span className="text-[10px] uppercase font-bold text-rose-800 block">Total Due</span>
                        <span className="text-sm font-black text-rose-900">Rs. {totalDebt.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-1.5 no-print">
                        {curAdv > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentForm(undefined, 'advance_repayment', selectedLedgerStaff.id)}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                          >
                            Clear Adv (Cash)
                          </button>
                        )}
                        {curLoan > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentForm(undefined, 'loan_repayment', selectedLedgerStaff.id)}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                          >
                            Clear Loan (Cash)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentForm(undefined, 'salary', selectedLedgerStaff.id)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                        >
                          Pay Salary
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Date / ID</th>
                      <th className="px-3 py-2.5">Transaction Type</th>
                      <th className="px-3 py-2.5">Particulars / Description</th>
                      <th className="px-3 py-2.5 text-right">Adv/Loan Out (Debit)</th>
                      <th className="px-3 py-2.5 text-right">Repaid/Deducted (Credit)</th>
                      <th className="px-3 py-2.5 text-right">Net Cash Flow</th>
                      <th className="px-3 py-2.5 text-right">Running Total Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffEnrichedTransactions.map((tx, idx) => {
                      const isRepay = tx.type === 'advance_repayment' || tx.type === 'loan_repayment';
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-mono text-indigo-700 font-bold whitespace-nowrap">
                            {tx.date} <span className="text-[10px] text-slate-400 block">{tx.id}</span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              tx.type === 'salary'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.type === 'advance'
                                ? 'bg-amber-100 text-amber-800'
                                : tx.type === 'loan'
                                ? 'bg-indigo-100 text-indigo-800'
                                : isRepay
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {tx.type === 'salary' && 'Salary Payout'}
                              {tx.type === 'advance' && 'Advance Given'}
                              {tx.type === 'loan' && 'Loan Given'}
                              {tx.type === 'advance_repayment' && 'Adv Repaid (Cash/Bank)'}
                              {tx.type === 'loan_repayment' && 'Loan Repaid (Cash/Bank)'}
                              {tx.type === 'settlement' && 'Settlement'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-xs">{tx.description}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-amber-800 whitespace-nowrap">
                            {tx.totalGiven > 0 ? `Rs. ${tx.totalGiven.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                            {tx.totalRepaid > 0 ? `Rs. ${tx.totalRepaid.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black whitespace-nowrap">
                            {isRepay ? (
                              <span className="text-teal-700">+Rs. {tx.amount.toLocaleString()} In</span>
                            ) : (
                              <span className="text-slate-800">Rs. {tx.netPaid.toLocaleString()} Out</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-rose-900 bg-rose-50/30 whitespace-nowrap">
                            Rs. {tx.runningBal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Staff Member</th>
                      <th className="px-4 py-3">Category &amp; Plant</th>
                      <th className="px-4 py-3 text-right">Base Salary</th>
                      <th className="px-4 py-3 text-right">Advance Balance</th>
                      <th className="px-4 py-3 text-right">Loan Balance</th>
                      <th className="px-4 py-3 text-right">Total Due</th>
                      <th className="px-4 py-3 text-right no-print">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map(s => {
                      const staffBal = balances?.staffBalances[s.id];
                      const curAdv = staffBal?.advanceBalance !== undefined ? staffBal.advanceBalance : (staffBal?.advanceLoanBalance || 0);
                      const curLoan = staffBal?.loanBalance || 0;
                      const curTotal = staffBal?.advanceLoanBalance !== undefined ? staffBal.advanceLoanBalance : (curAdv + curLoan);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                            {s.name} <span className="font-mono text-slate-400 block text-[11px]">{s.id}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{s.category || s.designation}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">Rs. {s.basicSalary.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-amber-700">Rs. {curAdv.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-700">Rs. {curLoan.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-black text-rose-700">Rs. {curTotal.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right no-print space-x-1 whitespace-nowrap">
                            {curAdv > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentForm(undefined, 'advance_repayment', s.id)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[11px] font-bold border border-amber-300"
                              >
                                Clear Adv
                              </button>
                            )}
                            {curLoan > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentForm(undefined, 'loan_repayment', s.id)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded text-[11px] font-bold border border-indigo-300"
                              >
                                Clear Loan
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentForm(undefined, 'salary', s.id)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[11px] font-bold border border-emerald-300"
                            >
                              Salary
                            </button>
                            <button
                              onClick={() => handleOpenLedger(s)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold border border-indigo-200"
                            >
                              Statement ➔
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal for Staff Form */}
      {isStaffFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingStaffId ? `Edit Staff Profile (#${editingStaffId})` : 'Add New Staff / Driver Profile'}
              </h3>
              <button onClick={() => setIsStaffFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hafeez Khan"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category / Role *</label>
                  <input
                    type="text"
                    required
                    list="staff-categories-list"
                    placeholder="e.g. Driver, Caleender, Labour, Mechanic, Munshi..."
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                  />
                  <datalist id="staff-categories-list">
                    {defaultCategories.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="03xx-xxxxxxx"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CNIC Number</label>
                  <input
                    type="text"
                    placeholder="54400-xxxxxxx-x"
                    value={cnic}
                    onChange={e => setCnic(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>CNIC / Doc Photo</span>
                    {cnicDocUrl && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Photo Added
                      </span>
                    )}
                  </label>
                  
                  {cnicDocUrl ? (
                    <div className="flex items-center space-x-2 p-1.5 bg-slate-50 border border-slate-300 rounded-lg">
                      <img 
                        src={cnicDocUrl} 
                        alt="Preview" 
                        className="h-9 w-12 object-cover rounded border border-slate-200 bg-white" 
                      />
                      <div className="flex-1 flex items-center space-x-1.5">
                        <label 
                          htmlFor="cnic-file-input" 
                          className="cursor-pointer px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Upload className="h-3 w-3" />
                          Change
                        </label>
                        <button
                          type="button"
                          onClick={() => setCnicDocUrl('')}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Trash className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label 
                        htmlFor="cnic-file-input"
                        className={`w-full flex items-center justify-center space-x-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                          isUploadingImage 
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700' 
                            : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-600'
                        }`}
                      >
                        {isUploadingImage ? (
                          <>
                            <div className="animate-spin h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                            <span className="text-xs font-semibold">Processing...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="h-3.5 w-3.5 text-indigo-600" />
                            <span className="text-xs font-semibold">Upload Photo / CNIC</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}

                  <input
                    id="cnic-file-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageUpload(e.target.files[0]);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Base Salary (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={basicSalary === 0 ? '' : basicSalary}
                    onChange={e => setBasicSalary(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Salary Type</label>
                  <select
                    value={salaryType}
                    onChange={e => setSalaryType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Daily">Daily</option>
                    <option value="Trip-based">Trip-based</option>
                    <option value="Commission">Commission</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Driving License #</label>
                  <input
                    type="text"
                    placeholder="License #"
                    value={licenseNo}
                    onChange={e => setLicenseNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Employee address, hometown, references..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsStaffFormOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Salary & Payment Form */}
      {isPaymentFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingPaymentId ? `Edit Payment (#${editingPaymentId})` : 'Process Salary / Advance Payout'}
              </h3>
              <button onClick={() => setIsPaymentFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Type *</label>
                  <select
                    value={payType}
                    onChange={e => {
                      const newType = e.target.value as any;
                      setPayType(newType);
                      const s = staff.find(st => st.id === payStaffId);
                      const bal = balances?.staffBalances[payStaffId];
                      if (newType === 'salary') {
                        if (s) setPayAmount(s.basicSalary);
                        setPayAdvanceAdjusted(0);
                        setPayLoanAdjusted(0);
                      } else if (newType === 'advance_repayment') {
                        const curAdv = bal?.advanceBalance !== undefined ? bal.advanceBalance : (bal?.advanceLoanBalance || 0);
                        setPayAmount(curAdv > 0 ? curAdv : 0);
                        setPayAdvanceAdjusted(0);
                        setPayLoanAdjusted(0);
                      } else if (newType === 'loan_repayment') {
                        const curLoan = bal?.loanBalance || 0;
                        setPayAmount(curLoan > 0 ? curLoan : 0);
                        setPayAdvanceAdjusted(0);
                        setPayLoanAdjusted(0);
                      } else {
                        setPayAmount(0);
                        setPayAdvanceAdjusted(0);
                        setPayLoanAdjusted(0);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold text-slate-800"
                  >
                    <option value="salary">Monthly Salary Payout (with Deductions)</option>
                    <option value="advance">Give Staff Advance (Company Money Out)</option>
                    <option value="loan">Give Staff Loan (Company Money Out)</option>
                    <option value="advance_repayment">Receive Advance Repayment (Cash/Bank Received - Clears Advance)</option>
                    <option value="loan_repayment">Receive Loan Repayment (Cash/Bank Received - Clears Loan)</option>
                    <option value="settlement">Final Employee Settlement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Employee *</label>
                <SearchableSelect
                  options={staff.map(s => {
                    const sb = balances?.staffBalances[s.id];
                    const ca = sb?.advanceBalance !== undefined ? sb.advanceBalance : (sb?.advanceLoanBalance || 0);
                    const cl = sb?.loanBalance || 0;
                    return {
                      value: s.id,
                      label: `${s.name} (${s.category || s.designation || 'Staff'})`,
                      subLabel: `Base Salary: Rs. ${s.basicSalary.toLocaleString()} • Advance: Rs. ${ca.toLocaleString()} • Loan: Rs. ${cl.toLocaleString()}`,
                      searchTerms: `${s.name} ${s.phone || ''} ${s.category || ''} ${s.designation || ''}`
                    };
                  })}
                  value={payStaffId}
                  onChange={val => {
                    setPayStaffId(val);
                    const s = staff.find(st => st.id === val);
                    const bal = balances?.staffBalances[val];
                    if (s && payType === 'salary') setPayAmount(s.basicSalary);
                    if (payType === 'advance_repayment') {
                      const curAdv = bal?.advanceBalance !== undefined ? bal.advanceBalance : (bal?.advanceLoanBalance || 0);
                      setPayAmount(curAdv > 0 ? curAdv : 0);
                    }
                    if (payType === 'loan_repayment') {
                      const curLoan = bal?.loanBalance || 0;
                      setPayAmount(curLoan > 0 ? curLoan : 0);
                    }
                  }}
                  placeholder="-- Select Employee --"
                />
              </div>

              {payStaffId && (() => {
                const bal = balances?.staffBalances[payStaffId];
                const curAdv = bal?.advanceBalance !== undefined ? bal.advanceBalance : (bal?.advanceLoanBalance || 0);
                const curLoan = bal?.loanBalance || 0;
                const totalDebt = bal?.advanceLoanBalance !== undefined ? bal.advanceLoanBalance : (curAdv + curLoan);

                return (
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Advance</span>
                      <span className="font-bold text-amber-800">Rs. {curAdv.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Loan</span>
                      <span className="font-bold text-indigo-800">Rs. {curLoan.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Debt</span>
                      <span className="font-black text-rose-800">Rs. {totalDebt.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                {payType === 'advance_repayment' && (
                  <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-lg text-xs text-teal-800">
                    <p className="font-bold">Advance Repayment / Return:</p>
                    <p>Staff is paying back advance in Cash/Bank. This will <strong>reduce/clear their advance debt</strong> and <strong>increase company cash/bank</strong>.</p>
                  </div>
                )}

                {payType === 'loan_repayment' && (
                  <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-lg text-xs text-purple-800">
                    <p className="font-bold">Loan Repayment / Installment:</p>
                    <p>Staff is paying back loan in Cash/Bank. This will <strong>reduce/clear their loan debt</strong> and <strong>increase company cash/bank</strong>.</p>
                  </div>
                )}

                {payType === 'advance' && (
                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-800">
                    <p className="font-bold">Staff Advance Payout:</p>
                    <p>Giving advance to staff. This will <strong>increase their advance debt</strong> and <strong>pay out from company cash/bank</strong>.</p>
                  </div>
                )}

                {payType === 'loan' && (
                  <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg text-xs text-indigo-800">
                    <p className="font-bold">Staff Loan Payout:</p>
                    <p>Giving loan to staff. This will <strong>increase their loan debt</strong> and <strong>pay out from company cash/bank</strong>.</p>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      {payType === 'salary' ? 'Gross Salary (Rs.)' : (payType === 'advance_repayment' ? 'Repayment Amount (Rs.)' : (payType === 'loan_repayment' ? 'Loan Repayment Amount (Rs.)' : 'Amount (Rs.)'))} *
                    </label>
                    {payType === 'advance_repayment' && payStaffId && (() => {
                      const sb = balances?.staffBalances[payStaffId];
                      const curAdv = sb?.advanceBalance !== undefined ? sb.advanceBalance : (sb?.advanceLoanBalance || 0);
                      return curAdv > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPayAmount(curAdv)}
                          className="text-[11px] font-bold text-teal-700 hover:underline"
                        >
                          Clear Full Advance (Rs. {curAdv.toLocaleString()})
                        </button>
                      ) : null;
                    })()}
                    {payType === 'loan_repayment' && payStaffId && (() => {
                      const curLoan = balances?.staffBalances[payStaffId]?.loanBalance || 0;
                      return curLoan > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPayAmount(curLoan)}
                          className="text-[11px] font-bold text-purple-700 hover:underline"
                        >
                          Clear Full Loan (Rs. {curLoan.toLocaleString()})
                        </button>
                      ) : null;
                    })()}
                  </div>
                  <input
                    type="number"
                    min="1"
                    required
                    value={payAmount === 0 ? '' : payAmount}
                    onChange={e => setPayAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg text-base font-black text-indigo-900 bg-white"
                  />
                </div>

                {(payType === 'salary' || payType === 'settlement') && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-amber-800">Deduct Advance from Salary (Rs.)</span>
                        {(() => {
                          const curAdv = balances?.staffBalances[payStaffId]?.advanceBalance !== undefined ? balances.staffBalances[payStaffId].advanceBalance : (balances?.staffBalances[payStaffId]?.advanceLoanBalance || 0);
                          return (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Max: Rs. {curAdv.toLocaleString()}</span>
                              {curAdv > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPayAdvanceAdjusted(Math.min(payAmount, curAdv))}
                                  className="text-[11px] text-amber-700 hover:underline font-bold"
                                >
                                  Deduct All
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={payAdvanceAdjusted === 0 ? '' : payAdvanceAdjusted}
                        onChange={e => setPayAdvanceAdjusted(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs font-semibold bg-white"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-indigo-800">Deduct Loan from Salary (Rs.)</span>
                        {(() => {
                          const curLoan = balances?.staffBalances[payStaffId]?.loanBalance || 0;
                          return (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Max: Rs. {curLoan.toLocaleString()}</span>
                              {curLoan > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPayLoanAdjusted(Math.min(payAmount - payAdvanceAdjusted, curLoan))}
                                  className="text-[11px] text-indigo-700 hover:underline font-bold"
                                >
                                  Deduct All
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={payLoanAdjusted === 0 ? '' : payLoanAdjusted}
                        onChange={e => setPayLoanAdjusted(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs font-semibold bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t flex justify-between items-center text-sm">
                  <span className="font-black text-slate-900">
                    {(payType === 'advance_repayment' || payType === 'loan_repayment')
                      ? 'Cash/Bank Received (Inflow):'
                      : (payType === 'salary' || payType === 'settlement')
                      ? 'Net Cash/Bank Payout (Outflow):'
                      : 'Amount to Disburse (Outflow):'}
                  </span>
                  <span className={`text-lg font-black ${(payType === 'advance_repayment' || payType === 'loan_repayment') ? 'text-teal-700' : 'text-emerald-700'}`}>
                    Rs. {(() => {
                      if (payType === 'salary' || payType === 'settlement') {
                        return Math.max(0, payAmount - (payAdvanceAdjusted || 0) - (payLoanAdjusted || 0)).toLocaleString();
                      }
                      return (payAmount || 0).toLocaleString();
                    })()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>

                {payMethod === 'Bank' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bank Account</label>
                    <select
                      value={payBankId}
                      onChange={e => setPayBankId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.accountNumber})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Salary for Month of September 2026"
                  value={payDesc}
                  onChange={e => setPayDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPaymentFormOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                >
                  Save &amp; Disburse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Issue Driver Advance */}
      {isDriverAdvFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <Wallet className="h-5 w-5" />
                <span>Issue Driver Route Advance (پیشگی رقم)</span>
              </h3>
              <button onClick={() => setIsDriverAdvFormOpen(false)} className="text-amber-200 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriverAdvance} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={advDate}
                    onChange={e => setAdvDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Driver *</label>
                  <select
                    value={advDriverId}
                    onChange={e => setAdvDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value="">-- Choose Driver --</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.category || s.designation})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vehicle (Optional)</label>
                  <select
                    value={advVehicleId}
                    onChange={e => setAdvVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">-- None --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Advance Amount (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Rs."
                    value={advAmount === 0 ? '' : advAmount}
                    onChange={e => setAdvAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-sm font-black text-amber-950 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Purpose / Route</label>
                <input
                  type="text"
                  placeholder="e.g. Fuel, Toll Tax & Food for Karachi-Winder trip"
                  value={advPurpose}
                  onChange={e => setAdvPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsDriverAdvFormOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                >
                  Issue Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Driver Expense Settlement */}
      {isDriverExpenseFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-emerald-700 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <span>Settle Driver Route Expenses (خرچہ واؤچر تصدیق)</span>
              </h3>
              <button onClick={() => setIsDriverExpenseFormOpen(false)} className="text-emerald-200 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriverExpense} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Driver *</label>
                  <select
                    value={expDriverId}
                    onChange={e => setExpDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value="">-- Choose Driver --</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expense Category</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                  >
                    <option value="Diesel">Diesel / Fuel</option>
                    <option value="Toll Tax">Toll Tax / Parchi</option>
                    <option value="Kanta">Kanta / Weighbridge</option>
                    <option value="Food">Food / Roti</option>
                    <option value="Mistri / Repair">Mistri / Puncture</option>
                    <option value="Other">Other Route Expense</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Claimed Amount (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Rs."
                    value={expClaimed === 0 ? '' : expClaimed}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setExpClaimed(val);
                      setExpApproved(val);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                <div>
                  <label className="block text-xs font-bold text-emerald-950 uppercase mb-1">Approved Amount (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={expApproved === 0 ? '' : expApproved}
                    onChange={e => setExpApproved(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg text-xs font-black text-emerald-950 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 uppercase mb-1">Cash Returned by Driver</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={expCashReturned === 0 ? '' : expCashReturned}
                    onChange={e => setExpCashReturned(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg text-xs font-black text-emerald-950 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Remarks / Route Notes</label>
                <input
                  type="text"
                  placeholder="e.g. 5 Toll Receipts + Puncture Bill"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsDriverExpenseFormOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Approve &amp; Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Viewing CNIC Document */}
      {viewCnicModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-bold text-slate-900 text-sm">
                CNIC Document: {viewCnicModal.staffName} ({viewCnicModal.cnic})
              </h4>
              <button onClick={() => setViewCnicModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center p-3 bg-slate-900/5 rounded-xl overflow-hidden min-h-[220px] items-center border border-slate-200">
              {viewCnicModal.url.startsWith('http') || viewCnicModal.url.startsWith('data:') ? (
                <img src={viewCnicModal.url} alt="CNIC Document" className="max-h-[420px] w-full object-contain rounded-lg shadow-sm" />
              ) : (
                <p className="text-xs text-slate-600 font-mono break-all">{viewCnicModal.url}</p>
              )}
            </div>
            <div className="flex justify-between items-center pt-1">
              {(viewCnicModal.url.startsWith('http') || viewCnicModal.url.startsWith('data:')) && (
                <a
                  href={viewCnicModal.url}
                  download={`${viewCnicModal.staffName.replace(/\s+/g, '_')}_CNIC.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition border border-indigo-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download / Save
                </a>
              )}
              <button
                onClick={() => setViewCnicModal(null)}
                className="ml-auto px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
