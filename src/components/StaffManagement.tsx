import React, { useEffect, useState, useMemo } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBStaff, DBStaffPayment, DBBank, DBVoucher } from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveStaffPaymentTransaction, deleteStaffPaymentTransaction, migrateLegacyStaffAndPayments } from '../db/transactions';
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
  UserCheck
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

export default function StaffManagement() {
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'payments' | 'ledger'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Ledger Specific States
  const [activeLedgerStaffId, setActiveLedgerStaffId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');

  // Data States
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [payments, setPayments] = useState<DBStaffPayment[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  // Form States
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // Staff Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [basicSalary, setBasicSalary] = useState(0);

  // Payment Form fields
  const [payStaffId, setPayStaffId] = useState('');
  const [payType, setPayType] = useState<'salary' | 'advance' | 'loan' | 'settlement'>('salary');
  const [payAmount, setPayAmount] = useState(0); // For salary, this is gross salary
  const [payAdvanceAdjusted, setPayAdvanceAdjusted] = useState(0);
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [payBankId, setPayBankId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDesc, setPayDesc] = useState('');

  const loadData = async () => {
    try {
      await migrateLegacyStaffAndPayments();

      const allStaff = await getAllRecords<DBStaff>('staff');
      setStaff(allStaff);
      if (allStaff.length > 0 && !payStaffId) {
        setPayStaffId(allStaff[0].id);
      }

      const allPayments = await getAllRecords<DBStaffPayment>('staff_payments');
      allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(allPayments);

      const allBanks = await getAllRecords<DBBank>('banks');
      setBanks(allBanks);
      if (allBanks.length > 0 && !payBankId) {
        setPayBankId(allBanks[0].id);
      }

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

  const handleOpenStaffForm = (st?: DBStaff) => {
    if (st) {
      setEditingStaffId(st.id);
      setName(st.name);
      setPhone(st.phone);
      setDesignation(st.designation);
      setBasicSalary(st.basicSalary);
    } else {
      setEditingStaffId(null);
      setName('');
      setPhone('');
      setDesignation('');
      setBasicSalary(0);
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
      const nextNum = maxNum + 1;
      stId = `staf-${String(nextNum).padStart(3, '0')}`;
    }

    const savedStaff: DBStaff = {
      id: stId,
      name,
      phone,
      designation,
      basicSalary: Number(basicSalary),
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

  const handleOpenPaymentForm = (pmt?: DBStaffPayment) => {
    if (pmt) {
      setEditingPaymentId(pmt.id);
      setPayStaffId(pmt.staffId);
      setPayType(pmt.type);
      setPayAmount(pmt.amount);
      setPayAdvanceAdjusted(pmt.advanceAdjusted || 0);
      setPayMethod(pmt.paymentType);
      setPayBankId(pmt.bankId || (banks.length > 0 ? banks[0].id : ''));
      setPayDate(pmt.date);
      setPayDesc(pmt.description);
    } else {
      setEditingPaymentId(null);
      setPayType('salary');
      const targetId = activeLedgerStaffId !== 'all' ? activeLedgerStaffId : (staff.length > 0 ? staff[0].id : '');
      setPayStaffId(targetId);
      const foundStaff = staff.find(s => s.id === targetId);
      setPayAmount(foundStaff ? foundStaff.basicSalary : 0);
      setPayAdvanceAdjusted(0);
      setPayMethod('Cash');
      setPayDate(new Date().toISOString().split('T')[0]);
      setPayDesc('');
      if (banks.length > 0 && !payBankId) setPayBankId(banks[0].id);
    }
    setIsPaymentFormOpen(true);
  };

  const handleQuickPay = (st: DBStaff) => {
    setEditingPaymentId(null);
    setPayStaffId(st.id);
    setPayType('salary');
    setPayAmount(st.basicSalary);
    setPayAdvanceAdjusted(0);
    setPayMethod('Cash');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayDesc(`Salary for ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`);
    if (banks.length > 0 && !payBankId) setPayBankId(banks[0].id);
    setIsPaymentFormOpen(true);
  };

  const handleOpenLedger = (st: DBStaff) => {
    setActiveLedgerStaffId(st.id);
    setActiveSubTab('ledger');
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payStaffId || payAmount <= 0) {
      alert('Please select an employee and specify a valid amount.');
      return;
    }

    const netPaid = payType === 'salary' || payType === 'settlement' 
      ? payAmount - payAdvanceAdjusted 
      : payAmount;

    let payId = editingPaymentId;
    if (!payId) {
      let maxNum = 0;
      const prefix = 'pay-';
      for (const p of payments) {
        if (p.id && p.id.startsWith(prefix)) {
          const numPart = parseInt(p.id.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
      const allVch = await getAllRecords<DBVoucher>('vouchers');
      for (const v of allVch) {
        if (v.id && v.id.startsWith(prefix)) {
          const numPart = parseInt(v.id.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
      const nextNum = maxNum + 1;
      payId = `${prefix}${String(nextNum).padStart(3, '0')}`;
    }

    const payment: DBStaffPayment = {
      id: payId,
      date: payDate,
      staffId: payStaffId,
      type: payType,
      amount: Number(payAmount), // gross
      advanceAdjusted: Number(payAdvanceAdjusted),
      netPaid: Number(netPaid),
      paymentType: payMethod,
      bankId: payMethod === 'Bank' ? payBankId : undefined,
      description: payDesc,
    };

    await saveStaffPaymentTransaction(payment);
    setIsPaymentFormOpen(false);
    loadData();
  };

  const handleDeletePayment = async (id: string) => {
    if (confirm('Are you sure you want to delete this payment log? This reverses all financial ledger changes.')) {
      await deleteStaffPaymentTransaction(id);
      loadData();
    }
  };

  // Prepopulate salary on selector change
  const handleStaffSelect = (id: string) => {
    setPayStaffId(id);
    const selected = staff.find(s => s.id === id);
    if (selected && payType === 'salary') {
      setPayAmount(selected.basicSalary);
    }
  };

  const netPaidPreview = payType === 'salary' || payType === 'settlement' 
    ? payAmount - payAdvanceAdjusted 
    : payAmount;

  const cleanSearch = searchQuery.toLowerCase().trim();
  
  const filteredStaff = staff.filter(s => {
    if (!cleanSearch) return true;
    return (
      s.name.toLowerCase().includes(cleanSearch) ||
      s.phone.includes(cleanSearch) ||
      s.designation.toLowerCase().includes(cleanSearch) ||
      s.id.toLowerCase().includes(cleanSearch)
    );
  });

  const filteredPayments = payments.filter(p => {
    if (!cleanSearch) return true;
    const stMember = staff.find(s => s.id === p.staffId);
    return (
      p.id.toLowerCase().includes(cleanSearch) ||
      p.date.includes(cleanSearch) ||
      p.type.toLowerCase().includes(cleanSearch) ||
      p.paymentType.toLowerCase().includes(cleanSearch) ||
      (p.description && p.description.toLowerCase().includes(cleanSearch)) ||
      (stMember && stMember.name.toLowerCase().includes(cleanSearch))
    );
  });

  // Month list constants and helpers
  const ALL_MONTHS = useMemo(() => [
    { value: 'all', name: '📅 All 12 Months' },
    { value: '01', name: 'January' },
    { value: '02', name: 'February' },
    { value: '03', name: 'March' },
    { value: '04', name: 'April' },
    { value: '05', name: 'May' },
    { value: '06', name: 'June' },
    { value: '07', name: 'July' },
    { value: '08', name: 'August' },
    { value: '09', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ], []);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearSet = new Set<string>([String(currentYear), String(currentYear - 1), String(currentYear + 1)]);
    payments.forEach(p => {
      if (p.date && p.date.length >= 4) {
        const y = p.date.substring(0, 4);
        yearSet.add(y);
      }
    });
    return Array.from(yearSet).sort().reverse();
  }, [payments]);

  const formatMonthName = (mStr: string) => {
    if (!mStr || mStr === 'all') return 'All Months';
    try {
      const [year, month] = mStr.split('-').map(Number);
      if (!year || !month) return mStr;
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return mStr;
    }
  };

  const getFilterPeriodLabel = () => {
    if (selectedMonth === 'all' && selectedYear === 'all') {
      return 'All Months & Years';
    }
    if (selectedMonth === 'all' && selectedYear !== 'all') {
      return `Full Year ${selectedYear}`;
    }
    const mObj = ALL_MONTHS.find(m => m.value === selectedMonth);
    const mName = mObj ? mObj.name : selectedMonth;
    if (selectedYear !== 'all') {
      return `${mName} ${selectedYear}`;
    }
    return `${mName} (All Years)`;
  };

  const handleYearFilterChange = (yr: string) => {
    setSelectedYear(yr);
    if (yr === 'all') {
      setLedgerStartDate('');
      setLedgerEndDate('');
    } else {
      if (selectedMonth === 'all') {
        setLedgerStartDate(`${yr}-01-01`);
        setLedgerEndDate(`${yr}-12-31`);
      } else {
        const y = Number(yr);
        const m = Number(selectedMonth);
        const lastDay = new Date(y, m, 0).getDate();
        setLedgerStartDate(`${yr}-${selectedMonth}-01`);
        setLedgerEndDate(`${yr}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`);
      }
    }
  };

  const handleMonthFilterChange = (mVal: string) => {
    setSelectedMonth(mVal);
    if (mVal === 'all') {
      if (selectedYear === 'all') {
        setLedgerStartDate('');
        setLedgerEndDate('');
      } else {
        setLedgerStartDate(`${selectedYear}-01-01`);
        setLedgerEndDate(`${selectedYear}-12-31`);
      }
    } else {
      if (selectedYear !== 'all') {
        const y = Number(selectedYear);
        const m = Number(mVal);
        const lastDay = new Date(y, m, 0).getDate();
        setLedgerStartDate(`${selectedYear}-${mVal}-01`);
        setLedgerEndDate(`${selectedYear}-${mVal}-${String(lastDay).padStart(2, '0')}`);
      } else {
        setLedgerStartDate('');
        setLedgerEndDate('');
      }
    }
  };

  const matchesMonthAndYear = (dateStr: string) => {
    if (!dateStr) return false;
    if (selectedYear !== 'all' && !dateStr.startsWith(selectedYear)) {
      return false;
    }
    if (selectedMonth !== 'all') {
      const mPart = dateStr.substring(5, 7);
      if (mPart !== selectedMonth) return false;
    }
    return true;
  };

  // Selected individual staff
  const selectedLedgerStaff = useMemo(() => {
    if (activeLedgerStaffId === 'all') return null;
    return staff.find(s => s.id === activeLedgerStaffId) || null;
  }, [staff, activeLedgerStaffId]);

  // Chronological enriched transactions for selected staff
  const staffEnrichedTransactions = useMemo(() => {
    if (!selectedLedgerStaff) return [];
    // Get all transactions for this staff sorted ascending by date
    const list = payments.filter(p => p.staffId === selectedLedgerStaff.id);
    const sortedAsc = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBal = 0;
    return sortedAsc.map(p => {
      const advanceGiven = (p.type === 'advance' || p.type === 'loan') ? p.amount : 0;
      const advanceDeducted = (p.type === 'salary' || p.type === 'settlement') ? (p.advanceAdjusted || 0) : 0;
      runningBal += (advanceGiven - advanceDeducted);
      return {
        ...p,
        advanceGiven,
        advanceDeducted,
        runningBalance: runningBal,
      };
    });
  }, [selectedLedgerStaff, payments]);

  // Filtered detailed transactions based on UI controls
  const filteredLedgerTransactions = useMemo(() => {
    return staffEnrichedTransactions.filter(tx => {
      if (!matchesMonthAndYear(tx.date)) return false;
      if (ledgerStartDate && tx.date < ledgerStartDate) return false;
      if (ledgerEndDate && tx.date > ledgerEndDate) return false;
      if (cleanSearch) {
        const match = 
          tx.id.toLowerCase().includes(cleanSearch) ||
          tx.date.includes(cleanSearch) ||
          tx.type.toLowerCase().includes(cleanSearch) ||
          tx.paymentType.toLowerCase().includes(cleanSearch) ||
          (tx.description && tx.description.toLowerCase().includes(cleanSearch));
        if (!match) return false;
      }
      return true;
    });
  }, [staffEnrichedTransactions, selectedYear, selectedMonth, ledgerStartDate, ledgerEndDate, cleanSearch]);

  // Month-by-month summary statement for selected staff
  const staffMonthSummaries = useMemo(() => {
    if (!selectedLedgerStaff) return [];
    
    // Group all enriched transactions by month
    const groupMap = new Map<string, typeof staffEnrichedTransactions>();
    staffEnrichedTransactions.forEach(tx => {
      const m = tx.date.substring(0, 7);
      if (!groupMap.has(m)) groupMap.set(m, []);
      groupMap.get(m)!.push(tx);
    });

    const months = Array.from(groupMap.keys()).sort().reverse();
    return months.map(m => {
      const txs = groupMap.get(m) || [];
      const grossSalary = txs.filter(t => t.type === 'salary' || t.type === 'settlement').reduce((sum, t) => sum + t.amount, 0);
      const advanceTaken = txs.reduce((sum, t) => sum + t.advanceGiven, 0);
      const advanceDeducted = txs.reduce((sum, t) => sum + t.advanceDeducted, 0);
      const netPaid = txs.reduce((sum, t) => sum + t.netPaid, 0);
      const monthEndBalance = txs[txs.length - 1]?.runningBalance || 0;

      let status = 'Active';
      if (grossSalary > 0 && advanceDeducted > 0) {
        status = 'Salary Paid (Adv Deducted)';
      } else if (grossSalary > 0) {
        status = 'Salary Paid';
      } else if (advanceTaken > 0) {
        status = 'Advance / Loan Taken';
      }

      return {
        month: m,
        monthName: formatMonthName(m),
        grossSalary,
        advanceTaken,
        advanceDeducted,
        netPaid,
        monthEndBalance,
        status,
        txCount: txs.length
      };
    });
  }, [selectedLedgerStaff, staffEnrichedTransactions]);

  // All Staff Overview for selected month / date range
  const allStaffMonthlyRegister = useMemo(() => {
    return staff.map(st => {
      const empPayments = payments.filter(p => {
        if (p.staffId !== st.id) return false;
        if (!matchesMonthAndYear(p.date)) return false;
        if (ledgerStartDate && p.date < ledgerStartDate) return false;
        if (ledgerEndDate && p.date > ledgerEndDate) return false;
        return true;
      });

      const grossSalary = empPayments.filter(p => p.type === 'salary' || p.type === 'settlement').reduce((sum, p) => sum + p.amount, 0);
      const advanceTaken = empPayments.filter(p => p.type === 'advance' || p.type === 'loan').reduce((sum, p) => sum + p.amount, 0);
      const advanceDeducted = empPayments.reduce((sum, p) => sum + (p.advanceAdjusted || 0), 0);
      const netPaid = empPayments.reduce((sum, p) => sum + p.netPaid, 0);
      const currentBalance = balances?.staffBalances[st.id]?.advanceLoanBalance || 0;

      return {
        staff: st,
        grossSalary,
        advanceTaken,
        advanceDeducted,
        netPaid,
        currentBalance,
        txCount: empPayments.length,
      };
    });
  }, [staff, payments, selectedYear, selectedMonth, ledgerStartDate, ledgerEndDate, balances]);

  if (loading) {
    return <div className="text-center py-6 text-slate-500">Loading staff records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-slate-200 no-print">
        <button
          onClick={() => { setActiveSubTab('roster'); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeSubTab === 'roster' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Staff Profiles & Roster</span>
        </button>
        <button
          onClick={() => { setActiveSubTab('payments'); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeSubTab === 'payments' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>Salaries, Advances & Loans</span>
        </button>
        <button
          onClick={() => { setActiveSubTab('ledger'); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeSubTab === 'ledger' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Staff Ledger & Statements</span>
        </button>
      </div>

      {/* Top Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {activeSubTab === 'roster' && 'Staff Directory'}
            {activeSubTab === 'payments' && 'Salary Payouts & Loans Register'}
            {activeSubTab === 'ledger' && (selectedLedgerStaff ? `Staff Ledger: ${selectedLedgerStaff.name}` : 'Staff Payroll & Advance Statements')}
          </h2>
          <p className="text-sm text-slate-500">
            {activeSubTab === 'roster' && 'Manage employee files, base salaries, and profiles'}
            {activeSubTab === 'payments' && 'Disburse salaries, manage advances, and track outstanding staff loans'}
            {activeSubTab === 'ledger' && (selectedLedgerStaff ? 'Complete month-by-month earnings, advances taken, deductions, and running balances' : 'Month-wise staff salaries, advances, deductions, and running balances')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search staff, salary records..."
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
            className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Print Ledger</span>
          </button>

          {activeSubTab === 'roster' ? (
            <button
              onClick={() => handleOpenStaffForm()}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Staff Member</span>
            </button>
          ) : (
            <button
              onClick={() => handleOpenPaymentForm()}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Process Salary / Advance</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STAFF ROSTER & PROFILES */}
      {/* ========================================================================= */}
      {activeSubTab === 'roster' && (
        <div className="print-a4 print-container space-y-4">
          <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
            <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
              EMPLOYEE & STAFF ROSTER DIRECTORY
            </p>
            <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
              <div>Total Staff: {staff.length}</div>
              <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Employee Name</th>
                    <th className="px-6 py-3.5">Phone</th>
                    <th className="px-6 py-3.5">Designation</th>
                    <th className="px-6 py-3.5">Base Salary</th>
                    <th className="px-6 py-3.5">Outstanding Advance/Loan</th>
                    <th className="px-6 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStaff.map(st => {
                    const loanBal = balances?.staffBalances[st.id]?.advanceLoanBalance || 0;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/75 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{st.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{st.id}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{st.phone || '—'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {st.designation || 'Staff'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700">
                          Rs. {st.basicSalary.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ mo</span>
                        </td>
                        <td className="px-6 py-4">
                          {loanBal > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Rs. {loanBal.toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-500">
                              No Balance
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap no-print">
                          <button
                            onClick={() => handleOpenLedger(st)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-semibold transition border border-indigo-200"
                            title="Open employee month-wise ledger"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            <span>Ledger</span>
                          </button>
                          <button
                            onClick={() => handleQuickPay(st)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold transition border border-emerald-200"
                            title="Process salary or advance"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>Pay</span>
                          </button>
                          <button 
                            onClick={() => handleOpenStaffForm(st)} 
                            className="p-1 text-slate-400 hover:text-indigo-600 transition" 
                            title="Edit profile"
                          >
                            <Edit className="h-4 w-4 inline" />
                          </button>
                          <button 
                            onClick={() => handleDeleteStaff(st.id)} 
                            className="p-1 text-slate-400 hover:text-rose-600 transition" 
                            title="Delete staff"
                          >
                            <Trash className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        {searchQuery ? `No matching staff members found for "${searchQuery}".` : 'No staff members registered.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredStaff.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="px-6 py-3 font-black">Staff Roster Totals ({filteredStaff.length} Active Staff):</td>
                      <td className="px-6 py-3 font-black text-emerald-300">
                        Rs. {filteredStaff.reduce((sum, s) => sum + s.basicSalary, 0).toLocaleString()} / mo
                      </td>
                      <td className="px-6 py-3 font-black text-amber-300">
                        Rs. {filteredStaff.reduce((sum, s) => sum + (balances?.staffBalances[s.id]?.advanceLoanBalance || 0), 0).toLocaleString()}
                      </td>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALARIES, ADVANCES & DISBURSEMENTS REGISTER */}
      {/* ========================================================================= */}
      {activeSubTab === 'payments' && (
        <div className="print-a4 print-container space-y-4">
          <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
            <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
              STAFF SALARIES & ADVANCES DISBURSEMENT REGISTER
            </p>
            <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
              <div>Total Records: {payments.length}</div>
              <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Gross Amt</th>
                    <th className="px-6 py-3.5">Advance Deducted</th>
                    <th className="px-6 py-3.5">Net Cash Paid</th>
                    <th className="px-6 py-3.5">Channel</th>
                    <th className="px-6 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredPayments.map(pmt => {
                    const stMember = staff.find(s => s.id === pmt.staffId);

                    return (
                      <tr key={pmt.id} className="hover:bg-slate-50/75 transition">
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{pmt.date}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{stMember?.name || pmt.staffId}</div>
                          <div className="text-[11px] font-mono text-indigo-600 font-semibold">{pmt.id}</div>
                          {pmt.description && (
                            <div className="text-[11px] text-slate-400 font-normal italic">{pmt.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            pmt.type === 'salary' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            pmt.type === 'advance' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            pmt.type === 'loan' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}>
                            {pmt.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700">Rs. {pmt.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-amber-600 font-medium">
                          {pmt.advanceAdjusted ? `Rs. ${pmt.advanceAdjusted.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-6 py-4 font-black text-emerald-600">Rs. {pmt.netPaid.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-600 font-medium text-xs">
                          {pmt.paymentType} {pmt.bankId ? `(${banks.find(b => b.id === pmt.bankId)?.name || 'Bank'})` : ''}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap no-print">
                          <button onClick={() => handleOpenPaymentForm(pmt)} className="text-slate-400 hover:text-indigo-600 transition">
                            <Edit className="h-4 w-4 inline" />
                          </button>
                          <button onClick={() => handleDeletePayment(pmt.id)} className="text-slate-400 hover:text-rose-600 transition">
                            <Trash className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        {searchQuery ? `No matching disbursements found for "${searchQuery}".` : 'No salary or loan disbursements recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredPayments.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="px-6 py-3 font-black">Disbursements Totals ({filteredPayments.length} Transactions):</td>
                      <td className="px-6 py-3 font-black text-rose-300">
                        Rs. {filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 font-black text-amber-300">
                        Rs. {filteredPayments.reduce((sum, p) => sum + (p.advanceAdjusted || 0), 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 font-black text-emerald-300">
                        Rs. {filteredPayments.reduce((sum, p) => sum + p.netPaid, 0).toLocaleString()}
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
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STAFF LEDGER & STATEMENTS (MONTH-WISE & CHRONOLOGICAL) */}
      {/* ========================================================================= */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-6">
          {/* Ledger Control & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Staff Member Selector */}
                <div className="min-w-[240px]">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Staff Member
                  </label>
                  <select
                    value={activeLedgerStaffId}
                    onChange={e => setActiveLedgerStaffId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">👥 All Staff Members (Payroll Register)</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.designation || 'Staff'}) — Base: Rs. {s.basicSalary.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month Filter */}
                <div className="min-w-[170px]">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Month Filter
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={e => handleMonthFilterChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    {ALL_MONTHS.map(m => (
                      <option key={m.value} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year Filter */}
                <div className="min-w-[120px]">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={e => handleYearFilterChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>
                        {yr} {yr === String(new Date().getFullYear()) ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range Start */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={ledgerStartDate}
                    onChange={e => { setLedgerStartDate(e.target.value); }}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Date Range End */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={ledgerEndDate}
                    onChange={e => { setLedgerEndDate(e.target.value); }}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Reset Filters */}
              {(selectedMonth !== 'all' || selectedYear !== 'all' || ledgerStartDate || ledgerEndDate || activeLedgerStaffId !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedYear(String(new Date().getFullYear()));
                    setSelectedMonth('all');
                    setLedgerStartDate('');
                    setLedgerEndDate('');
                    setActiveLedgerStaffId('all');
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          </div>

          {/* PRINTABLE A4 WRAPPER */}
          <div className="print-a4 print-container space-y-6">
            {/* Print Header */}
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
              <p className="text-sm font-bold text-slate-600 tracking-wider uppercase mt-1">
                {selectedLedgerStaff 
                  ? `INDIVIDUAL EMPLOYEE SALARY & ADVANCE STATEMENT` 
                  : `MONTHLY STAFF PAYROLL & ADVANCES REGISTER (${getFilterPeriodLabel()})`}
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>
                  {selectedLedgerStaff ? `Employee: ${selectedLedgerStaff.name} (${selectedLedgerStaff.id})` : `Total Employees: ${staff.length}`}
                </div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB')}</div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* VIEW A: INDIVIDUAL STAFF MEMBER SELECTED */}
            {/* ============================================================= */}
            {selectedLedgerStaff ? (
              <div className="space-y-6">
                {/* Employee Profile & Lifetime KPI Cards */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-indigo-100">
                        {selectedLedgerStaff.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-black text-slate-800">{selectedLedgerStaff.name}</h3>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {selectedLedgerStaff.designation || 'Staff'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Phone: <span className="font-semibold text-slate-700">{selectedLedgerStaff.phone || 'N/A'}</span> • ID: <span className="font-mono text-slate-400">{selectedLedgerStaff.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 no-print">
                      <button
                        onClick={() => handleQuickPay(selectedLedgerStaff)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        <span>Process Payment</span>
                      </button>
                      <button
                        onClick={() => setActiveLedgerStaffId('all')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                      >
                        ← Back to All Staff
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Salary</div>
                      <div className="text-base font-black text-slate-800 mt-0.5">
                        Rs. {selectedLedgerStaff.basicSalary.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">per month</div>
                    </div>

                    <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                      <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Gross Processed</div>
                      <div className="text-base font-black text-indigo-700 mt-0.5">
                        Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.grossSalary, 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-indigo-400">Lifetime Gross</div>
                    </div>

                    <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                      <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Advance Taken</div>
                      <div className="text-base font-black text-amber-700 mt-0.5">
                        Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.advanceTaken, 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-amber-500">Loans & Advances</div>
                    </div>

                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Advance Deducted</div>
                      <div className="text-base font-black text-blue-700 mt-0.5">
                        Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.advanceDeducted, 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-blue-400">Adjusted in Salary</div>
                    </div>

                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Net Cash Paid</div>
                      <div className="text-base font-black text-emerald-700 mt-0.5">
                        Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.netPaid, 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-500">Take-Home Cash</div>
                    </div>

                    <div className={`p-3 rounded-lg border ${
                      (balances?.staffBalances[selectedLedgerStaff.id]?.advanceLoanBalance || 0) > 0
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Current Advance Bal</div>
                      <div className="text-base font-black mt-0.5">
                        Rs. {(balances?.staffBalances[selectedLedgerStaff.id]?.advanceLoanBalance || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-medium">
                        {(balances?.staffBalances[selectedLedgerStaff.id]?.advanceLoanBalance || 0) > 0 ? 'Pending Recovery' : 'Settled / Clear'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 1: MONTH-WISE SUMMARY BREAKDOWN TABLE */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-indigo-600" />
                        <span>Month-by-Month Statement Summary</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Aggregated monthly salaries, advances drawn, salary adjustments, and month-end loan balances
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {staffMonthSummaries.length} Months Active
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                      <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-3">Month</th>
                          <th className="px-6 py-3">Base Salary</th>
                          <th className="px-6 py-3">Gross Salary Paid</th>
                          <th className="px-6 py-3">Advance / Loan Taken</th>
                          <th className="px-6 py-3">Advance Deducted</th>
                          <th className="px-6 py-3">Net Cash Paid</th>
                          <th className="px-6 py-3">Month-End Loan Balance</th>
                          <th className="px-6 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {staffMonthSummaries.map(mRow => (
                          <tr key={mRow.month} className="hover:bg-slate-50/75 transition">
                            <td className="px-6 py-3.5 font-bold text-slate-800 flex items-center space-x-2">
                              <span>{mRow.monthName}</span>
                              <span className="text-[10px] font-mono text-slate-400">({mRow.month})</span>
                            </td>
                            <td className="px-6 py-3.5 text-slate-600 font-medium">
                              Rs. {selectedLedgerStaff.basicSalary.toLocaleString()}
                            </td>
                            <td className="px-6 py-3.5 font-bold text-indigo-700">
                              {mRow.grossSalary > 0 ? `Rs. ${mRow.grossSalary.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-6 py-3.5 font-bold text-amber-600">
                              {mRow.advanceTaken > 0 ? `Rs. ${mRow.advanceTaken.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-6 py-3.5 font-bold text-blue-600">
                              {mRow.advanceDeducted > 0 ? `Rs. ${mRow.advanceDeducted.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-6 py-3.5 font-black text-emerald-600">
                              Rs. {mRow.netPaid.toLocaleString()}
                            </td>
                            <td className="px-6 py-3.5 font-bold text-slate-800">
                              {mRow.monthEndBalance > 0 ? (
                                <span className="text-amber-600">Rs. {mRow.monthEndBalance.toLocaleString()}</span>
                              ) : (
                                <span className="text-slate-400">Rs. 0</span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                mRow.status.includes('Salary Paid') 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {mRow.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {staffMonthSummaries.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-slate-400">
                              No monthly payout records found for this employee.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {staffMonthSummaries.length > 0 && (
                        <tfoot className="bg-slate-900 text-white font-bold text-xs">
                          <tr>
                            <td colSpan={2} className="px-6 py-3 font-black">Statement Summary Totals:</td>
                            <td className="px-6 py-3 font-black text-indigo-300">
                              Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.grossSalary, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-amber-300">
                              Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.advanceTaken, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-blue-300">
                              Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.advanceDeducted, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-emerald-300">
                              Rs. {staffMonthSummaries.reduce((sum, m) => sum + m.netPaid, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-amber-300">
                              Rs. {(balances?.staffBalances[selectedLedgerStaff.id]?.advanceLoanBalance || 0).toLocaleString()}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* SECTION 2: DETAILED CHRONOLOGICAL TRANSACTION LEDGER */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        <span>Detailed Chronological Ledger & Running Loan Balance</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Every salary slip, advance payout, loan adjustment, and running balance calculation
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      Showing <span className="font-bold text-slate-700">{filteredLedgerTransactions.length}</span> transactions
                      {(selectedMonth !== 'all' || selectedYear !== 'all') && ` in ${getFilterPeriodLabel()}`}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                      <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-bold tracking-wider">
                        <tr>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Slip / Ref</th>
                          <th className="px-5 py-3">Type</th>
                          <th className="px-5 py-3">Description / Memo</th>
                          <th className="px-5 py-3">Channel</th>
                          <th className="px-5 py-3 text-right">Advance Given (+Dr)</th>
                          <th className="px-5 py-3 text-right">Advance Deducted (-Cr)</th>
                          <th className="px-5 py-3 text-right">Gross Salary</th>
                          <th className="px-5 py-3 text-right">Net Cash Paid</th>
                          <th className="px-5 py-3 text-right">Running Advance Balance</th>
                          <th className="px-4 py-3 text-center no-print">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredLedgerTransactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50/75 transition">
                            <td className="px-5 py-3 font-mono font-medium text-slate-600 whitespace-nowrap">{tx.date}</td>
                            <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">{tx.id}</td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                tx.type === 'salary' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                tx.type === 'advance' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                tx.type === 'loan' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                'bg-slate-50 text-slate-700 border border-slate-200'
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-600 max-w-[200px] truncate" title={tx.description || ''}>
                              {tx.description || '—'}
                            </td>
                            <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                              {tx.paymentType} {tx.bankId ? `(${banks.find(b => b.id === tx.bankId)?.name || 'Bank'})` : ''}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-amber-600 whitespace-nowrap">
                              {tx.advanceGiven > 0 ? `Rs. ${tx.advanceGiven.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-blue-600 whitespace-nowrap">
                              {tx.advanceDeducted > 0 ? `Rs. ${tx.advanceDeducted.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                              {(tx.type === 'salary' || tx.type === 'settlement') ? `Rs. ${tx.amount.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-emerald-600 whitespace-nowrap">
                              Rs. {tx.netPaid.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-right font-black whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded ${tx.runningBalance > 0 ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-500'}`}>
                                Rs. {tx.runningBalance.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap space-x-1.5 no-print">
                              <button onClick={() => handleOpenPaymentForm(tx)} className="text-slate-400 hover:text-indigo-600 transition">
                                <Edit className="h-3.5 w-3.5 inline" />
                              </button>
                              <button onClick={() => handleDeletePayment(tx.id)} className="text-slate-400 hover:text-rose-600 transition">
                                <Trash className="h-3.5 w-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredLedgerTransactions.length === 0 && (
                          <tr>
                            <td colSpan={11} className="text-center py-8 text-slate-400">
                              No ledger entries found matching the filter criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {filteredLedgerTransactions.length > 0 && (
                        <tfoot className="bg-slate-900 text-white font-bold text-xs">
                          <tr>
                            <td colSpan={5} className="px-5 py-3 font-black">Filtered Totals ({filteredLedgerTransactions.length} Entries):</td>
                            <td className="px-5 py-3 text-right font-black text-amber-300">
                              Rs. {filteredLedgerTransactions.reduce((sum, t) => sum + t.advanceGiven, 0).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-blue-300">
                              Rs. {filteredLedgerTransactions.reduce((sum, t) => sum + t.advanceDeducted, 0).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-slate-200">
                              Rs. {filteredLedgerTransactions.reduce((sum, t) => sum + ((t.type === 'salary' || t.type === 'settlement') ? t.amount : 0), 0).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-emerald-300">
                              Rs. {filteredLedgerTransactions.reduce((sum, t) => sum + t.netPaid, 0).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-amber-300">
                              Rs. {(balances?.staffBalances[selectedLedgerStaff.id]?.advanceLoanBalance || 0).toLocaleString()}
                            </td>
                            <td className="no-print"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Printable Signature & Authorization Block */}
                <div className="hidden print:block pt-12 pb-4">
                  <div className="grid grid-cols-3 gap-8 text-center text-xs font-bold text-slate-700">
                    <div className="border-t-2 border-slate-400 pt-2">
                      <p>EMPLOYEE SIGNATURE</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">{selectedLedgerStaff.name}</p>
                    </div>
                    <div className="border-t-2 border-slate-400 pt-2">
                      <p>PREPARED BY</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">Accounts Officer</p>
                    </div>
                    <div className="border-t-2 border-slate-400 pt-2">
                      <p>AUTHORIZED BY</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">Director / Managing Partner</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ============================================================= */
              /* VIEW B: ALL STAFF MONTHLY PAYROLL & ADVANCES REGISTER */
              /* ============================================================= */
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        <span>All Staff Monthly Payroll & Advance Register</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Comprehensive summary of salaries processed, advances disbursed, deductions, and current loan balances
                        {(selectedMonth !== 'all' || selectedYear !== 'all') && <span className="font-bold text-indigo-600"> for {getFilterPeriodLabel()}</span>}
                      </p>
                    </div>

                    <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                      Staff Count: <span className="text-indigo-600">{allStaffMonthlyRegister.length}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                      <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-3.5">Staff Member</th>
                          <th className="px-6 py-3.5">Designation</th>
                          <th className="px-6 py-3.5">Base Salary</th>
                          <th className="px-6 py-3.5">Period Gross Paid</th>
                          <th className="px-6 py-3.5">Advance Taken</th>
                          <th className="px-6 py-3.5">Advance Deducted</th>
                          <th className="px-6 py-3.5">Net Cash Paid</th>
                          <th className="px-6 py-3.5">Current Loan Balance</th>
                          <th className="px-6 py-3.5 text-right no-print">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {allStaffMonthlyRegister.map(row => (
                          <tr key={row.staff.id} className="hover:bg-slate-50/75 transition">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{row.staff.name}</div>
                              <div className="text-[11px] text-slate-400">{row.staff.phone || 'No phone'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {row.staff.designation || 'Staff'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-700">
                              Rs. {row.staff.basicSalary.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-indigo-700">
                              {row.grossSalary > 0 ? `Rs. ${row.grossSalary.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-6 py-4 font-bold text-amber-600">
                              {row.advanceTaken > 0 ? `Rs. ${row.advanceTaken.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-6 py-4 font-bold text-blue-600">
                              {row.advanceDeducted > 0 ? `Rs. ${row.advanceDeducted.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-6 py-4 font-black text-emerald-600">
                              Rs. {row.netPaid.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              {row.currentBalance > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Rs. {row.currentBalance.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">No Balance</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap no-print">
                              <button
                                onClick={() => {
                                  setActiveLedgerStaffId(row.staff.id);
                                }}
                                className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold transition border border-indigo-200"
                              >
                                <ClipboardList className="h-3.5 w-3.5" />
                                <span>View Ledger</span>
                              </button>
                              <button
                                onClick={() => handleQuickPay(row.staff)}
                                className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold transition border border-emerald-200"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                                <span>Pay</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {allStaffMonthlyRegister.length === 0 && (
                          <tr>
                            <td colSpan={9} className="text-center py-12 text-slate-400">
                              No staff records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {allStaffMonthlyRegister.length > 0 && (
                        <tfoot className="bg-slate-900 text-white font-bold text-xs">
                          <tr>
                            <td colSpan={2} className="px-6 py-3 font-black">All Staff Register Totals:</td>
                            <td className="px-6 py-3 font-black text-emerald-300">
                              Rs. {allStaffMonthlyRegister.reduce((sum, r) => sum + r.staff.basicSalary, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-indigo-300">
                              Rs. {allStaffMonthlyRegister.reduce((sum, r) => sum + r.grossSalary, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-amber-300">
                              Rs. {allStaffMonthlyRegister.reduce((sum, r) => sum + r.advanceTaken, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-blue-300">
                              Rs. {allStaffMonthlyRegister.reduce((sum, r) => sum + r.advanceDeducted, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-emerald-300">
                              Rs. {allStaffMonthlyRegister.reduce((sum, r) => sum + r.netPaid, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-black text-amber-300">
                              Rs. {allStaffMonthlyRegister.reduce((sum, r) => sum + r.currentBalance, 0).toLocaleString()}
                            </td>
                            <td className="no-print"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Printable Signature & Authorization Block */}
                <div className="hidden print:block pt-12 pb-4">
                  <div className="grid grid-cols-2 gap-8 text-center text-xs font-bold text-slate-700">
                    <div className="border-t-2 border-slate-400 pt-2">
                      <p>PREPARED BY</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">Accounts Officer</p>
                    </div>
                    <div className="border-t-2 border-slate-400 pt-2">
                      <p>AUTHORIZED BY</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">Director / Managing Partner</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
              Software by Roonjha Developer - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: STAFF PROFILE FORM */}
      {/* ========================================================================= */}
      {isStaffFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingStaffId ? 'Edit Employee Profile' : 'Register Staff Member'}
              </h3>
              <button onClick={() => setIsStaffFormOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Habib Ur Rehman"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 0345-1234567"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    placeholder="e.g. Driver, Operator, Clerk"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Basic Salary (Rs. per Month)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={basicSalary}
                  onChange={e => setBasicSalary(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsStaffFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                >
                  {editingStaffId ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SALARY & ADVANCE DISBURSEMENT FORM */}
      {/* ========================================================================= */}
      {isPaymentFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingPaymentId ? 'Edit Disbursement Slip' : 'Process Salary / Staff Advance'}
              </h3>
              <button onClick={() => setIsPaymentFormOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Employee</label>
                  <SearchableSelect
                    options={staff.map(s => ({
                      value: s.id,
                      label: s.name,
                      subLabel: `${s.designation || 'Staff'} • ${s.phone || 'No phone'}`,
                      badge: `Salary: Rs. ${s.basicSalary.toLocaleString()}`,
                      badgeColor: 'indigo',
                      searchTerms: `${s.name} ${s.id} ${s.designation || ''} ${s.phone || ''}`,
                    }))}
                    value={payStaffId}
                    onChange={val => handleStaffSelect(val)}
                    placeholder="-- Select / Search Employee --"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tx Date</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Transaction Type</label>
                  <select
                    value={payType}
                    onChange={e => setPayType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="salary">Monthly Salary</option>
                    <option value="advance">Salary Advance</option>
                    <option value="loan">Staff Loan</option>
                    <option value="settlement">Final Settlement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {payType === 'salary' ? 'Gross Salary Amount' : 'Disbursed Amount'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Show Advance Balance adjustment ONLY for Salary and Settlements */}
              {(payType === 'salary' || payType === 'settlement') && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Available Advance Bal</p>
                    <p className="font-bold text-slate-700 text-sm mt-0.5">
                      Rs. {(balances?.staffBalances[payStaffId]?.advanceLoanBalance || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Advance to Deduct</label>
                    <input
                      type="number"
                      min="0"
                      max={balances?.staffBalances[payStaffId]?.advanceLoanBalance || 0}
                      value={payAdvanceAdjusted}
                      onChange={e => setPayAdvanceAdjusted(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Disbursement Channel</label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cash">Cash Payout</option>
                    <option value="Bank">Bank Deposit</option>
                  </select>
                </div>

                {payMethod === 'Bank' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Source Bank</label>
                    <select
                      value={payBankId}
                      onChange={e => setPayBankId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description / Memo</label>
                <input
                  type="text"
                  value={payDesc}
                  onChange={e => setPayDesc(e.target.value)}
                  placeholder="e.g. Salary for September 2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-between items-baseline font-bold border-t border-slate-100">
                <span className="text-slate-700 text-sm">Net Cash Payout:</span>
                <span className="text-lg text-indigo-600">Rs. {netPaidPreview.toLocaleString()}</span>
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                >
                  {editingPaymentId ? 'Save Changes' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
