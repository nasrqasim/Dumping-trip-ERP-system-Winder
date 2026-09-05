import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBGeneralExpense, DBOtherIncome, DBVoucher, DBBank, DBCustomer, DBVendor } from '../db/indexedDB';
import { calculateLiveBalances, LiveBalances, saveGeneralExpenseTransaction, deleteGeneralExpenseTransaction, saveOtherIncomeTransaction, deleteOtherIncomeTransaction, saveVoucherTransaction, deleteVoucherTransaction } from '../db/transactions';
import { Plus, Trash, Edit, DollarSign, ArrowUpRight, ArrowDownRight, BookOpen, Printer, Search, X } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

export default function Vouchers() {
  const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income' | 'vouchers'>('expenses');
  const [searchQuery, setSearchQuery] = useState('');
  const [voucherFilter, setVoucherFilter] = useState<'all' | 'cash_payment' | 'bank_payment' | 'cash_receipt' | 'bank_receipt'>('all');
  
  // Data States
  const [expenses, setExpenses] = useState<DBGeneralExpense[]>([]);
  const [incomes, setIncomes] = useState<DBOtherIncome[]>([]);
  const [vouchers, setVouchers] = useState<DBVoucher[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [loading, setLoading] = useState(true);

  // Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // General Fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank'>('Cash');
  const [bankId, setBankId] = useState('');
  const [description, setDescription] = useState('');

  // Tab-Specific Fields
  const [expenseCategory, setExpenseCategory] = useState('');
  const [incomeSource, setIncomeSource] = useState('');
  const [voucherType, setVoucherType] = useState<'receipt' | 'payment'>('receipt');
  const [partyType, setPartyType] = useState<'customer' | 'vendor'>('customer');
  const [partyId, setPartyId] = useState('');
  const [reference, setReference] = useState('');

  const loadData = async () => {
    try {
      const allExpenses = await getAllRecords<DBGeneralExpense>('general_expenses');
      allExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(allExpenses);

      const allIncomes = await getAllRecords<DBOtherIncome>('other_incomes');
      allIncomes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setIncomes(allIncomes);

      const allVouchers = await getAllRecords<DBVoucher>('vouchers');
      allVouchers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setVouchers(allVouchers);

      const allBanks = await getAllRecords<DBBank>('banks');
      setBanks(allBanks);
      if (allBanks.length > 0 && !bankId) {
        setBankId(allBanks[0].id);
      }

      const allCustomers = await getAllRecords<DBCustomer>('customers');
      setCustomers(allCustomers);

      const allVendors = await getAllRecords<DBVendor>('vendors');
      setVendors(allVendors);

      const live = await calculateLiveBalances();
      setBalances(live);

      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setDate(item.date);
      setAmount(item.amount);
      setPaymentType(item.paymentType);
      setBankId(item.bankId || (banks.length > 0 ? banks[0].id : ''));
      setDescription(item.description || item.notes || '');

      if (activeSubTab === 'expenses') {
        setExpenseCategory(item.category);
      } else if (activeSubTab === 'income') {
        setIncomeSource(item.source);
      } else {
        setVoucherType(item.type);
        setPartyType(item.partyType);
        setPartyId(item.partyId);
        setReference(item.reference || '');
      }
    } else {
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setAmount(0);
      setPaymentType('Cash');
      setDescription('');
      setExpenseCategory('');
      setIncomeSource('');
      setVoucherType('receipt');
      setPartyType('customer');
      setPartyId('');
      setReference('');
      if (banks.length > 0 && !bankId) setBankId(banks[0].id);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    if (activeSubTab === 'vouchers' && !partyId) {
      alert('Please select an account party (Customer or Vendor).');
      return;
    }

    let targetId = editingId;
    if (!targetId) {
      if (activeSubTab === 'expenses') {
        const allExp = await getAllRecords<DBGeneralExpense>('general_expenses');
        const existing = allExp.map(e => e.id).filter(id => id && id.startsWith('exp-'));
        let maxNum = 0;
        for (const id of existing) {
          const num = parseInt(id.replace('exp-', ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        targetId = `exp-${String(maxNum + 1).padStart(3, '0')}`;
      } else if (activeSubTab === 'income') {
        const allInc = await getAllRecords<DBOtherIncome>('other_incomes');
        const existing = allInc.map(i => i.id).filter(id => id && id.startsWith('inc-'));
        let maxNum = 0;
        for (const id of existing) {
          const num = parseInt(id.replace('inc-', ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        targetId = `inc-${String(maxNum + 1).padStart(3, '0')}`;
      } else {
        const allVch = await getAllRecords<DBVoucher>('vouchers');
        const prefix = paymentType === 'Bank' ? 'bank-' : (voucherType === 'payment' || partyType === 'vendor' ? 'pay-' : 'cash-');
        const existing = allVch.map(v => v.id).filter(id => id && id.startsWith(prefix));
        let maxNum = 0;
        for (const id of existing) {
          const num = parseInt(id.replace(prefix, ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        targetId = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
      }
    }

    if (activeSubTab === 'expenses') {
      const exp: DBGeneralExpense = {
        id: targetId,
        date,
        amount: Number(amount),
        description,
        paymentType,
        bankId: paymentType === 'Bank' ? bankId : undefined,
        category: expenseCategory || 'General',
      };
      await saveGeneralExpenseTransaction(exp);
    } else if (activeSubTab === 'income') {
      const inc: DBOtherIncome = {
        id: targetId,
        date,
        amount: Number(amount),
        description,
        paymentType,
        bankId: paymentType === 'Bank' ? bankId : undefined,
        source: incomeSource || 'Other',
      };
      await saveOtherIncomeTransaction(inc);
    } else {
      const vch: DBVoucher = {
        id: targetId,
        date,
        type: voucherType,
        partyType,
        partyId,
        paymentType,
        bankId: paymentType === 'Bank' ? bankId : undefined,
        amount: Number(amount),
        reference: reference.trim() || targetId,
        notes: description,
      };
      await saveVoucherTransaction(vch);
    }

    setIsFormOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this voucher? All accounting effects will be reversed.')) {
      if (activeSubTab === 'expenses') {
        await deleteGeneralExpenseTransaction(id);
      } else if (activeSubTab === 'income') {
        await deleteOtherIncomeTransaction(id);
      } else {
        await deleteVoucherTransaction(id);
      }
      loadData();
    }
  };

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredExpenses = expenses.filter(e => {
    if (!cleanSearch) return true;
    return (
      e.category.toLowerCase().includes(cleanSearch) ||
      (e.description && e.description.toLowerCase().includes(cleanSearch)) ||
      e.date.includes(cleanSearch) ||
      e.paymentType.toLowerCase().includes(cleanSearch)
    );
  });

  const filteredIncomes = incomes.filter(i => {
    if (!cleanSearch) return true;
    return (
      i.source.toLowerCase().includes(cleanSearch) ||
      (i.description && i.description.toLowerCase().includes(cleanSearch)) ||
      i.date.includes(cleanSearch) ||
      i.paymentType.toLowerCase().includes(cleanSearch)
    );
  });

  const countAllVouchers = vouchers.length;
  const countCashReceipts = vouchers.filter(v => v.type === 'receipt' && v.paymentType === 'Cash').length;
  const countBankReceipts = vouchers.filter(v => v.type === 'receipt' && v.paymentType === 'Bank').length;
  const countCashPayments = vouchers.filter(v => v.type === 'payment' && v.paymentType === 'Cash').length;
  const countBankPayments = vouchers.filter(v => v.type === 'payment' && v.paymentType === 'Bank').length;

  const filteredVouchers = vouchers.filter(v => {
    if (voucherFilter === 'cash_receipt' && !(v.type === 'receipt' && v.paymentType === 'Cash')) return false;
    if (voucherFilter === 'bank_receipt' && !(v.type === 'receipt' && v.paymentType === 'Bank')) return false;
    if (voucherFilter === 'cash_payment' && !(v.type === 'payment' && v.paymentType === 'Cash')) return false;
    if (voucherFilter === 'bank_payment' && !(v.type === 'payment' && v.paymentType === 'Bank')) return false;

    if (!cleanSearch) return true;
    let partyName = v.partyId;
    if (v.partyType === 'customer') {
      partyName = customers.find(c => c.id === v.partyId)?.name || v.partyId;
    } else {
      partyName = vendors.find(vend => vend.id === v.partyId)?.name || v.partyId;
    }
    return (
      partyName.toLowerCase().includes(cleanSearch) ||
      v.partyType.toLowerCase().includes(cleanSearch) ||
      v.type.toLowerCase().includes(cleanSearch) ||
      v.date.includes(cleanSearch) ||
      (v.reference && v.reference.toLowerCase().includes(cleanSearch)) ||
      v.paymentType.toLowerCase().includes(cleanSearch)
    );
  });

  if (loading) {
    return <div className="text-center py-6">Loading vouchers database...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-slate-200 no-print">
        <button
          onClick={() => { setActiveSubTab('expenses'); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeSubTab === 'expenses' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          General Expenses
        </button>
        <button
          onClick={() => { setActiveSubTab('income'); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeSubTab === 'income' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Other Income
        </button>
        <button
          onClick={() => { setActiveSubTab('vouchers'); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeSubTab === 'vouchers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Cash/Bank Party Vouchers
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {activeSubTab === 'expenses' && 'General Expenses Log'}
            {activeSubTab === 'income' && 'Other Business Income'}
            {activeSubTab === 'vouchers' && 'Receipts & Payments Vouchers'}
          </h2>
          <p className="text-sm text-slate-500">
            {activeSubTab === 'expenses' && 'Record office expenses, diesel bills, tool maintenance, and cash costs'}
            {activeSubTab === 'income' && 'Record ancillary income streams (e.g. kanta fees, commissions)'}
            {activeSubTab === 'vouchers' && 'Direct cash/bank payments and collections for customer/vendor balances'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search records..."
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

          {/* Voucher Filter Dropdown */}
          {activeSubTab === 'vouchers' && (
            <div className="relative">
              <select
                value={voucherFilter}
                onChange={e => setVoucherFilter(e.target.value as any)}
                className="pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
              >
                <option value="all">All Vouchers ({countAllVouchers})</option>
                <option value="cash_payment">Cash Payment ({countCashPayments})</option>
                <option value="bank_payment">Bank Payment ({countBankPayments})</option>
                <option value="cash_receipt">Cash Receipt ({countCashReceipts})</option>
                <option value="bank_receipt">Bank Receipt ({countBankReceipts})</option>
              </select>
            </div>
          )}

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
            <span>
              {activeSubTab === 'expenses' && 'Record Expense'}
              {activeSubTab === 'income' && 'Record Income'}
              {activeSubTab === 'vouchers' && 'Create Voucher'}
            </span>
          </button>
        </div>
      </div>

      {/* Quick Filter Pill Buttons for Vouchers */}
      {activeSubTab === 'vouchers' && (
        <div className="flex flex-wrap items-center gap-2 no-print bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
          <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">Filter Vouchers:</span>
          
          <button
            type="button"
            onClick={() => setVoucherFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
              voucherFilter === 'all'
                ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>All Vouchers</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              voucherFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {countAllVouchers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVoucherFilter('cash_payment')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
              voucherFilter === 'cash_payment'
                ? 'bg-rose-600 text-white ring-2 ring-rose-500 ring-offset-1'
                : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            <span>Cash Payment</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              voucherFilter === 'cash_payment' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              {countCashPayments}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVoucherFilter('bank_payment')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
              voucherFilter === 'bank_payment'
                ? 'bg-purple-600 text-white ring-2 ring-purple-500 ring-offset-1'
                : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            <span>Bank Payment</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              voucherFilter === 'bank_payment' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'
            }`}>
              {countBankPayments}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVoucherFilter('cash_receipt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
              voucherFilter === 'cash_receipt'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-500 ring-offset-1'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            <span>Cash Receipt</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              voucherFilter === 'cash_receipt' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {countCashReceipts}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVoucherFilter('bank_receipt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
              voucherFilter === 'bank_receipt'
                ? 'bg-teal-600 text-white ring-2 ring-teal-500 ring-offset-1'
                : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200'
            }`}
          >
            <span>Bank Receipt</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              voucherFilter === 'bank_receipt' ? 'bg-teal-700 text-white' : 'bg-teal-100 text-teal-800'
            }`}>
              {countBankReceipts}
            </span>
          </button>
        </div>
      )}

      {/* Primary Tables */}
      <div className="print-a4 print-container space-y-4">
        <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
          <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
            {activeSubTab === 'expenses' && 'GENERAL EXPENSES LOG REGISTER'}
            {activeSubTab === 'income' && 'OTHER BUSINESS INCOME REGISTER'}
            {activeSubTab === 'vouchers' && (
              <>
                RECEIPTS & PAYMENTS VOUCHERS REGISTER
                {voucherFilter === 'cash_payment' && ' (CASH PAYMENTS ONLY)'}
                {voucherFilter === 'bank_payment' && ' (BANK PAYMENTS ONLY)'}
                {voucherFilter === 'cash_receipt' && ' (CASH RECEIPTS ONLY)'}
                {voucherFilter === 'bank_receipt' && ' (BANK RECEIPTS ONLY)'}
              </>
            )}
          </p>
          <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
            <div>
              Total Records: {activeSubTab === 'expenses' ? filteredExpenses.length : activeSubTab === 'income' ? filteredIncomes.length : filteredVouchers.length}
            </div>
            <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            {activeSubTab === 'expenses' && (
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-3 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Category</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Description</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Payment Channel</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Amount</th>
                    <th className="px-3 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{exp.date}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">{exp.category}</td>
                      <td className="px-3 py-3 text-slate-500">{exp.description || '—'}</td>
                      <td className="px-3 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {exp.paymentType} {exp.bankId ? `(${banks.find(b => b.id === exp.bankId)?.name})` : ''}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-rose-600 whitespace-nowrap">Rs. {exp.amount.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right space-x-2 no-print">
                        <button onClick={() => handleOpenForm(exp)} className="text-slate-400 hover:text-indigo-600 transition"><Edit className="h-4 w-4 inline" /></button>
                        <button onClick={() => handleDelete(exp.id)} className="text-slate-400 hover:text-rose-600 transition"><Trash className="h-4 w-4 inline" /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        {searchQuery ? `No matching general expenses found for "${searchQuery}".` : 'No general expenses recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredExpenses.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm border-t border-slate-700 font-mono">
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-right font-black whitespace-nowrap">Grand Totals ({filteredExpenses.length}):</td>
                      <td className="px-3 py-3 text-right text-rose-300 font-black whitespace-nowrap">Rs. {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {activeSubTab === 'income' && (
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-3 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Source</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Description</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Receipt Channel</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Amount</th>
                    <th className="px-3 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredIncomes.map(inc => (
                    <tr key={inc.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{inc.date}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">{inc.source}</td>
                      <td className="px-3 py-3 text-slate-500">{inc.description || '—'}</td>
                      <td className="px-3 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {inc.paymentType} {inc.bankId ? `(${banks.find(b => b.id === inc.bankId)?.name})` : ''}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">Rs. {inc.amount.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right space-x-2 no-print">
                        <button onClick={() => handleOpenForm(inc)} className="text-slate-400 hover:text-indigo-600 transition"><Edit className="h-4 w-4 inline" /></button>
                        <button onClick={() => handleDelete(inc.id)} className="text-slate-400 hover:text-rose-600 transition"><Trash className="h-4 w-4 inline" /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredIncomes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        {searchQuery ? `No matching other income found for "${searchQuery}".` : 'No other income recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredIncomes.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm border-t border-slate-700 font-mono">
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-right font-black whitespace-nowrap">Grand Totals ({filteredIncomes.length}):</td>
                      <td className="px-3 py-3 text-right text-emerald-300 font-black whitespace-nowrap">Rs. {filteredIncomes.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}</td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {activeSubTab === 'vouchers' && (
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-3 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Voucher Type</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Account / Party</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Reference</th>
                    <th className="px-3 py-3.5 whitespace-nowrap">Channel</th>
                    <th className="px-3 py-3.5 text-right whitespace-nowrap">Amount</th>
                    <th className="px-3 py-3.5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredVouchers.map(vch => {
                    let partyName = vch.partyId;
                    if (vch.partyType === 'customer') {
                      partyName = customers.find(c => c.id === vch.partyId)?.name || vch.partyId;
                    } else {
                      partyName = vendors.find(v => v.id === vch.partyId)?.name || vch.partyId;
                    }

                    let displayRef = vch.id;
                    if (!displayRef || displayRef.startsWith('vch-') || displayRef.startsWith('rcpt-') || displayRef.startsWith('pymt-')) {
                      if (vch.reference && !vch.reference.startsWith('vch-') && !vch.reference.startsWith('rcpt-') && !vch.reference.startsWith('pymt-')) {
                        displayRef = vch.reference;
                      } else if (vch.paymentType === 'Bank' || vch.bankId) {
                        displayRef = 'bank-001';
                      } else if (vch.type === 'receipt') {
                        displayRef = 'cash-001';
                      } else {
                        displayRef = 'pay-001';
                      }
                    } else if (vch.reference && vch.reference !== vch.id && !vch.reference.startsWith('vch-') && !vch.reference.startsWith('rcpt-') && !vch.reference.startsWith('pymt-')) {
                      displayRef = `${vch.id} (${vch.reference})`;
                    }

                    return (
                      <tr key={vch.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{vch.date}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase whitespace-nowrap ${vch.type === 'receipt' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {vch.type === 'receipt' ? 'Receipt' : 'Payment'}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          {partyName} <span className="text-xs text-slate-400 font-medium capitalize">({vch.partyType})</span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{displayRef}</td>
                        <td className="px-3 py-3 text-slate-700 font-medium whitespace-nowrap">
                          {vch.paymentType} {vch.bankId ? `(${banks.find(b => b.id === vch.bankId)?.name})` : ''}
                        </td>
                        <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${vch.type === 'receipt' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Rs. {vch.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right space-x-2 whitespace-nowrap no-print">
                          <button onClick={() => handleOpenForm(vch)} className="text-slate-400 hover:text-indigo-600 transition"><Edit className="h-4 w-4 inline" /></button>
                          <button onClick={() => handleDelete(vch.id)} className="text-slate-400 hover:text-rose-600 transition"><Trash className="h-4 w-4 inline" /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredVouchers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        {searchQuery
                          ? `No matching party vouchers found for "${searchQuery}".`
                          : voucherFilter !== 'all'
                          ? `No ${voucherFilter.replace('_', ' ')} records found.`
                          : 'No party receipts or payment vouchers recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredVouchers.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs md:text-sm border-t border-slate-700 font-mono">
                    <tr>
                      <td colSpan={5} className="px-6 py-3 text-right font-black">
                        {(voucherFilter === 'all' || voucherFilter.includes('receipt')) && (
                          <span className={voucherFilter === 'all' ? 'mr-6' : ''}>
                            {voucherFilter === 'cash_receipt' ? 'Total Cash Receipts: ' : voucherFilter === 'bank_receipt' ? 'Total Bank Receipts: ' : 'Total Receipts: '}
                            <span className="text-emerald-300">
                              Rs. {filteredVouchers.filter(v => v.type === 'receipt').reduce((sum, v) => sum + v.amount, 0).toLocaleString()}
                            </span>
                          </span>
                        )}
                        {(voucherFilter === 'all' || voucherFilter.includes('payment')) && (
                          <span>
                            {voucherFilter === 'cash_payment' ? 'Total Cash Payments: ' : voucherFilter === 'bank_payment' ? 'Total Bank Payments: ' : 'Total Payments: '}
                            <span className="text-rose-300">
                              Rs. {filteredVouchers.filter(v => v.type === 'payment').reduce((sum, v) => sum + v.amount, 0).toLocaleString()}
                            </span>
                          </span>
                        )}
                      </td>
                      <td colSpan={2} className="no-print"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>

        <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
          Software by Roonjha Developer - 03152914836
        </div>
      </div>

      {/* Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Financial Entry' : 'Record New Entry'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Amount (Rs.)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Vouchers Specific Header fields */}
              {activeSubTab === 'vouchers' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Voucher Type</label>
                    <select
                      value={voucherType}
                      onChange={e => setVoucherType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="receipt">Receipt (From Customer)</option>
                      <option value="payment">Payment (To Vendor)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Party Type</label>
                    <select
                      value={partyType}
                      onChange={e => setPartyType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="customer">Customer</option>
                      <option value="vendor">Vendor</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Category, Source, or Party selection */}
              {activeSubTab === 'expenses' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Expense Category</label>
                  <input
                    type="text"
                    required
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    placeholder="e.g. Office Rent, Printing, Stationery"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {activeSubTab === 'income' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Income Source</label>
                  <input
                    type="text"
                    required
                    value={incomeSource}
                    onChange={e => setIncomeSource(e.target.value)}
                    placeholder="e.g. Scrap Sale, Commissions"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {activeSubTab === 'vouchers' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Account Party</label>
                  <SearchableSelect
                    options={partyType === 'customer' 
                      ? customers.map(c => {
                          const balInfo = balances?.customerBalances[c.id] || { outstanding: 0, advance: 0 };
                          const currentBalance = balInfo.outstanding > 0 ? balInfo.outstanding : balInfo.advance;
                          const status = balInfo.outstanding > 0 ? 'Outstanding' : (balInfo.advance > 0 ? 'Advance' : 'Clear');
                          const badgeColor = balInfo.outstanding > 0 ? 'rose' : (balInfo.advance > 0 ? 'emerald' : 'slate');
                          return {
                            value: c.id,
                            label: c.name,
                            subLabel: `${c.phone ? `Phone: ${c.phone}` : ''}${c.area ? ` • Area: ${c.area}` : ''}`,
                            badge: c.id.startsWith('walkin') ? undefined : `Bal: Rs. ${currentBalance.toLocaleString()} (${status})`,
                            badgeColor,
                            searchTerms: `${c.name} ${c.id} ${c.phone || ''} ${c.area || ''}`,
                          };
                        })
                      : vendors.map(v => {
                          const balInfo = balances?.vendorBalances[v.id] || { outstanding: 0, advance: 0 };
                          const currentBalance = balInfo.outstanding > 0 ? balInfo.outstanding : balInfo.advance;
                          const status = balInfo.outstanding > 0 ? 'Outstanding' : (balInfo.advance > 0 ? 'Advance' : 'Clear');
                          const badgeColor = balInfo.outstanding > 0 ? 'rose' : (balInfo.advance > 0 ? 'emerald' : 'slate');
                          return {
                            value: v.id,
                            label: v.name,
                            subLabel: `${v.phone ? `Phone: ${v.phone}` : ''}${v.address ? ` • ${v.address}` : ''}`,
                            badge: `Bal: Rs. ${currentBalance.toLocaleString()} (${status})`,
                            badgeColor,
                            searchTerms: `${v.name} ${v.id} ${v.phone || ''} ${v.address || ''}`,
                          };
                        })
                    }
                    value={partyId}
                    onChange={val => setPartyId(val)}
                    placeholder={`-- Select ${partyType === 'customer' ? 'Customer' : 'Vendor'} --`}
                    required
                  />
                </div>
              )}

              {/* Channel configurations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Payment Method</label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Channel</option>
                  </select>
                </div>

                {paymentType === 'Bank' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Bank Account</label>
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

              {activeSubTab === 'vouchers' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Slip Reference Number</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="Check # or online txn ref"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description / Memo</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Memo details"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
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
                  {editingId ? 'Save Changes' : 'Post Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
