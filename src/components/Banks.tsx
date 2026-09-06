import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBBank, DBLedgerEntry, DBCustomer, DBVendor, DBStaff } from '../db/firestore';
import { calculateLiveBalances, LiveBalances } from '../db/transactions';
import { Landmark, Plus, Edit, Trash, History, Printer, Search, X } from 'lucide-react';

export default function Banks() {
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [ledgers, setLedgers] = useState<DBLedgerEntry[]>([]);
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [staff, setStaff] = useState<DBStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Form modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewHistoryBank, setViewHistoryBank] = useState<DBBank | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);

  const loadData = async () => {
    try {
      const allBanks = await getAllRecords<DBBank>('banks');
      setBanks(allBanks);

      const liveBal = await calculateLiveBalances();
      setBalances(liveBal);

      const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
      setLedgers(allLedgers);

      const allCust = await getAllRecords<DBCustomer>('customers');
      setCustomers(allCust);

      const allVend = await getAllRecords<DBVendor>('vendors');
      setVendors(allVend);

      const allStaff = await getAllRecords<DBStaff>('staff');
      setStaff(allStaff);

      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = (b?: DBBank) => {
    if (b) {
      setEditingId(b.id);
      setName(b.name);
      setAccountNumber(b.accountNumber);
      setOpeningBalance(b.openingBalance);
    } else {
      setEditingId(null);
      setName('');
      setAccountNumber('');
      setOpeningBalance(0);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const bId = editingId || 'bnk-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const savedBank: DBBank = {
      id: bId,
      name,
      accountNumber,
      openingBalance: Number(openingBalance),
    };

    await putRecord<DBBank>('banks', savedBank);

    // Opening balance registration in unified ledger
    const opEntryId = 'opening-bank-' + bId;
    const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
    const existingLedger = allLedgers.filter(l => l.referenceId === opEntryId);
    for (const entry of existingLedger) {
      await deleteRecord('ledgers', entry.id);
    }

    if (Number(openingBalance) !== 0) {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        date: new Date().toISOString().split('T')[0],
        type: 'opening',
        referenceId: opEntryId,
        accountId: bId,
        accountType: 'bank',
        debit: Number(openingBalance) > 0 ? Number(openingBalance) : 0,
        credit: Number(openingBalance) < 0 ? Math.abs(Number(openingBalance)) : 0,
        description: 'Bank Opening Balance',
      });
    }

    setIsFormOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bank account?')) {
      await deleteRecord('banks', id);
      
      // Clean ledger of opening balance and related
      const opEntryId = 'opening-bank-' + id;
      const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
      for (const entry of allLedgers) {
        if (entry.referenceId === opEntryId || entry.accountId === id) {
          await deleteRecord('ledgers', entry.id);
        }
      }
      
      loadData();
    }
  };

  const handlePrintLedger = () => {
    window.print();
  };

  if (loading) {
    return <div className="text-center py-6">Loading banks database...</div>;
  }

  // Get bank journal rows
  let bankHistoryRows: {
    date: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }[] = [];

  if (viewHistoryBank) {
    const bId = viewHistoryBank.id;
    const bankLedgerEntries = ledgers.filter(l => l.accountId === bId);
    
    bankLedgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let runningBal = 0;
    bankHistoryRows = bankLedgerEntries.map(entry => {
      runningBal += (entry.debit - entry.credit);
      return {
        date: entry.date,
        type: entry.type.toUpperCase(),
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit,
        balance: runningBal,
      };
    });
  }

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredBanks = banks.filter(b => {
    if (!cleanSearch) return true;
    return (
      b.name.toLowerCase().includes(cleanSearch) ||
      (b.accountNumber && b.accountNumber.toLowerCase().includes(cleanSearch))
    );
  });

  const cleanHistorySearch = historySearchQuery.toLowerCase().trim();
  const filteredHistoryRows = bankHistoryRows.filter(r => {
    if (!cleanHistorySearch) return true;
    return (
      r.date.includes(cleanHistorySearch) ||
      r.type.toLowerCase().includes(cleanHistorySearch) ||
      r.description.toLowerCase().includes(cleanHistorySearch)
    );
  });

  return (
    <div className="space-y-6">
      {/* Listing View */}
      {!viewHistoryBank && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Banks Master Registry</h2>
              <p className="text-sm text-slate-500">Configure bank accounts, check live balances, and audit history logs</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search bank name or A/C..."
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
                <span>Add Bank Account</span>
              </button>
            </div>
          </div>

          {/* Screen Only Cards Directory grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
            {filteredBanks.map(bank => {
              const currentBal = balances?.bankBalances[bank.id] !== undefined 
                ? balances.bankBalances[bank.id] 
                : bank.openingBalance;

              return (
                <div key={bank.id} className="bg-white rounded-lg shadow-sm border border-slate-100 p-5 flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                        <Landmark className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{bank.name}</h3>
                        <p className="text-xs text-slate-500 font-mono">A/C: {bank.accountNumber || '—'}</p>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button onClick={() => handleOpenForm(bank)} className="text-slate-400 hover:text-indigo-600 p-1 transition">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(bank.id)} className="text-slate-400 hover:text-rose-600 p-1 transition">
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-3">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Dynamic Book Balance</p>
                    <h4 className="text-xl font-black text-slate-800 mt-1">Rs. {currentBal.toLocaleString()}</h4>
                  </div>

                  <button
                    onClick={() => setViewHistoryBank(bank)}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold py-2 rounded transition flex items-center justify-center space-x-1.5"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Audit History Journal</span>
                  </button>
                </div>
              );
            })}
            {filteredBanks.length === 0 && (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-400 md:col-span-3">
                <Landmark className="h-10 w-10 mx-auto mb-2 stroke-1" />
                <p className="text-sm font-medium">
                  {searchQuery ? `No matching bank accounts found for "${searchQuery}".` : 'No banks registered. Add bank records to track bank receipts/payments.'}
                </p>
              </div>
            )}
          </div>

          {/* Printable Bank Accounts Directory Table */}
          <div className="hidden print:block print-a4 print-container space-y-4">
            <div className="text-center pb-4 border-b-2 border-slate-300">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
                BANK ACCOUNTS & LIVE BALANCES DIRECTORY
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Total Bank Accounts: {banks.length}</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Bank Name</th>
                    <th className="px-6 py-4">Account Number</th>
                    <th className="px-6 py-4 text-right">Opening Balance</th>
                    <th className="px-6 py-4 text-right">Current Live Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {banks.map(bank => {
                    const currentBal = balances?.bankBalances[bank.id] !== undefined 
                      ? balances.bankBalances[bank.id] 
                      : bank.openingBalance;
                    return (
                      <tr key={bank.id}>
                        <td className="px-6 py-4 font-bold text-slate-800">{bank.name}</td>
                        <td className="px-6 py-4 font-mono">{bank.accountNumber || '—'}</td>
                        <td className="px-6 py-4 text-right font-medium">Rs. {bank.openingBalance.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">Rs. {currentBal.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {banks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-400">No bank accounts registered.</td>
                    </tr>
                  )}
                </tbody>
                {banks.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs">
                    <tr>
                      <td colSpan={2} className="px-6 py-3 font-black">Total Bank Reserves ({banks.length} Accounts):</td>
                      <td className="px-6 py-3 text-right font-black text-slate-300">
                        Rs. {banks.reduce((sum, b) => sum + b.openingBalance, 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-black text-emerald-300">
                        Rs. {banks.reduce((sum, b) => sum + (balances?.bankBalances[b.id] ?? b.openingBalance), 0).toLocaleString()}
                      </td>
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
      )}

      {/* History Journal Log View */}
      {viewHistoryBank && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <Landmark className="h-5 w-5 text-indigo-600" />
              <span>Audit Ledger Statement: {viewHistoryBank.name}</span>
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              {/* History Search */}
              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={e => setHistorySearchQuery(e.target.value)}
                  placeholder="Search date, type, details..."
                  className="w-full pl-8 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 bg-white"
                />
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-2 p-0.5 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <button
                onClick={() => handlePrintLedger()}
                className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ledger</span>
              </button>
              <button
                onClick={() => setViewHistoryBank(null)}
                className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                Close audit journal
              </button>
            </div>
          </div>

          <div className="print-a4 print-container space-y-4">
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">BANK STATEMENT & AUDIT JOURNAL - {viewHistoryBank.name}</p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Account No: {viewHistoryBank.accountNumber || 'N/A'}</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg text-sm mb-6 border border-slate-100 no-print">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Bank Name</p>
                <p className="font-bold text-slate-700">{viewHistoryBank.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Account Number</p>
                <p className="font-medium text-slate-600">{viewHistoryBank.accountNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Opening Balance</p>
                <p className="font-medium text-slate-600">Rs. {viewHistoryBank.openingBalance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Current Balance</p>
                <p className="font-bold text-indigo-700">
                  Rs. {(balances?.bankBalances[viewHistoryBank.id] || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* History Table */}
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs md:text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Tx Type</th>
                  <th className="px-4 py-3">Details / Reference</th>
                  <th className="px-4 py-3 text-right">Debit (Deposit)</th>
                  <th className="px-4 py-3 text-right">Credit (Withdrawal)</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistoryRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600">{row.date}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700 text-xs">{row.type}</td>
                    <td className="px-4 py-3 text-slate-700">{row.description}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                      {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold">
                      {row.credit > 0 ? `Rs. ${row.credit.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      Rs. {row.balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredHistoryRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">
                      {historySearchQuery ? `No transactions match "${historySearchQuery}".` : 'No bank transactions recorded.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredHistoryRows.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-bold text-xs">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-black">Statement Totals ({filteredHistoryRows.length} Entries):</td>
                    <td className="px-4 py-3 text-right font-black text-emerald-300">
                      Rs. {filteredHistoryRows.reduce((sum, r) => sum + r.debit, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-rose-300">
                      Rs. {filteredHistoryRows.reduce((sum, r) => sum + r.credit, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-300">
                      Rs. {(filteredHistoryRows[filteredHistoryRows.length - 1]?.balance || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            
            {/* Centered Footer */}
            <div className="print-footer text-center">
              Software by Roonjha Developer - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* Bank Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Bank Profile' : 'Add Bank Account'}
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
                  Bank Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Meezan Bank, HBL"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="e.g. 0233-010493-294"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Opening Balance (Rs.)
                </label>
                <input
                  type="number"
                  required
                  value={openingBalance}
                  onChange={e => setOpeningBalance(Number(e.target.value))}
                  placeholder="Initial bank balance"
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
                  {editingId ? 'Save Changes' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
