import React, { useEffect, useState } from 'react';
import { getAllRecords, putRecord, deleteRecord, DBCustomer, DBLedgerEntry, DBBank, DBVoucher, DBTrip, DBSale, DBItem } from '../db/firestore';
import { calculateLiveBalances, LiveBalances, saveVoucherTransaction } from '../db/transactions';
import { User, Phone, MapPin, ShieldAlert, CreditCard, Receipt, FileText, Plus, Edit, Trash, Printer, Search, X } from 'lucide-react';
import Pagination from './Pagination';

interface CustomersProps {
  onNavigateToPOS: (customerId: string) => void;
}

export default function Customers({ onNavigateToPOS }: CustomersProps) {
  const [customers, setCustomers] = useState<DBCustomer[]>([]);
  const [banks, setBanks] = useState<DBBank[]>([]);
  const [balances, setBalances] = useState<LiveBalances | null>(null);
  const [ledgers, setLedgers] = useState<DBLedgerEntry[]>([]);
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [sales, setSales] = useState<DBSale[]>([]);
  const [items, setItems] = useState<DBItem[]>([]);
  const [vouchers, setVouchers] = useState<DBVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [activeLedgerCustomer, setActiveLedgerCustomer] = useState<DBCustomer | null>(null);
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
  const [creditLimit, setCreditLimit] = useState(100000);
  const [contactPerson, setContactPerson] = useState('');
  const [category, setCategory] = useState('Retail');
  const [ntn, setNtn] = useState('');
  const [strn, setStrn] = useState('');
  const [creditDays, setCreditDays] = useState(30);
  const [formNotes, setFormNotes] = useState('');

  // Payment Receipt State
  const [receiptCustomer, setReceiptCustomer] = useState<DBCustomer | null>(null);
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank'>('Cash');
  const [bankId, setBankId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const allCustomers = await getAllRecords<DBCustomer>('customers');
      const allBanks = await getAllRecords<DBBank>('banks');
      const liveBal = await calculateLiveBalances();
      const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
      const allTrips = await getAllRecords<DBTrip>('trips');
      const allSales = await getAllRecords<DBSale>('sales');
      const allItems = await getAllRecords<DBItem>('items');
      const allVouchers = await getAllRecords<DBVoucher>('vouchers');
      
      setCustomers(allCustomers);
      setBanks(allBanks);
      setBalances(liveBal);
      setLedgers(allLedgers);
      setTrips(allTrips);
      setSales(allSales);
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

  const handleOpenForm = (cust?: DBCustomer) => {
    if (cust) {
      setEditingId(cust.id);
      setName(cust.name);
      setPhone(cust.phone);
      setAddress(cust.address);
      setArea(cust.area);
      const ob = cust.openingBalance || 0;
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
      setCreditLimit(cust.creditLimit);
      setContactPerson(cust.contactPerson || '');
      setCategory(cust.category || 'Retail');
      setNtn(cust.ntn || '');
      setStrn(cust.strn || '');
      setCreditDays(cust.creditDays || 30);
      setFormNotes(cust.notes || '');
    } else {
      setEditingId(null);
      setName('');
      setPhone('');
      setAddress('');
      setArea('');
      setOpeningBalance(0);
      setFormOutstanding('');
      setFormAdvance('');
      setCreditLimit(100000);
      setContactPerson('');
      setCategory('Retail');
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
      alert('Please enter a valid Customer Name. Whitespace-only names are not allowed.');
      return;
    }
    if (!cleanPhone) {
      alert('Please enter a valid Phone Number for the customer.');
      return;
    }
    if (cleanPhone.length < 7) {
      alert('Phone number must be at least 7 characters (e.g. 0300-1234567).');
      return;
    }

    let custId = editingId;
    if (!custId) {
      const prefix = 'cus-';
      const existingIds = customers.map(c => c.id).filter(id => id.startsWith(prefix));
      let maxNum = 0;
      for (const id of existingIds) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
      const nextNum = maxNum + 1;
      custId = `${prefix}${String(nextNum).padStart(3, '0')}`;
    }
    const numOutstanding = Number(formOutstanding) || 0;
    const numAdvance = Number(formAdvance) || 0;
    const netOpening = numOutstanding - numAdvance;

    const savedCustomer: DBCustomer = {
      id: custId,
      name: cleanName,
      phone: cleanPhone,
      address: address.trim(),
      area: area.trim(),
      openingBalance: netOpening,
      creditLimit: Number(creditLimit),
      contactPerson: contactPerson.trim(),
      category: category,
      ntn: ntn.trim(),
      strn: strn.trim(),
      creditDays: Number(creditDays) || 0,
      notes: formNotes.trim(),
    };

    await putRecord<DBCustomer>('customers', savedCustomer);

    // Opening balance ledger registration
    const opEntryId = 'opening-cust-' + custId;
    
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
        accountId: custId,
        accountType: 'customer',
        debit: netOpening > 0 ? netOpening : 0,
        credit: netOpening < 0 ? Math.abs(netOpening) : 0,
        description: 'Opening Balance adjustment',
      });
    }

    setIsFormOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer? This will clear profile details.')) {
      await deleteRecord('customers', id);
      
      // Clean ledger of opening balance
      const opEntryId = 'opening-cust-' + id;
      const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
      for (const entry of allLedgers) {
        if (entry.referenceId === opEntryId || entry.accountId === id) {
          await deleteRecord('ledgers', entry.id);
        }
      }
      
      loadData();
    }
  };

  const handleOpenReceipt = (cust: DBCustomer) => {
    setReceiptCustomer(cust);
    setReceiptAmount(0);
    setPaymentType('Cash');
    setReference('');
    setNotes('');
    setIsReceiptOpen(true);
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptCustomer || receiptAmount <= 0) return;

    const allVouchers = await getAllRecords<DBVoucher>('vouchers');
    const prefix = paymentType === 'Bank' ? 'bank-' : 'cash-';
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
      type: 'receipt',
      partyType: 'customer',
      partyId: receiptCustomer.id,
      paymentType,
      bankId: paymentType === 'Bank' ? bankId : undefined,
      amount: Number(receiptAmount),
      reference: reference.trim() || voucherId,
      notes,
    };

    await saveVoucherTransaction(voucher);
    setIsReceiptOpen(false);
    loadData();
  };

  const handlePrintLedger = () => {
    window.print();
  };

  if (loading) {
    return <div className="text-center py-6">Loading customers database...</div>;
  }

  // Get active ledger logs
  let customerLedgerRows: {
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

  if (activeLedgerCustomer) {
    const custId = activeLedgerCustomer.id;
    const custLedgerEntries = ledgers.filter(l => l.accountId === custId);
    
    // Sort by date then ID
    custLedgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // 1. Calculate opening balance before ledgerStartDate
    let preBalance = 0;
    const prePeriodEntries = custLedgerEntries.filter(e => ledgerStartDate && e.date < ledgerStartDate);
    preBalance = prePeriodEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
    ledgerOpeningBalance = preBalance;

    // 2. Filter entries within date range
    const periodEntries = custLedgerEntries.filter(e => 
      (!ledgerStartDate || e.date >= ledgerStartDate) && 
      (!ledgerEndDate || e.date <= ledgerEndDate)
    );

    let runningBal = preBalance;
    
    // Insert Opening Balance row at the beginning
    customerLedgerRows.push({
      date: ledgerStartDate || 'Start',
      reference: 'OP-BAL',
      type: 'OPENING',
      description: 'Opening Balance Carried Forward',
      debit: preBalance > 0 ? preBalance : 0,
      credit: preBalance < 0 ? Math.abs(preBalance) : 0,
      advance: preBalance < 0 ? Math.abs(preBalance) : 0,
      outstanding: preBalance > 0 ? preBalance : 0,
      balance: preBalance,
    });

    for (const entry of periodEntries) {
      runningBal += (entry.debit - entry.credit);
      ledgerTotalDebit += entry.debit;
      ledgerTotalCredit += entry.credit;

      let itemDetails = '';
      if (entry.type === 'trip') {
        const trip = trips.find(t => t.id === entry.referenceId);
        if (trip) {
          if (trip.items && trip.items.length > 0) {
            itemDetails = trip.items.map(i => {
              const itemObj = items.find(it => it.id === i.itemId);
              return `${itemObj?.name || i.itemName || i.itemId} (${i.quantity} ${i.unit} @ Rs.${i.rate.toLocaleString()})`;
            }).join(' + ');
          } else {
            const itemObj = items.find(i => i.id === trip.itemId);
            itemDetails = `Item: ${itemObj?.name || trip.itemId} | Qty: ${trip.quantity} ${trip.unit} | Price/Unit: Rs.${trip.rate.toLocaleString()} | Amount: Rs.${trip.materialTotal.toLocaleString()}`;
          }
          if (trip.discount > 0) {
            itemDetails += ` | Discount: Rs.${trip.discount.toLocaleString()}`;
          }
        }
      } else if (entry.type === 'sale') {
        const sale = sales.find(s => s.id === entry.referenceId);
        if (sale) {
          const itemObj = items.find(i => i.id === sale.itemId);
          itemDetails = `Item: ${itemObj?.name || sale.itemId} | Qty: ${sale.quantity} ${itemObj?.unit || ''} | Price/Unit: Rs.${sale.rate.toLocaleString()} | Amount: Rs.${(sale.quantity * sale.rate).toLocaleString()}`;
          if (sale.discount > 0) {
            itemDetails += ` | Discount: Rs.${sale.discount.toLocaleString()}`;
          }
        }
      }

      let displayRef = entry.referenceId || '—';
      if (displayRef.startsWith('rcpt-') || displayRef.startsWith('vch-')) {
        const match = vouchers.find(v => v.id === entry.referenceId || v.reference === entry.referenceId);
        displayRef = match ? match.id : (entry.description.toLowerCase().includes('bank') ? 'bank-001' : 'cash-001');
      }

      customerLedgerRows.push({
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
  const filteredCustomers = customers.filter(cust => {
    if (!cleanSearch) return true;
    return (
      cust.name.toLowerCase().includes(cleanSearch) ||
      cust.id.toLowerCase().includes(cleanSearch) ||
      (cust.phone && cust.phone.toLowerCase().includes(cleanSearch)) ||
      (cust.area && cust.area.toLowerCase().includes(cleanSearch))
    );
  });

  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* List Page */}
      {!activeLedgerCustomer && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Customers Directory & Accounts</h2>
              <p className="text-sm text-slate-500">Manage customer files, credits, and ledger payments</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search customer..."
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
                <span>Add New Customer</span>
              </button>
            </div>
          </div>

          <div className="print-a4 print-container space-y-4">
            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-300">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h1>
                  <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul & Son's (03458829298)</p>
                  <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
                CUSTOMERS ACCOUNTS & BALANCES DIRECTORY
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-3 px-2">
                <div>Total Customers: {customers.length}</div>
                <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* Directory Grid */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Customer Name</th>
                      <th className="px-6 py-4">Contact Info</th>
                      <th className="px-6 py-4">Area / Region</th>
                      <th className="px-6 py-4">Total Sales</th>
                      <th className="px-6 py-4">Total Paid</th>
                      <th className="px-6 py-4">Outstanding Bal</th>
                      <th className="px-6 py-4">Advance Bal</th>
                      <th className="px-6 py-4">Account Status</th>
                      <th className="px-6 py-4 text-right no-print">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedCustomers.map(cust => {
                      const balInfo = balances?.customerBalances[cust.id] || {
                        outstanding: 0,
                        advance: 0,
                        totalSales: 0,
                        totalReceived: 0,
                      };

                      return (
                        <tr key={cust.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-semibold text-slate-700">{cust.name}</td>
                          <td className="px-6 py-4 text-slate-500">{cust.phone || 'N/A'}</td>
                          <td className="px-6 py-4 text-slate-500">{cust.area || 'N/A'}</td>
                          <td className="px-6 py-4 font-medium">Rs. {balInfo.totalSales.toLocaleString()}</td>
                          <td className="px-6 py-4 font-medium text-emerald-600">Rs. {balInfo.totalReceived.toLocaleString()}</td>
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
                              onClick={() => onNavigateToPOS(cust.id)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold px-2 py-1 rounded transition"
                              title="New POS Sale"
                            >
                              New Sale
                            </button>
                            <button
                              onClick={() => handleOpenReceipt(cust)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-semibold px-2 py-1 rounded transition"
                              title="Receive Payment"
                            >
                              Receive Payment
                            </button>
                            <button
                              onClick={() => setActiveLedgerCustomer(cust)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2 py-1 rounded transition"
                              title="View Ledger Statement"
                            >
                              Statement
                            </button>
                            <button
                              onClick={() => handleOpenForm(cust)}
                              className="text-slate-400 hover:text-indigo-600 transition"
                            >
                              <Edit className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDelete(cust.id)}
                              className="text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400">
                          <User className="h-10 w-10 mx-auto mb-2 stroke-1" />
                          <p className="text-sm font-medium">
                            {searchQuery ? `No matching customers found for "${searchQuery}".` : 'No customers registered.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredCustomers.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        <td colSpan={3} className="px-6 py-3 font-black">Grand Totals ({filteredCustomers.length} Customers):</td>
                        <td className="px-6 py-3 font-black text-slate-300">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances?.customerBalances[c.id]?.totalSales || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-black text-emerald-300">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances?.customerBalances[c.id]?.totalReceived || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-black text-rose-300">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances?.customerBalances[c.id]?.outstanding || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-black text-indigo-300">
                          Rs. {filteredCustomers.reduce((sum, c) => sum + (balances?.customerBalances[c.id]?.advance || 0), 0).toLocaleString()}
                        </td>
                        <td className="no-print"></td>
                        <td className="no-print"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <Pagination
                currentPage={currentPage}
                totalItems={filteredCustomers.length}
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

      {/* Customer Ledger print-friendly view */}
      {activeLedgerCustomer && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="flex justify-between items-center no-print border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <span>Statement of Account: {activeLedgerCustomer.name}</span>
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
                onClick={() => setActiveLedgerCustomer(null)}
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
              <div className="flex items-center justify-center space-x-3 mb-2">
                <img src="/logo.jpeg" alt="Logo" className="h-14 w-auto object-contain" />
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">AL-MADINA CONSTRUCTION COMPANY</h1>
                  <p className="text-xs text-slate-700 font-bold">Proprietor: Haji Gul & Son's (03458829298)</p>
                  <p className="text-[11px] text-slate-600">Haji Ahmad Khan: 03453322228 | Hafeez Khan: 03109777753 (WhatsApp)</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">
                CUSTOMER LEDGER STATEMENT - {activeLedgerCustomer.name} ({activeLedgerCustomer.id.toUpperCase()})
              </p>
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 mt-4 px-2">
                <div>
                  Phone: {activeLedgerCustomer.phone || 'N/A'} | Current Net Balance: PKR {Math.abs(ledgerClosingBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} {ledgerClosingBalance >= 0 ? 'Dr' : 'Cr'}
                </div>
                <div>
                  Statement Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})} | Total Entries: {customerLedgerRows.length}
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
                {customerLedgerRows.map((row, idx) => {
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
                        {Math.abs(row.balance).toLocaleString(undefined, {minimumFractionDigits: 2})} {row.balance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  );
                })}
                {customerLedgerRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-slate-400 border border-slate-300">
                      No statement transactions recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
              {customerLedgerRows.length > 0 && (
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
                      {Math.abs(ledgerClosingBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} {ledgerClosingBalance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            
            {/* Required Centered Footer on Printed Documents */}
            <div className="print-footer text-center mt-6 text-xs text-slate-500 font-mono">
              Software by Roonjha Developers - 03152914836
            </div>
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 no-print p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  {editingId ? `Edit Customer: ${name || editingId}` : 'Register New Customer Account'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingId ? `Account Code: ${editingId}` : 'Create a new customer profile with credit and ledger settings'}
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
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Ali Traders & Co"
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
                      placeholder="e.g. 0300-1234567"
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
                      placeholder="e.g. Muhammad Ali"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Customer Category
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Retail">Retail Customer</option>
                      <option value="Wholesale">Wholesale Client</option>
                      <option value="Corporate">Corporate / Contractor</option>
                      <option value="Walk-in">Walk-in Customer</option>
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
                      placeholder="e.g. 1234567-8"
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
                      placeholder="e.g. 01-02-3456-789-01"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Area / Sector / City
                    </label>
                    <input
                      type="text"
                      value={area}
                      onChange={e => setArea(e.target.value)}
                      placeholder="e.g. Industrial Area, Hub"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Full Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Plot No, Street, City"
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
                        Outstanding Balance (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formOutstanding}
                        onChange={e => setFormOutstanding(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm font-semibold text-rose-800 bg-white focus:outline-none focus:border-rose-500 shadow-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Previous unpaid balance customer owes to us</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                        Advance Balance (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formAdvance}
                        onChange={e => setFormAdvance(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-800 bg-white focus:outline-none focus:border-emerald-500 shadow-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Advance payment received from customer</p>
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
                      Credit Limit (Rs.)
                    </label>
                    <input
                      type="number"
                      value={creditLimit}
                      onChange={e => setCreditLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Credit Days
                    </label>
                    <input
                      type="number"
                      value={creditDays}
                      onChange={e => setCreditDays(Number(e.target.value))}
                      placeholder="30"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Any specific delivery instructions or terms..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Section 4: System-Calculated Live Financial Status (Read-Only) */}
              {(() => {
                const numOutstanding = Number(formOutstanding) || 0;
                const numAdvance = Number(formAdvance) || 0;
                const formNet = numOutstanding - numAdvance;

                const custBalInfo = editingId && balances?.customerBalances[editingId]
                  ? balances.customerBalances[editingId]
                  : null;
                const activeCustBal = custBalInfo ? custBalInfo.netBalance : formNet;
                const custReceivable = custBalInfo ? custBalInfo.outstanding : (activeCustBal > 0 ? activeCustBal : 0);
                const custAdvance = custBalInfo ? custBalInfo.advance : (activeCustBal < 0 ? Math.abs(activeCustBal) : 0);
                const custStatus = custReceivable > 0 
                  ? 'Outstanding' 
                  : custAdvance > 0 
                  ? 'Advance Available' 
                  : 'Settled';

                return (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        4. System-Calculated Live Financial Summary
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Derived live from transactions & ledger
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Customer Receivable</p>
                        <p className="text-base font-black text-rose-600 mt-0.5">
                          Rs. {custReceivable.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Advance Balance</p>
                        <p className="text-base font-black text-emerald-600 mt-0.5">
                          Rs. {custAdvance.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Net Balance</p>
                        <p className="text-base font-black text-slate-800 mt-0.5">
                          Rs. {Math.abs(activeCustBal).toLocaleString()} {activeCustBal >= 0 ? 'Dr' : 'Cr'}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Account Status</p>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            custStatus === 'Advance Available' ? 'bg-emerald-100 text-emerald-800' :
                            custStatus === 'Outstanding' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {custStatus === 'Advance Available' ? '✅ Advance Available' :
                             custStatus === 'Outstanding' ? '⚠️ Outstanding' :
                             '✓ Settled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      Note: Receivable, Advance, Net Balance, and Account Status cannot be manually typed; they update dynamically based on trip dispatches, POS invoices, returns, and payment receipts.
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
                  {editingId ? 'Save Changes' : 'Create Customer Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {isReceiptOpen && receiptCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                Receive Payment Voucher
              </h3>
              <button
                onClick={() => setIsReceiptOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveReceipt} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                <p className="text-slate-500 font-medium">Customer: <span className="font-bold text-slate-800">{receiptCustomer.name}</span></p>
                <p className="text-slate-500 font-medium mt-1">Outstanding: 
                  <span className="font-bold text-rose-600 ml-1">
                    Rs. {(balances?.customerBalances[receiptCustomer.id]?.outstanding || 0).toLocaleString()}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Amount Received (Rs.)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={receiptAmount}
                  onChange={e => setReceiptAmount(Number(e.target.value))}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Receipt Channel
                  </label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Deposit</option>
                  </select>
                </div>

                {paymentType === 'Bank' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Target Bank
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
                  Reference / Slip Number
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. Check #, online ref"
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
                  placeholder="e.g. Cash clearing"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(false)}
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
