import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBVendor, DBLedgerEntry, DBBank, DBVoucher, DBPurchase, DBItem } from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveVoucherTransaction } from '../db/transactions';
import { Truck, Phone, MapPin, FileText, Plus, Edit, Trash, Printer, Search, X } from 'lucide-react';

interface VendorsProps {
  onNavigateToPurchase: (vendorId: string) => void;
}

export default function Vendors({ onNavigateToPurchase }: VendorsProps) {
  const [vendors, setVendors] = useState<DBVendor[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [ledgers, setLedgers] = useState<DBLedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<DBPurchase[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [vouchers, setVouchers] = useState<DBVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [activeLedgerVendor, setActiveLedgerVendor] = useState<DBVendor | null>(null);
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // default to start of month
    return d.toISOString().split('T')[0];
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [formOutstanding, setFormOutstanding] = useState<number | ''>('');
  const [formAdvance, setFormAdvance] = useState<number | ''>('');
  const [contactPerson, setContactPerson] = useState('');
  const [category, setCategory] = useState('Supplier');
  const [ntn, setNtn] = useState('');
  const [strn, setStrn] = useState('');
  const [creditDays, setCreditDays] = useState(30);
  const [formNotes, setFormNotes] = useState('');

  // Payment State
  const [paymentVendor, setPaymentVendor] = useState<DBVendor | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank'>('Cash');
  const [bankId, setBankId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const allVendors = await getAllRecords<DBVendor>('vendors');
      const allBanks = await getAllRecords<DBBank>('banks');
      const liveBal = await calculateLiveBalances();
      const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
      const allPurchases = await getAllRecords<DBPurchase>('purchases');
      const allItems = await getAllRecords<DBItem>('items');
      const allVouchers = await getAllRecords<DBVoucher>('vouchers');
      
      setVendors(allVendors);
      setBanks(allBanks);
      setBalances(liveBal);
      setLedgers(allLedgers);
      setPurchases(allPurchases);
      setItems(allItems);
      setVouchers(allVouchers);
      
      if (allBanks.length > 0) {
        setBankId(allBanks[0].id);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = (vend?: DBVendor) => {
    if (vend) {
      setEditingId(vend.id);
      setName(vend.name);
      setPhone(vend.phone);
      setAddress(vend.address);
      setArea(vend.area || '');
      const ob = vend.openingBalance || 0;
      setOpeningBalance(ob);
      if (ob > 0) {
        setFormOutstanding(ob);
        setFormAdvance('');
      } else if (ob < 0) {
        setFormOutstanding('');
        setFormAdvance(Math.abs(ob));
      } else {
        setFormOutstanding('');
        setFormAdvance('');
      }
      setContactPerson(vend.contactPerson || '');
      setCategory(vend.category || 'Supplier');
      setNtn(vend.ntn || '');
      setStrn(vend.strn || '');
      setCreditDays(vend.creditDays || 30);
      setFormNotes(vend.notes || '');
    } else {
      setEditingId(null);
      setName('');
      setPhone('');
      setAddress('');
      setArea('');
      setOpeningBalance(0);
      setFormOutstanding('');
      setFormAdvance('');
      setContactPerson('');
      setCategory('Supplier');
      setNtn('');
      setStrn('');
      setCreditDays(30);
      setFormNotes('');
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      alert('Please enter a valid Vendor Name. Whitespace-only names are not allowed.');
      return;
    }
    if (!cleanPhone) {
      alert('Please enter a valid Phone Number for the vendor.');
      return;
    }
    if (cleanPhone.length < 7) {
      alert('Phone number must be at least 7 characters (e.g. 0300-1234567).');
      return;
    }

    let vendId = editingId;
    if (!vendId) {
      const prefix = 'vend-';
      const existingIds = vendors.map(v => v.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
      const nextNum = maxNum + 1;
      vendId = `${prefix}${String(nextNum).padStart(3, '0')}`;
    }
    const numOutstanding = Number(formOutstanding) || 0;
    const numAdvance = Number(formAdvance) || 0;
    const netOpening = numOutstanding - numAdvance;

    const savedVendor: DBVendor = {
      id: vendId,
      name: cleanName,
      phone: cleanPhone,
      address: address.trim(),
      area: area.trim(),
      openingBalance: netOpening,
      contactPerson: contactPerson.trim(),
      category: category,
      ntn: ntn.trim(),
      strn: strn.trim(),
      creditDays: Number(creditDays) || 0,
      notes: formNotes.trim(),
    };

    await putRecord<DBVendor>('vendors', savedVendor);

    // Opening balance registration in ledger
    const opEntryId = 'opening-vend-' + vendId;
    
    // Clear previous opening entries if any
    const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
    const existingLedger = allLedgers.filter(l => l.referenceId === opEntryId);
    for (const entry of existingLedger) {
      await deleteRecord('ledgers', entry.id);
    }

    if (netOpening !== 0) {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        date: new Date().toISOString().split('T')[0],
        type: 'opening',
        referenceId: opEntryId,
        accountId: vendId,
        accountType: 'vendor',
        debit: netOpening < 0 ? Math.abs(netOpening) : 0, // negative means advance paid (debit asset)
        credit: netOpening > 0 ? netOpening : 0, // positive means outstanding payable (credit liability)
        description: 'Vendor Opening Balance',
      });
    }

    setIsFormOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this vendor? This will clear profile details.')) {
      await deleteRecord('vendors', id);
      
      // Clean ledger of opening balance and related
      const opEntryId = 'opening-vend-' + id;
      const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
      for (const entry of allLedgers) {
        if (entry.referenceId === opEntryId || entry.accountId === id) {
          await deleteRecord('ledgers', entry.id);
        }
      }
      
      loadData();
    }
  };

  const handleOpenPayment = (vend: DBVendor) => {
    setPaymentVendor(vend);
    setPaymentAmount(0);
    setPaymentType('Cash');
    setReference('');
    setNotes('');
    setIsPaymentOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentVendor || paymentAmount <= 0) return;

    const allVouchers = await getAllRecords<DBVoucher>('vouchers');
    const prefix = paymentType === 'Bank' ? 'bank-' : 'pay-';
    const existingIds = allVouchers.map(v => v.id).filter(id => id.startsWith(prefix));
    let maxNum = 0;
    for (const id of existingIds) {
      const numPart = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
    const nextNum = maxNum + 1;
    const voucherId = `${prefix}${String(nextNum).padStart(3, '0')}`;

    const voucher: DBVoucher = {
      id: voucherId,
      date: new Date().toISOString().split('T')[0],
      type: 'payment',
      partyType: 'vendor',
      partyId: paymentVendor.id,
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      amount: Number(paymentAmount),
      reference: reference.trim() || voucherId,
      notes,
    };

    await saveVoucherTransaction(voucher);
    setIsPaymentOpen(false);
    loadData();
  };

  const handlePrintLedger = () => {
    window.print();
  };

  if (loading) {
    return <div className="text-center py-6">Loading vendors database...</div>;
  }

  // Get active vendor ledger logs
  let vendorLedgerRows: {
    date: string;
    reference: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    advance: number;
    outstanding: number;
    balance: number;
    itemDetails?: string;
  }[] = [];

  let ledgerOpeningBalance = 0;
  let ledgerClosingBalance = 0;
  let ledgerTotalDebit = 0;
  let ledgerTotalCredit = 0;

  if (activeLedgerVendor) {
    const vendId = activeLedgerVendor.id;
    const vendLedgerEntries = ledgers.filter(l => l.accountId === vendId);
    
    vendLedgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // 1. Calculate opening balance before ledgerStartDate
    let preBalance = 0;
    const prePeriodEntries = vendLedgerEntries.filter(e => ledgerStartDate && e.date < ledgerStartDate);
    preBalance = prePeriodEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);
    ledgerOpeningBalance = preBalance;

    // 2. Filter entries within date range
    const periodEntries = vendLedgerEntries.filter(e => 
      (!ledgerStartDate || e.date >= ledgerStartDate) && 
      (!ledgerEndDate || e.date <= ledgerEndDate)
    );

    let runningBal = preBalance;
    
    // Insert Opening Balance row at the beginning
    vendorLedgerRows.push({
      date: ledgerStartDate || 'Start',
      reference: 'OP-BAL',
      type: 'OPENING',
      description: 'Opening Balance Carried Forward',
      debit: preBalance < 0 ? Math.abs(preBalance) : 0,
      credit: preBalance > 0 ? preBalance : 0,
      advance: preBalance < 0 ? Math.abs(preBalance) : 0,
      outstanding: preBalance > 0 ? preBalance : 0,
      balance: preBalance,
    });

    for (const entry of periodEntries) {
      runningBal += (entry.credit - entry.debit);
      ledgerTotalDebit += entry.debit;
      ledgerTotalCredit += entry.credit;

      let itemDetails = '';
      if (entry.type === 'purchase') {
        const purchase = purchases.find(p => p.id === entry.referenceId);
        if (purchase) {
          const itemObj = items.find(i => i.id === purchase.itemId);
          itemDetails = `Item: ${itemObj?.name || purchase.itemId} | Qty: ${purchase.quantity} ${itemObj?.unit || ''} | Price/Unit: Rs.${purchase.rate.toLocaleString()} | Amount: Rs.${(purchase.quantity * purchase.rate).toLocaleString()}`;
        }
      }

      let displayRef = entry.referenceId || '—';
      if (displayRef.startsWith('pymt-') || displayRef.startsWith('vch-')) {
        const match = vouchers.find(v => v.id === entry.referenceId || v.reference === entry.referenceId);
        displayRef = match ? match.id : (entry.description.toLowerCase().includes('bank') ? 'bank-001' : 'pay-001');
      }

      vendorLedgerRows.push({
        date: entry.date,
        reference: displayRef,
        type: entry.type.toUpperCase(),
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit,
        advance: runningBal < 0 ? Math.abs(runningBal) : 0,
        outstanding: runningBal > 0 ? runningBal : 0,
        balance: runningBal,
        itemDetails,
      });
    }

    ledgerClosingBalance = runningBal;
  }

  const cleanSearch = searchQuery.toLowerCase().trim();
  const filteredVendors = vendors.filter(vend => {
    if (!cleanSearch) return true;
    return (
      vend.name.toLowerCase().includes(cleanSearch) ||
      vend.id.toLowerCase().includes(cleanSearch) ||
      (vend.phone && vend.phone.toLowerCase().includes(cleanSearch)) ||
      (vend.address && vend.address.toLowerCase().includes(cleanSearch))
    );
  });

  return (
    <div className="space-y-6">
      {/* List Page */}
      {!activeLedgerVendor && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Vendors Directory & Suppliers</h2>
              <p className="text-sm text-slate-500">Manage vendor materials, purchase billing, and balances</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search vendor..."
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
                <span>Add New Vendor</span>
              </button>
            </div>
          </div>

          <div className="print-a4 print-container space-y-4">
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
                VENDORS & SUPPLIERS DIRECTORY
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Total Vendors: {vendors.length}</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* Directory Grid */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Vendor Name</th>
                      <th className="px-6 py-4">Contact Info</th>
                      <th className="px-6 py-4">Total Purchases</th>
                      <th className="px-6 py-4">Total Paid</th>
                      <th className="px-6 py-4">Outstanding Bal</th>
                      <th className="px-6 py-4">Advance Bal</th>
                      <th className="px-6 py-4">Account Status</th>
                      <th className="px-6 py-4 text-right no-print">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredVendors.map(vend => {
                      const balInfo = balances?.vendorBalances[vend.id] || {
                        outstanding: 0,
                        advance: 0,
                        totalPurchases: 0,
                        totalPaid: 0,
                      };

                      return (
                        <tr key={vend.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-semibold text-slate-700">{vend.name}</td>
                          <td className="px-6 py-4 text-slate-500">{vend.phone || 'N/A'}</td>
                          <td className="px-6 py-4 font-medium">Rs. {balInfo.totalPurchases.toLocaleString()}</td>
                          <td className="px-6 py-4 font-medium text-emerald-600">Rs. {balInfo.totalPaid.toLocaleString()}</td>
                          <td className="px-6 py-4 font-bold text-rose-600">
                            {balInfo.outstanding > 0 ? `Rs. ${balInfo.outstanding.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-4 font-bold text-indigo-600">
                            {balInfo.advance > 0 ? `Rs. ${balInfo.advance.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-4">
                            {balInfo.outstanding > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                Outstanding: Rs. {balInfo.outstanding.toLocaleString()}
                              </span>
                            ) : balInfo.advance > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                Advance Available: Rs. {balInfo.advance.toLocaleString()}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                Settled
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 no-print">
                            <button
                              onClick={() => onNavigateToPurchase(vend.id)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold px-2 py-1 rounded transition"
                              title="New Material Purchase"
                            >
                              New Purchase
                            </button>
                            <button
                              onClick={() => handleOpenPayment(vend)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-semibold px-2 py-1 rounded transition"
                              title="Make Payment"
                            >
                              Pay Vendor
                            </button>
                            <button
                              onClick={() => setActiveLedgerVendor(vend)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2 py-1 rounded transition"
                              title="View Ledger Statement"
                            >
                              Statement
                            </button>
                            <button
                              onClick={() => handleOpenForm(vend)}
                              className="text-slate-400 hover:text-indigo-600 transition"
                            >
                              <Edit className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDelete(vend.id)}
                              className="text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredVendors.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">
                          <Truck className="h-10 w-10 mx-auto mb-2 stroke-1" />
                          <p className="text-sm font-medium">
                            {searchQuery ? `No matching vendors found for "${searchQuery}".` : 'No vendors registered.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredVendors.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        <td colSpan={2} className="px-6 py-3 font-black">Grand Totals ({filteredVendors.length} Vendors):</td>
                        <td className="px-6 py-3 font-black text-slate-300">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances?.vendorBalances[v.id]?.totalPurchases || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-black text-emerald-300">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances?.vendorBalances[v.id]?.totalPaid || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-black text-rose-300">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances?.vendorBalances[v.id]?.outstanding || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-black text-indigo-300">
                          Rs. {filteredVendors.reduce((sum, v) => sum + (balances?.vendorBalances[v.id]?.advance || 0), 0).toLocaleString()}
                        </td>
                        <td className="no-print"></td>
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
      )}

      {/* Vendor Ledger View */}
      {activeLedgerVendor && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="flex justify-between items-center no-print border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <span>Statement of Account: {activeLedgerVendor.name} (Supplier)</span>
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePrintLedger()}
                className="flex items-center space-x-2 bg-slate-800 text-white hover:bg-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ledger</span>
              </button>
              <button
                onClick={() => setActiveLedgerVendor(null)}
                className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                Back to List
              </button>
            </div>
          </div>

          {/* Statement Date Filters */}
          <div className="no-print bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-wrap gap-4 items-center justify-between mb-6 text-sm">
            <div className="flex items-center space-x-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={e => setLedgerStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={e => setLedgerEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="text-slate-500 text-xs font-medium">
              Showing Statement: <span className="font-semibold text-slate-800">{ledgerStartDate || 'Opening'}</span> to <span className="font-semibold text-slate-800">{ledgerEndDate || 'Today'}</span>
            </div>
          </div>

          {/* Printable Report Header */}
          <div className="print-a4 print-container space-y-6">
            <div className="text-center pb-4 border-b-2 border-slate-300">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">NORANI KANTA & MATERIALS SUPPLY ERP</h2>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
                VENDOR LEDGER STATEMENT - {activeLedgerVendor.name} ({activeLedgerVendor.id.toUpperCase()})
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-4 px-2">
                <div>
                  Phone: {activeLedgerVendor.phone || 'N/A'} | Current Net Balance: PKR {Math.abs(ledgerClosingBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} {ledgerClosingBalance >= 0 ? 'Cr' : 'Dr'}
                </div>
                <div>
                  Statement Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})} | Total Entries: {vendorLedgerRows.length}
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            <table className="min-w-full text-left text-xs font-mono border-collapse border border-slate-300">
              <thead className="bg-[#800000] text-white uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-3 py-2 border border-slate-300">DATE</th>
                  <th className="px-3 py-2 border border-slate-300">VOUCHER #</th>
                  <th className="px-3 py-2 border border-slate-300">TYPE</th>
                  <th className="px-3 py-2 border border-slate-300">DESCRIPTION</th>
                  <th className="px-3 py-2 text-right border border-slate-300">DEBIT (PKR)</th>
                  <th className="px-3 py-2 text-right border border-slate-300">CREDIT (PKR)</th>
                  <th className="px-3 py-2 text-right border border-slate-300">BALANCE (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 bg-white">
                {vendorLedgerRows.map((row, idx) => {
                  let formattedDate = row.date;
                  const parts = row.date.split('-');
                  if (parts.length === 3) {
                    formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                  }
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 border border-slate-300 whitespace-nowrap text-slate-700">{formattedDate}</td>
                      <td className="px-3 py-2 border border-slate-300 font-bold text-slate-800 whitespace-nowrap">{row.reference}</td>
                      <td className="px-3 py-2 border border-slate-300 font-semibold text-slate-700">{row.type}</td>
                      <td className="px-3 py-2 border border-slate-300 text-slate-800 font-medium">
                        <div>{row.description}</div>
                        {row.itemDetails && (
                          <div className="text-[10px] text-blue-600 font-mono mt-0.5 leading-tight">
                            └─ {row.itemDetails}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right border border-slate-300 text-slate-800 font-semibold">
                        {row.debit > 0 ? row.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right border border-slate-300 text-slate-800 font-semibold">
                        {row.credit > 0 ? row.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right border border-slate-300 font-bold text-slate-900">
                        {Math.abs(row.balance).toLocaleString(undefined, {minimumFractionDigits: 2})} {row.balance >= 0 ? 'Cr' : 'Dr'}
                      </td>
                    </tr>
                  );
                })}
                {vendorLedgerRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-slate-400 border border-slate-300">
                      No statement transactions recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
              {vendorLedgerRows.length > 0 && (
                <tfoot className="bg-slate-200 text-slate-900 font-black border border-slate-300 font-mono">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-left font-black border border-slate-300 uppercase">TOTAL</td>
                    <td className="px-3 py-2 text-right border border-slate-300 font-black">
                      {ledgerTotalDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-3 py-2 text-right border border-slate-300 font-black">
                      {ledgerTotalCredit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-3 py-2 text-right border border-slate-300 font-black">
                      {Math.abs(ledgerClosingBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} {ledgerClosingBalance >= 0 ? 'Cr' : 'Dr'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            
            {/* Required Centered Footer on Printed Documents */}
            <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
              Software by Roonjha Developer - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* Vendor Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 no-print p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  {editingId ? `Edit Vendor: ${name || editingId}` : 'Register New Vendor / Supplier'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingId ? `Account Code: ${editingId}` : 'Register raw material quarry, cement supplier, or fuel vendor'}
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-1">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">1. Basic Information</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Vendor Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Lucky Sand Supplies"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. 0321-7654321"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                      placeholder="e.g. Tariq Mehmood"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Vendor Category
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Sand Quarry">Sand Quarry / Riverbed</option>
                      <option value="Crush Plant">Crush / Gravel Plant</option>
                      <option value="Cement Factory">Cement Factory / Dealer</option>
                      <option value="Fuel Supplier">Fuel / Diesel Station</option>
                      <option value="Supplier">General Material Supplier</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Tax & Location Details */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-1">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">2. Tax & Location Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      NTN (National Tax No.)
                    </label>
                    <input
                      type="text"
                      value={ntn}
                      onChange={e => setNtn(e.target.value)}
                      placeholder="e.g. 7654321-0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      STRN (Sales Tax Reg No.)
                    </label>
                    <input
                      type="text"
                      value={strn}
                      onChange={e => setStrn(e.target.value)}
                      placeholder="e.g. 02-03-5678-901-02"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Quarry / Plant Area
                    </label>
                    <input
                      type="text"
                      value={area}
                      onChange={e => setArea(e.target.value)}
                      placeholder="e.g. Hub River, Manghopir"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Office / Quarry Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Street Address, City"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Credit Terms & Initial Balance */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-1">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">3. Credit Terms & Initial Balance</span>
                </div>

                {/* Dual Inputs: Outstanding & Advance */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
                        Outstanding / Payable (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formOutstanding}
                        onChange={e => setFormOutstanding(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm font-semibold text-rose-800 bg-white focus:outline-none focus:border-rose-500 shadow-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Previous unpaid balance we owe to vendor</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                        Advance Paid (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formAdvance}
                        onChange={e => setFormAdvance(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-800 bg-white focus:outline-none focus:border-emerald-500 shadow-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Advance money we already paid to vendor</p>
                    </div>
                  </div>

                  {/* Dynamic Action / Status preview based on entered values */}
                  <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Initial Account Status:</span>
                    {(() => {
                      const outVal = Number(formOutstanding) || 0;
                      const advVal = Number(formAdvance) || 0;
                      const net = outVal - advVal;
                      if (net > 0) {
                        return (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            ⚠️ Outstanding: Rs. {net.toLocaleString()}
                          </span>
                        );
                      } else if (net < 0) {
                        return (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✅ Advance Available: Rs. {Math.abs(net).toLocaleString()}
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            ✓ Settled
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Credit Payment Days
                    </label>
                    <input
                      type="number"
                      value={creditDays}
                      onChange={e => setCreditDays(Number(e.target.value))}
                      placeholder="30"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Notes / Terms
                    </label>
                    <input
                      type="text"
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      placeholder="Quarry rates, weighing scale terms..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: System-Calculated Live Financial Status (Read-Only) */}
              {(() => {
                const numOutstanding = Number(formOutstanding) || 0;
                const numAdvance = Number(formAdvance) || 0;
                const formNet = numOutstanding - numAdvance;

                const vendBalInfo = editingId && balances?.vendorBalances[editingId]
                  ? balances.vendorBalances[editingId]
                  : null;
                const activeVendBal = vendBalInfo ? vendBalInfo.netBalance : formNet;
                const vendPayable = vendBalInfo ? vendBalInfo.outstanding : (activeVendBal > 0 ? activeVendBal : 0);
                const vendAdvance = vendBalInfo ? vendBalInfo.advance : (activeVendBal < 0 ? Math.abs(activeVendBal) : 0);
                const vendStatus = vendPayable > 0 
                  ? 'Outstanding' 
                  : vendAdvance > 0 
                  ? 'Advance Available' 
                  : 'Settled';

                return (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        4. System-Calculated Live Financial Summary
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Derived live from purchase transactions & ledger
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Vendor Payable</p>
                        <p className="text-base font-black text-rose-600 mt-0.5">
                          Rs. {vendPayable.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Advance Balance</p>
                        <p className="text-base font-black text-emerald-600 mt-0.5">
                          Rs. {vendAdvance.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Net Balance</p>
                        <p className="text-base font-black text-slate-800 mt-0.5">
                          Rs. {Math.abs(activeVendBal).toLocaleString()} {activeVendBal >= 0 ? 'Cr' : 'Dr'}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Account Status</p>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            vendStatus === 'Advance Available' ? 'bg-emerald-100 text-emerald-800' :
                            vendStatus === 'Outstanding' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {vendStatus === 'Advance Available' ? '✅ Advance Available' :
                             vendStatus === 'Outstanding' ? '⚠️ Outstanding' :
                             '✓ Settled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      Note: Payable, Advance, Net Balance, and Account Status cannot be manually typed; they update dynamically based on material purchases, returns, and payment vouchers.
                    </p>
                  </div>
                );
              })()}

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
                  {editingId ? 'Save Changes' : 'Create Vendor Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendor Payment Modal */}
      {isPaymentOpen && paymentVendor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                Payment Voucher to Vendor
              </h3>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                <p className="text-slate-500 font-medium">Vendor: <span className="font-bold text-slate-800">{paymentVendor.name}</span></p>
                <p className="text-slate-500 font-medium mt-1">Outstanding Payable: 
                  <span className="font-bold text-rose-600 ml-1">
                    Rs. {(balances?.vendorBalances[paymentVendor.id]?.outstanding || 0).toLocaleString()}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Amount Paid (Rs.)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Payment Channel
                  </label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>

                {paymentType === 'Bank' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Source Bank Account
                    </label>
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

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Reference / Check Number
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. Check #, Online Ref"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Internal notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Payment details"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
