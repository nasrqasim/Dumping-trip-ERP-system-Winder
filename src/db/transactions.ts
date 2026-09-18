import {
  getAllRecords,
  putRecord,
  deleteRecord,
  getRecordById,
  DBItem,
  DBCustomer,
  DBVendor,
  DBVehicle,
  DBBank,
  DBStaff,
  DBTrip,
  DBPurchase,
  DBSale,
  DBLedgerEntry,
  DBInventoryLedgerEntry,
  DBGeneralExpense,
  DBOtherIncome,
  DBStaffPayment,
  DBVoucher,
  DBTripItem,
  DBDirectPurchase,
  DBDieselTransaction,
  DBDieselUsage,
  DBVehicleMaintenance,
  DBDriverAdvance,
  DBDriverExpenseSubmission,
  DBDriverAssignment
} from './firestore';

// ==========================================
// LIVE BALANCE CALCULATIONS
// ==========================================

export interface LiveBalances {
  cashBalance: number;
  bankBalances: { [bankId: string]: number };
  totalBankBalance: number;
  customerBalances: {
    [customerId: string]: {
      outstanding: number;
      advance: number;
      netBalance: number;
      totalSales: number;
      totalReceived: number;
    }
  };
  vendorBalances: {
    [vendorId: string]: {
      outstanding: number;
      advance: number;
      netBalance: number;
      totalPurchases: number;
      totalPaid: number;
    }
  };
  itemStocks: { [itemId: string]: number };
  staffBalances: {
    [staffId: string]: {
      advanceLoanBalance: number; // positive means they owe us
    }
  };
}

export async function migrateLegacyVouchers(): Promise<void> {
  try {
    const vouchers = await getAllRecords<DBVoucher>('vouchers');
    const legacyVouchers = vouchers.filter(v => 
      v.id && !v.id.startsWith('cash-') && !v.id.startsWith('pay-') && !v.id.startsWith('bank-')
    );

    const ledgers = await getAllRecords<DBLedgerEntry>('ledgers');
    const legacyLedgers = ledgers.filter(l => 
      l.referenceId && (l.referenceId.startsWith('vch-') || l.referenceId.startsWith('rcpt-') || l.referenceId.startsWith('pymt-'))
    );

    if (legacyVouchers.length === 0 && legacyLedgers.length === 0) {
      return;
    }

    let maxCash = 0;
    let maxPay = 0;
    let maxBank = 0;

    for (const v of vouchers) {
      if (v.id.startsWith('cash-')) {
        const n = parseInt(v.id.replace('cash-', ''), 10);
        if (!isNaN(n) && n > maxCash) maxCash = n;
      } else if (v.id.startsWith('pay-')) {
        const n = parseInt(v.id.replace('pay-', ''), 10);
        if (!isNaN(n) && n > maxPay) maxPay = n;
      } else if (v.id.startsWith('bank-')) {
        const n = parseInt(v.id.replace('bank-', ''), 10);
        if (!isNaN(n) && n > maxBank) maxBank = n;
      }
    }

    // Sort legacy vouchers chronologically
    legacyVouchers.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const v of legacyVouchers) {
      const oldId = v.id;
      let newId = '';
      if (v.paymentType === 'Bank' || v.bankId) {
        maxBank++;
        newId = `bank-${String(maxBank).padStart(3, '0')}`;
      } else if (v.type === 'payment' || v.partyType === 'vendor') {
        maxPay++;
        newId = `pay-${String(maxPay).padStart(3, '0')}`;
      } else {
        maxCash++;
        newId = `cash-${String(maxCash).padStart(3, '0')}`;
      }

      const updatedVoucher: DBVoucher = {
        ...v,
        id: newId,
        reference: (!v.reference || v.reference === oldId || v.reference.startsWith('vch-')) ? newId : v.reference
      };

      await deleteRecord('vouchers', oldId);
      await putRecord<DBVoucher>('vouchers', updatedVoucher);

      // Update corresponding ledgers
      const related = ledgers.filter(l => l.referenceId === oldId);
      for (const l of related) {
        await putRecord<DBLedgerEntry>('ledgers', {
          ...l,
          referenceId: newId,
          description: l.description.replace(oldId, newId)
        });
      }
    }

    // Also migrate any orphaned legacy ledger reference IDs
    const updatedLedgers = await getAllRecords<DBLedgerEntry>('ledgers');
    for (const l of updatedLedgers) {
      if (l.referenceId && (l.referenceId.startsWith('vch-') || l.referenceId.startsWith('rcpt-') || l.referenceId.startsWith('pymt-'))) {
        const isBank = l.accountType === 'bank' || l.description.toLowerCase().includes('bank');
        const isPayment = l.type === 'cash_payment' || l.accountType === 'vendor' || l.description.toLowerCase().includes('payment');
        let newId = '';
        if (isBank) {
          maxBank++;
          newId = `bank-${String(maxBank).padStart(3, '0')}`;
        } else if (isPayment) {
          maxPay++;
          newId = `pay-${String(maxPay).padStart(3, '0')}`;
        } else {
          maxCash++;
          newId = `cash-${String(maxCash).padStart(3, '0')}`;
        }
        await putRecord<DBLedgerEntry>('ledgers', {
          ...l,
          referenceId: newId,
          description: l.description.replace(l.referenceId, newId)
        });
      }
    }
  } catch (err) {
    console.error('Error during voucher migration:', err);
  }
}

export async function migrateLegacyStaffAndPayments(): Promise<void> {
  try {
    const allStaff = await getAllRecords<DBStaff>('staff');
    const allPayments = await getAllRecords<DBStaffPayment>('staff_payments');
    const allLedgers = await getAllRecords<DBLedgerEntry>('ledgers');

    // Sequential format checks
    const isSequentialStaff = (id: string) => /^staf-\d{3,}$/.test(id);
    const isSequentialPay = (id: string) => /^pay-\d{3,}$/.test(id);

    const legacyStaff = allStaff.filter(s => !isSequentialStaff(s.id));
    const legacyPayments = allPayments.filter(p => !isSequentialPay(p.id));

    if (legacyStaff.length === 0 && legacyPayments.length === 0) {
      return;
    }

    // Determine current max number for sequential staff
    let maxStaffNum = 0;
    for (const s of allStaff) {
      if (isSequentialStaff(s.id)) {
        const n = parseInt(s.id.replace('staf-', ''), 10);
        if (!isNaN(n) && n > maxStaffNum) maxStaffNum = n;
      }
    }

    // Determine current max number for sequential payments
    const allVouchers = await getAllRecords<DBVoucher>('vouchers');
    let maxPayNum = 0;
    for (const p of allPayments) {
      if (isSequentialPay(p.id)) {
        const n = parseInt(p.id.replace('pay-', ''), 10);
        if (!isNaN(n) && n > maxPayNum) maxPayNum = n;
      }
    }
    for (const v of allVouchers) {
      if (v.id && v.id.startsWith('pay-')) {
        const n = parseInt(v.id.replace('pay-', ''), 10);
        if (!isNaN(n) && n > maxPayNum) maxPayNum = n;
      }
    }

    // 1. Migrate legacy staff
    for (const st of legacyStaff) {
      const oldId = st.id;
      maxStaffNum++;
      const newId = `staf-${String(maxStaffNum).padStart(3, '0')}`;

      await deleteRecord('staff', oldId);
      await putRecord<DBStaff>('staff', {
        ...st,
        id: newId
      });

      // Update in payments
      for (const p of allPayments) {
        if (p.staffId === oldId) {
          p.staffId = newId;
          await putRecord<DBStaffPayment>('staff_payments', p);
        }
      }

      // Update in ledgers
      for (const l of allLedgers) {
        if (l.accountId === oldId && l.accountType === 'staff') {
          await putRecord<DBLedgerEntry>('ledgers', {
            ...l,
            accountId: newId
          });
        }
      }
    }

    // 2. Migrate legacy payments (sort ascending so earliest gets pay-001)
    legacyPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const pmt of legacyPayments) {
      const oldPayId = pmt.id;
      maxPayNum++;
      const newPayId = `pay-${String(maxPayNum).padStart(3, '0')}`;

      await deleteRecord('staff_payments', oldPayId);
      await putRecord<DBStaffPayment>('staff_payments', {
        ...pmt,
        id: newPayId
      });

      // Update in ledgers
      for (const l of allLedgers) {
        if (l.referenceId === oldPayId) {
          await putRecord<DBLedgerEntry>('ledgers', {
            ...l,
            referenceId: newPayId
          });
        }
      }
    }
  } catch (err) {
    console.error('Error during staff and payment migration:', err);
  }
}

let hasRunLegacyMigrations = false;
export async function runStartupMigrationsOnce(): Promise<void> {
  if (hasRunLegacyMigrations) return;
  hasRunLegacyMigrations = true;
  await migrateLegacyVouchers();
  await migrateLegacyStaffAndPayments();
}

export interface PreloadedBalanceData {
  ledgers?: DBLedgerEntry[];
  inventoryEntries?: DBInventoryLedgerEntry[];
  customers?: DBCustomer[];
  vendors?: DBVendor[];
  banks?: DBBank[];
  items?: DBItem[];
  staff?: DBStaff[];
}

export async function calculateLiveBalances(preloadedData?: PreloadedBalanceData): Promise<LiveBalances> {
  if (!hasRunLegacyMigrations) {
    await runStartupMigrationsOnce();
  }

  const [
    ledgers,
    inventoryEntries,
    customers,
    vendors,
    banks,
    items,
    staff
  ] = await Promise.all([
    preloadedData?.ledgers ?? getAllRecords<DBLedgerEntry>('ledgers'),
    preloadedData?.inventoryEntries ?? getAllRecords<DBInventoryLedgerEntry>('inventory_ledger'),
    preloadedData?.customers ?? getAllRecords<DBCustomer>('customers'),
    preloadedData?.vendors ?? getAllRecords<DBVendor>('vendors'),
    preloadedData?.banks ?? getAllRecords<DBBank>('banks'),
    preloadedData?.items ?? getAllRecords<DBItem>('items'),
    preloadedData?.staff ?? getAllRecords<DBStaff>('staff'),
  ]);

  // Initialize stocks
  const itemStocks: { [itemId: string]: number } = {};
  for (const item of items) {
    itemStocks[item.id] = 0;
  }
  for (const entry of inventoryEntries) {
    if (itemStocks[entry.itemId] === undefined) itemStocks[entry.itemId] = 0;
    itemStocks[entry.itemId] += (entry.qtyIn - entry.qtyOut);
  }

  // Initialize bank balances
  const bankBalances: { [bankId: string]: number } = {};
  let totalBankBalance = 0;
  for (const bank of banks) {
    bankBalances[bank.id] = bank.openingBalance || 0;
  }

  // Initialize customer balances
  const customerBalances: {
    [customerId: string]: {
      outstanding: number;
      advance: number;
      netBalance: number;
      totalSales: number;
      totalReceived: number;
    }
  } = {};
  for (const cust of customers) {
    customerBalances[cust.id] = {
      outstanding: 0,
      advance: 0,
      netBalance: cust.openingBalance || 0,
      totalSales: 0,
      totalReceived: 0,
    };
  }

  // Initialize vendor balances
  const vendorBalances: {
    [vendorId: string]: {
      outstanding: number;
      advance: number;
      netBalance: number;
      totalPurchases: number;
      totalPaid: number;
    }
  } = {};
  for (const vend of vendors) {
    vendorBalances[vend.id] = {
      outstanding: 0,
      advance: 0,
      netBalance: vend.openingBalance || 0,
      totalPurchases: 0,
      totalPaid: 0,
    };
  }

  // Initialize staff balances
  const staffBalances: { [staffId: string]: { advanceLoanBalance: number } } = {};
  for (const st of staff) {
    staffBalances[st.id] = { advanceLoanBalance: 0 };
  }

  let cashBalance = 0;

  // Process unified ledger
  for (const entry of ledgers) {
    const amt = entry.debit - entry.credit;

    // Skip opening balance entries for banks, customers, and vendors to prevent double counting,
    // because their initial balances are already seeded above from bank.openingBalance, cust.openingBalance, and vend.openingBalance.
    if (entry.type === 'opening' || (entry.referenceId && entry.referenceId.startsWith('opening-'))) {
      if (entry.accountId === 'cash') {
        cashBalance += amt;
      }
      continue;
    }

    if (entry.accountId === 'cash') {
      cashBalance += amt;
    } else if (bankBalances[entry.accountId] !== undefined) {
      bankBalances[entry.accountId] += amt;
    } else if (customerBalances[entry.accountId] !== undefined) {
      // For customer, positive net balance = outstanding receivable, negative = advance
      customerBalances[entry.accountId].netBalance += amt;
      
      // Calculate total sales and total received from transactions
      // Sales/Trips debit customer account. Receipts credit customer account.
      if (entry.debit > 0) {
        customerBalances[entry.accountId].totalSales += entry.debit;
      }
      if (entry.credit > 0) {
        customerBalances[entry.accountId].totalReceived += entry.credit;
      }
    } else if (vendorBalances[entry.accountId] !== undefined) {
      // For vendors, positive net balance = outstanding payable, negative = advance
      // Vendor ledger increases with Credit (purchases) and decreases with Debit (payments)
      vendorBalances[entry.accountId].netBalance += (entry.credit - entry.debit);

      if (entry.credit > 0) {
        vendorBalances[entry.accountId].totalPurchases += entry.credit;
      }
      if (entry.debit > 0) {
        vendorBalances[entry.accountId].totalPaid += entry.debit;
      }
    } else if (staffBalances[entry.accountId] !== undefined) {
      // Staff advance/loan: debit increases it, credit (salary adjustment) decreases it
      staffBalances[entry.accountId].advanceLoanBalance += amt;
    }
  }

  // Calculate total bank balance
  for (const bid in bankBalances) {
    totalBankBalance += bankBalances[bid];
  }

  // Format final customer balances
  for (const cid in customerBalances) {
    const net = customerBalances[cid].netBalance;
    if (net >= 0) {
      customerBalances[cid].outstanding = net;
      customerBalances[cid].advance = 0;
    } else {
      customerBalances[cid].outstanding = 0;
      customerBalances[cid].advance = Math.abs(net);
    }
  }

  // Format final vendor balances
  for (const vid in vendorBalances) {
    const net = vendorBalances[vid].netBalance;
    if (net >= 0) {
      vendorBalances[vid].outstanding = net;
      vendorBalances[vid].advance = 0;
    } else {
      vendorBalances[vid].outstanding = 0;
      vendorBalances[vid].advance = Math.abs(net);
    }
  }

  return {
    cashBalance,
    bankBalances,
    totalBankBalance,
    customerBalances,
    vendorBalances,
    itemStocks,
    staffBalances,
  };
}

// Helper to remove entries from ledgers & inventory ledger for a transaction ID
async function clearLedgersForTransaction(refId: string) {
  const ledgers = await getAllRecords<DBLedgerEntry>('ledgers');
  for (const entry of ledgers) {
    if (entry.referenceId === refId) {
      await deleteRecord('ledgers', entry.id);
    }
  }

  const inventory = await getAllRecords<DBInventoryLedgerEntry>('inventory_ledger');
  for (const entry of inventory) {
    if (entry.referenceId === refId) {
      await deleteRecord('inventory_ledger', entry.id);
    }
  }
}

// Generate unique IDs
function generateUuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// ==========================================
// WRITE/UPDATE TRANSACTION HANDLERS
// ==========================================

export async function saveTripTransaction(trip: DBTrip): Promise<void> {
  // 1. Put Trip record in main store
  await putRecord<DBTrip>('trips', trip);

  // 2. Clear old ledger and inventory effects
  await clearLedgersForTransaction(trip.id);

  const effectiveCustomerId = trip.customerId || 'walk-in';
  const descStr = trip.items && trip.items.length > 0
    ? `Trip dispatch (${trip.items.length} materials): ${trip.items.map(i => `${i.quantity} ${i.unit} ${i.itemName || i.itemId}`).join(', ')} via vehicle ${trip.vehicleId || 'Direct'}`
    : `Trip dispatch: ${trip.quantity} ${trip.unit} item ID ${trip.itemId} via vehicle ${trip.vehicleId || 'Direct'}`;
  
  // 3. True Double-Entry: Always Debit Customer Account with FULL Invoice Grand Total
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: trip.date,
    type: 'trip',
    referenceId: trip.id,
    accountId: effectiveCustomerId,
    accountType: 'customer',
    debit: trip.grandTotal,
    credit: 0,
    description: `Trip ${trip.id} Invoice Total: Rs. ${trip.grandTotal.toLocaleString()} (Freight: Rs. ${trip.vehicleCharges.toLocaleString()}${trip.discount > 0 ? `, Discount: Rs. ${trip.discount.toLocaleString()}` : ''})`,
  });

  // 4. Create Revenue Entries
  if (trip.materialTotal > 0) {
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: 'sales_revenue',
      accountType: 'revenue',
      debit: 0,
      credit: trip.materialTotal,
      description: descStr,
    });
  }

  if (trip.vehicleCharges > 0) {
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: 'trip_revenue',
      accountType: 'revenue',
      debit: 0,
      credit: trip.vehicleCharges,
      description: `Vehicle Freight Charges: Rs. ${trip.vehicleCharges.toLocaleString()} for Trip ${trip.id}`,
    });
  }

  if (trip.totalExpenses > 0) {
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: 'trip_expenses_revenue',
      accountType: 'revenue',
      debit: 0,
      credit: trip.totalExpenses,
      description: `Billed Trip Expenses: Rs. ${trip.totalExpenses.toLocaleString()} for Trip ${trip.id}`,
    });
  }

  if (trip.discount && trip.discount > 0) {
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: 'sales_discount',
      accountType: 'expense',
      debit: trip.discount,
      credit: 0,
      description: `Trip Discount: Rs. ${trip.discount.toLocaleString()} for Trip ${trip.id}`,
    });
  }

  // 5. Record Payment Received on spot (Cash or Bank)
  const actualPaid = trip.paidAmount !== undefined
    ? Number(trip.paidAmount) || 0
    : (trip.paymentType === 'Cash' || trip.paymentType === 'Bank' ? trip.grandTotal : 0);
  
  if (actualPaid > 0) {
    const isBank = trip.paymentType === 'Bank' && !!trip.bankId;
    const cashOrBankAccountId = isBank ? trip.bankId! : 'cash';
    const cashOrBankAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

    // 5a. Debit Cash / Bank Account (Money Actually Received)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: cashOrBankAccountId,
      accountType: cashOrBankAccountType,
      debit: actualPaid,
      credit: 0,
      description: `Trip ${trip.id} Payment Received (${isBank ? 'Bank' : 'Cash'}) from ${effectiveCustomerId}`,
    });

    // 5b. Credit Customer Account (Payment Credited against invoice / advance created)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: effectiveCustomerId,
      accountType: 'customer',
      debit: 0,
      credit: actualPaid,
      description: `Trip ${trip.id} Payment Received (${isBank ? 'Bank' : 'Cash'})`,
    });
  }

  // 6. Record Trip Expenses in Ledger
  // Each internal expense decreases cash (default) or bank and increases trip expense
  for (const exp of trip.expenses) {
    if (exp.amount <= 0) continue;
    
    // Debit: Trip Expenses
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: 'expenses_trip',
      accountType: 'expense',
      debit: exp.amount,
      credit: 0,
      description: `Trip Expense: ${exp.category} (${exp.description || ''}) - Veh: ${trip.vehicleId}`,
    });

    // Credit: Cash (Default) or Bank
    let expenseCreditAccountId = 'cash';
    let expenseCreditAccountType: 'cash' | 'bank' = 'cash';

    if (trip.paymentType === 'Bank' && trip.bankId) {
      expenseCreditAccountId = trip.bankId;
      expenseCreditAccountType = 'bank';
    }

    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: expenseCreditAccountId,
      accountType: expenseCreditAccountType,
      debit: 0,
      credit: exp.amount,
      description: `Trip Expense Paid: ${exp.category} - Veh: ${trip.vehicleId}`,
    });
  }

  // 7. Update Inventory Ledger
  // Outflow of stock for all dispatched materials
  if (trip.items && trip.items.length > 0) {
    for (const itm of trip.items) {
      if (itm.quantity <= 0 || !itm.itemId) continue;
      await putRecord<DBInventoryLedgerEntry>('inventory_ledger', {
        id: generateUuid(),
        date: trip.date,
        itemId: itm.itemId,
        type: 'trip',
        referenceId: trip.id,
        qtyIn: 0,
        qtyOut: itm.quantity,
        rate: itm.rate,
        value: itm.amount,
      });
    }
  } else if (trip.itemId && trip.quantity > 0) {
    await putRecord<DBInventoryLedgerEntry>('inventory_ledger', {
      id: generateUuid(),
      date: trip.date,
      itemId: trip.itemId,
      type: 'trip',
      referenceId: trip.id,
      qtyIn: 0,
      qtyOut: trip.quantity,
      rate: trip.rate,
      value: trip.materialTotal,
    });
  }

  // 8. Auto-update vehicle status and location
  if (trip.vehicleId) {
    const allVeh = await getAllRecords<DBVehicle>('vehicles');
    const veh = allVeh.find(v => v.id === trip.vehicleId);
    if (veh) {
      if (trip.tripStatus === 'active') {
        veh.status = 'on_trip';
        veh.currentLocation = trip.to || trip.from || 'En route';
        veh.currentTripId = trip.id;
      } else if (trip.tripStatus === 'completed' || !trip.tripStatus) {
        veh.status = 'available';
        veh.currentLocation = trip.to || 'Base / Yard';
        veh.currentTripId = undefined;
      }
      await putRecord<DBVehicle>('vehicles', veh);
    }
  }
}

export async function deleteTripTransaction(tripId: string): Promise<void> {
  const allTrips = await getAllRecords<DBTrip>('trips');
  const targetTrip = allTrips.find(t => t.id === tripId);
  if (targetTrip && targetTrip.vehicleId) {
    const allVeh = await getAllRecords<DBVehicle>('vehicles');
    const veh = allVeh.find(v => v.id === targetTrip.vehicleId);
    if (veh && veh.currentTripId === tripId) {
      veh.status = 'available';
      veh.currentTripId = undefined;
      await putRecord<DBVehicle>('vehicles', veh);
    }
  }

  await deleteRecord('trips', tripId);
  await clearLedgersForTransaction(tripId);

  // Clean up linked diesel transaction if any
  try {
    const dieselId = `dsl-${tripId}`;
    await deleteRecord('diesel_transactions', dieselId);
    await clearLedgersForTransaction(dieselId);
  } catch (err) {
    // ignore
  }
}

export async function savePurchaseTransaction(purchase: DBPurchase): Promise<void> {
  await putRecord<DBPurchase>('purchases', purchase);
  await clearLedgersForTransaction(purchase.id);

  const effectiveVendorId = purchase.vendorId || 'walk-in-vendor';
  const descStr = purchase.items && purchase.items.length > 0
    ? `Purchase Bill ${purchase.id} from ${effectiveVendorId} - ${purchase.items.length} items (Total: Rs. ${purchase.total.toLocaleString()})`
    : `Purchase Bill ${purchase.id} from ${effectiveVendorId} - Item: ${purchase.itemId}, Qty: ${purchase.quantity}`;

  // 1. True Double-Entry: Always Credit Vendor Account with FULL Purchase Total
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: purchase.date,
    type: 'purchase',
    referenceId: purchase.id,
    accountId: effectiveVendorId,
    accountType: 'vendor',
    debit: 0,
    credit: purchase.total,
    description: `Purchase Bill ${purchase.id} Total: Rs. ${purchase.total.toLocaleString()}`,
  });

  // 2. Debit Purchase Cost
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: purchase.date,
    type: 'purchase',
    referenceId: purchase.id,
    accountId: 'purchase_cost',
    accountType: 'expense',
    debit: purchase.total,
    credit: 0,
    description: descStr,
  });

  // 3. Record Cash or Bank Paid Out to Vendor on spot
  const actualPaid = purchase.paidAmount !== undefined
    ? Number(purchase.paidAmount) || 0
    : (purchase.paymentType === 'Credit' ? 0 : purchase.total);

  if (actualPaid > 0) {
    const isBank = purchase.paymentType === 'Bank' && !!purchase.bankId;
    const paymentAccountId = isBank ? purchase.bankId! : 'cash';
    const paymentAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

    // 3a. Debit Vendor Account (Reducing payable / increasing advance)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: purchase.date,
      type: 'purchase',
      referenceId: purchase.id,
      accountId: effectiveVendorId,
      accountType: 'vendor',
      debit: actualPaid,
      credit: 0,
      description: `Purchase Bill ${purchase.id} Paid Out (${isBank ? 'Bank' : 'Cash'})`,
    });

    // 3b. Credit Cash / Bank Account (Money Paid Out)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: purchase.date,
      type: 'purchase',
      referenceId: purchase.id,
      accountId: paymentAccountId,
      accountType: paymentAccountType,
      debit: 0,
      credit: actualPaid,
      description: `Purchase Bill ${purchase.id} Paid Out (${isBank ? 'Bank' : 'Cash'}) to ${effectiveVendorId}`,
    });
  }

  // 4. Update Inventory Ledger
  if (purchase.items && purchase.items.length > 0) {
    for (const itm of purchase.items) {
      if (itm.quantity <= 0 || !itm.itemId) continue;
      await putRecord<DBInventoryLedgerEntry>('inventory_ledger', {
        id: generateUuid(),
        date: purchase.date,
        itemId: itm.itemId,
        type: 'purchase',
        referenceId: purchase.id,
        qtyIn: itm.quantity,
        qtyOut: 0,
        rate: itm.rate,
        value: itm.amount,
      });
    }
  } else if (purchase.itemId && purchase.quantity > 0) {
    await putRecord<DBInventoryLedgerEntry>('inventory_ledger', {
      id: generateUuid(),
      date: purchase.date,
      itemId: purchase.itemId,
      type: 'purchase',
      referenceId: purchase.id,
      qtyIn: purchase.quantity,
      qtyOut: 0,
      rate: purchase.rate,
      value: purchase.total,
    });
  }
}

export async function deletePurchaseTransaction(purchaseId: string): Promise<void> {
  await deleteRecord('purchases', purchaseId);
  await clearLedgersForTransaction(purchaseId);
}

export async function saveSaleTransaction(sale: DBSale): Promise<void> {
  await putRecord<DBSale>('sales', sale);
  await clearLedgersForTransaction(sale.id);

  const effectiveCustomerId = sale.customerId || 'walk-in';
  const descStr = `POS Sale ${sale.id} to ${effectiveCustomerId} - Qty: ${sale.quantity} @ Rs. ${sale.rate.toLocaleString()}${sale.discount > 0 ? `, Discount: Rs. ${sale.discount.toLocaleString()}` : ''}`;

  // 1. True Double-Entry: Always Debit Customer Account with FULL Sale Total
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: sale.date,
    type: 'sale',
    referenceId: sale.id,
    accountId: effectiveCustomerId,
    accountType: 'customer',
    debit: sale.total,
    credit: 0,
    description: `POS Counter Sale ${sale.id} Total: Rs. ${sale.total.toLocaleString()}`,
  });

  // 2. Credit Sales Revenue
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: sale.date,
    type: 'sale',
    referenceId: sale.id,
    accountId: 'sales_revenue',
    accountType: 'revenue',
    debit: 0,
    credit: sale.total,
    description: descStr,
  });

  // 3. Record Spot Payment if received
  const actualPaid = sale.paidAmount !== undefined
    ? Number(sale.paidAmount) || 0
    : (sale.paymentType === 'Cash' || sale.paymentType === 'Bank' ? sale.total : 0);

  if (actualPaid > 0) {
    const isBank = sale.paymentType === 'Bank' && !!sale.bankId;
    const paymentAccountId = isBank ? sale.bankId! : 'cash';
    const paymentAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

    // 3a. Debit Cash / Bank (Money Actually Received)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: sale.date,
      type: 'sale',
      referenceId: sale.id,
      accountId: paymentAccountId,
      accountType: paymentAccountType,
      debit: actualPaid,
      credit: 0,
      description: `POS Sale ${sale.id} Payment Received (${isBank ? 'Bank' : 'Cash'}) from ${effectiveCustomerId}`,
    });

    // 3b. Credit Customer Account (Payment logged against sale)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: sale.date,
      type: 'sale',
      referenceId: sale.id,
      accountId: effectiveCustomerId,
      accountType: 'customer',
      debit: 0,
      credit: actualPaid,
      description: `POS Sale ${sale.id} Payment Received (${isBank ? 'Bank' : 'Cash'})`,
    });
  }

  // 4. Update Inventory Ledger
  await putRecord<DBInventoryLedgerEntry>('inventory_ledger', {
    id: generateUuid(),
    date: sale.date,
    itemId: sale.itemId,
    type: 'sale',
    referenceId: sale.id,
    qtyIn: 0,
    qtyOut: sale.quantity,
    rate: sale.rate,
    value: sale.total,
  });
}

export async function deleteSaleTransaction(saleId: string): Promise<void> {
  await deleteRecord('sales', saleId);
  await clearLedgersForTransaction(saleId);

  // Clean up linked diesel transaction if any
  try {
    const dieselId = `dsl-${saleId}`;
    await deleteRecord('diesel_transactions', dieselId);
    await clearLedgersForTransaction(dieselId);
  } catch (err) {
    // ignore
  }
}

// Receipt/Payment Vouchers for Customers/Vendors
export async function saveVoucherTransaction(voucher: DBVoucher): Promise<void> {
  await putRecord<DBVoucher>('vouchers', voucher);
  await clearLedgersForTransaction(voucher.id);

  if (voucher.type === 'receipt') {
    // Customer paying cash/bank:
    // Debit Cash/Bank
    // Credit Customer account
    const debitAcc = voucher.paymentType === 'Cash' ? 'cash' : (voucher.bankId || '');
    const debitType = voucher.paymentType === 'Cash' ? 'cash' : 'bank';

    // Debit cash/bank
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: voucher.date,
      type: 'cash_receipt',
      referenceId: voucher.id,
      accountId: debitAcc,
      accountType: debitType as any,
      debit: voucher.amount,
      credit: 0,
      description: `Receipt from customer - Ref: ${voucher.reference}. ${voucher.notes}`,
    });

    // Credit Customer
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: voucher.date,
      type: 'cash_receipt',
      referenceId: voucher.id,
      accountId: voucher.partyId,
      accountType: 'customer',
      debit: 0,
      credit: voucher.amount,
      description: `Payment received - Ref: ${voucher.reference}`,
    });

  } else {
    // Paying Vendor in cash/bank:
    // Debit Vendor account
    // Credit Cash/Bank
    const creditAcc = voucher.paymentType === 'Cash' ? 'cash' : (voucher.bankId || '');
    const creditType = voucher.paymentType === 'Cash' ? 'cash' : 'bank';

    // Debit Vendor
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: voucher.date,
      type: 'cash_payment',
      referenceId: voucher.id,
      accountId: voucher.partyId,
      accountType: 'vendor',
      debit: voucher.amount,
      credit: 0,
      description: `Payment made to vendor - Ref: ${voucher.reference}`,
    });

    // Credit cash/bank
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: voucher.date,
      type: 'cash_payment',
      referenceId: voucher.id,
      accountId: creditAcc,
      accountType: creditType as any,
      debit: 0,
      credit: voucher.amount,
      description: `Payment to vendor - Ref: ${voucher.reference}. ${voucher.notes}`,
    });
  }
}

export async function deleteVoucherTransaction(voucherId: string): Promise<void> {
  await deleteRecord('vouchers', voucherId);
  await clearLedgersForTransaction(voucherId);
}

// Other Income
export async function saveOtherIncomeTransaction(income: DBOtherIncome): Promise<void> {
  await putRecord<DBOtherIncome>('other_incomes', income);
  await clearLedgersForTransaction(income.id);

  const debitAcc = income.paymentType === 'Cash' ? 'cash' : (income.bankId || '');
  const debitType = income.paymentType === 'Cash' ? 'cash' : 'bank';

  // 1. Debit Cash/Bank
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: income.date,
    type: 'other_income',
    referenceId: income.id,
    accountId: debitAcc,
    accountType: debitType as any,
    debit: income.amount,
    credit: 0,
    description: `Other Income: ${income.source} (${income.description})`,
  });

  // 2. Credit Other Income Revenue
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: income.date,
    type: 'other_income',
    referenceId: income.id,
    accountId: 'other_income_revenue',
    accountType: 'revenue',
    debit: 0,
    credit: income.amount,
    description: `Other Income: ${income.source}`,
  });
}

export async function deleteOtherIncomeTransaction(incomeId: string): Promise<void> {
  await deleteRecord('other_incomes', incomeId);
  await clearLedgersForTransaction(incomeId);
}

// General Expenses
export async function saveGeneralExpenseTransaction(expense: DBGeneralExpense): Promise<void> {
  await putRecord<DBGeneralExpense>('general_expenses', expense);
  await clearLedgersForTransaction(expense.id);

  const creditAcc = expense.paymentType === 'Cash' ? 'cash' : (expense.bankId || '');
  const creditType = expense.paymentType === 'Cash' ? 'cash' : 'bank';

  // 1. Debit General Expense
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: expense.date,
    type: 'general_expense',
    referenceId: expense.id,
    accountId: 'expenses_general',
    accountType: 'expense',
    debit: expense.amount,
    credit: 0,
    description: `General Expense: ${expense.category} (${expense.description})`,
  });

  // 2. Credit Cash/Bank
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: expense.date,
    type: 'general_expense',
    referenceId: expense.id,
    accountId: creditAcc,
    accountType: creditType as any,
    debit: 0,
    credit: expense.amount,
    description: `Paid General Expense: ${expense.category}`,
  });
}

export async function deleteGeneralExpenseTransaction(expenseId: string): Promise<void> {
  await deleteRecord('general_expenses', expenseId);
  await clearLedgersForTransaction(expenseId);
}

// Staff Payments & Salary Vouchers
export async function saveStaffPaymentTransaction(pay: DBStaffPayment): Promise<void> {
  await putRecord<DBStaffPayment>('staff_payments', pay);
  await clearLedgersForTransaction(pay.id);

  const cashBankAcc = pay.paymentType === 'Cash' ? 'cash' : (pay.bankId || '');
  const cashBankType = pay.paymentType === 'Cash' ? 'cash' : 'bank';

  if (pay.type === 'advance' || pay.type === 'loan') {
    // Advance or Loan given to staff:
    // Debit Staff Account (increasing their asset/receivable from our side)
    // Credit Cash/Bank
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: pay.date,
      type: pay.type === 'loan' ? 'staff_loan' : 'staff_advance',
      referenceId: pay.id,
      accountId: pay.staffId,
      accountType: 'staff',
      debit: pay.amount,
      credit: 0,
      description: `Staff ${pay.type} given: ${pay.description}`,
    });

    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: pay.date,
      type: pay.type === 'loan' ? 'staff_loan' : 'staff_advance',
      referenceId: pay.id,
      accountId: cashBankAcc,
      accountType: cashBankType as any,
      debit: 0,
      credit: pay.amount,
      description: `Paid Staff ${pay.type}: ${pay.description}`,
    });

  } else if (pay.type === 'salary') {
    // Salary Payment
    // Debit: salary_expense (Gross Salary = netPaid + advanceAdjusted)
    // Credit: Staff Account (by advanceAdjusted amount, reducing their loan/advance)
    // Credit: Cash/Bank (by netPaid amount, the actual payout)
    
    // Debit: Salary Expense
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: pay.date,
      type: 'salary_payment',
      referenceId: pay.id,
      accountId: 'salary_expense',
      accountType: 'expense',
      debit: pay.amount, // gross salary
      credit: 0,
      description: `Salary processing for staff: ID ${pay.staffId} (${pay.description})`,
    });

    // Credit: Staff Advance reduction (if any)
    if (pay.advanceAdjusted && pay.advanceAdjusted > 0) {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: pay.date,
        type: 'salary_payment',
        referenceId: pay.id,
        accountId: pay.staffId,
        accountType: 'staff',
        debit: 0,
        credit: pay.advanceAdjusted,
        description: `Advance adjustment against salary`,
      });
    }

    // Credit: Cash/Bank payout
    if (pay.netPaid > 0) {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: pay.date,
        type: 'salary_payment',
        referenceId: pay.id,
        accountId: cashBankAcc,
        accountType: cashBankType as any,
        debit: 0,
        credit: pay.netPaid,
        description: `Net salary payout`,
      });
    }
  } else if (pay.type === 'settlement') {
    // Final Settlement
    // Debit: salary_expense (Settlement Amount)
    // Credit: Staff Account (if adjustment)
    // Credit: Cash/Bank (net settlement payout)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: pay.date,
      type: 'salary_payment',
      referenceId: pay.id,
      accountId: 'salary_expense',
      accountType: 'expense',
      debit: pay.amount,
      credit: 0,
      description: `Final settlement for staff ID ${pay.staffId}: ${pay.description}`,
    });

    if (pay.advanceAdjusted && pay.advanceAdjusted > 0) {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: pay.date,
        type: 'salary_payment',
        referenceId: pay.id,
        accountId: pay.staffId,
        accountType: 'staff',
        debit: 0,
        credit: pay.advanceAdjusted,
        description: `Advance adjusted in settlement`,
      });
    }

    if (pay.netPaid > 0) {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: pay.date,
        type: 'salary_payment',
        referenceId: pay.id,
        accountId: cashBankAcc,
        accountType: cashBankType as any,
        debit: 0,
        credit: pay.netPaid,
        description: `Net settlement paid`,
      });
    }
  }
}

export async function deleteStaffPaymentTransaction(payId: string): Promise<void> {
  await deleteRecord('staff_payments', payId);
  const ledgers = await getAllRecords<DBLedgerEntry>('ledgers');
  for (const entry of ledgers) {
    if (entry.referenceId === payId && (entry.type === 'salary_payment' || entry.type === 'staff_advance' || entry.type === 'staff_loan')) {
      await deleteRecord('ledgers', entry.id);
    }
  }
}

// ==========================================
// DIRECT VENDOR PURCHASES (NON-STOCK)
// ==========================================

export async function saveDirectPurchaseTransaction(purchase: DBDirectPurchase): Promise<void> {
  await putRecord<DBDirectPurchase>('direct_purchases', purchase);
  await clearLedgersForTransaction(purchase.id);

  const effectiveVendorId = purchase.vendorId || 'walk-in-vendor';
  let expenseAccount = 'expenses_direct_purchase';
  if (purchase.category.toLowerCase().includes('diesel') || purchase.category.toLowerCase().includes('fuel')) {
    expenseAccount = 'expenses_diesel';
  } else if (purchase.category.toLowerCase().includes('maintenance') || purchase.category.toLowerCase().includes('repair') || purchase.category.toLowerCase().includes('mistri')) {
    expenseAccount = 'expenses_maintenance';
  }

  // 1. Debit: Relevant Expense Account
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: purchase.date,
    type: 'direct_purchase',
    referenceId: purchase.id,
    accountId: expenseAccount,
    accountType: 'expense',
    debit: purchase.total,
    credit: 0,
    description: `Direct Purchase: ${purchase.category} - ${purchase.description} (${effectiveVendorId})`,
  });

  // 2. Credit: Vendor Account (Full Invoice Amount)
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: purchase.date,
    type: 'direct_purchase',
    referenceId: purchase.id,
    accountId: effectiveVendorId,
    accountType: 'vendor',
    debit: 0,
    credit: purchase.total,
    description: `Direct Purchase Invoice: ${purchase.category} - ${purchase.description}`,
  });

  // 3. Payment Paid on Spot (Cash or Bank)
  const actualPaid = purchase.paidAmount !== undefined
    ? Number(purchase.paidAmount) || 0
    : (purchase.paymentType === 'Cash' || purchase.paymentType === 'Bank' ? purchase.total : 0);

  if (actualPaid > 0) {
    const isBank = purchase.paymentType === 'Bank' && !!purchase.bankId;
    const cashOrBankAccountId = isBank ? purchase.bankId! : 'cash';
    const cashOrBankAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

    // 3a. Debit: Vendor Account (Paid to Vendor)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: purchase.date,
      type: 'direct_purchase',
      referenceId: purchase.id,
      accountId: effectiveVendorId,
      accountType: 'vendor',
      debit: actualPaid,
      credit: 0,
      description: `Payment for Direct Purchase ${purchase.id} (${isBank ? 'Bank' : 'Cash'})`,
    });

    // 3b. Credit: Cash / Bank Account (Money Outflow)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: purchase.date,
      type: 'direct_purchase',
      referenceId: purchase.id,
      accountId: cashOrBankAccountId,
      accountType: cashOrBankAccountType,
      debit: 0,
      credit: actualPaid,
      description: `Direct Purchase Payment to ${effectiveVendorId} (${purchase.category})`,
    });
  }
}

export async function deleteDirectPurchaseTransaction(purchaseId: string): Promise<void> {
  await deleteRecord('direct_purchases', purchaseId);
  await clearLedgersForTransaction(purchaseId);
}

// ==========================================
// DIESEL MANAGEMENT & ACCOUNTING
// ==========================================

export async function saveDieselTransaction(tx: DBDieselTransaction): Promise<void> {
  await putRecord<DBDieselTransaction>('diesel_transactions', tx);
  await clearLedgersForTransaction(tx.id);

  const effectiveVendorId = tx.vendorId || 'walk-in-pump';

  // 1. Debit: Diesel Expense Account
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: tx.date,
    type: 'diesel',
    referenceId: tx.id,
    accountId: 'expenses_diesel',
    accountType: 'expense',
    debit: tx.totalAmount,
    credit: 0,
    description: `Diesel Purchase: ${tx.litres}L @ Rs. ${tx.ratePerLitre}/L for Veh ${tx.vehicleNumber || tx.vehicleId || 'Bulk'}`,
  });

  // 2. Credit: Vendor Account
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: tx.date,
    type: 'diesel',
    referenceId: tx.id,
    accountId: effectiveVendorId,
    accountType: 'vendor',
    debit: 0,
    credit: tx.totalAmount,
    description: `Diesel Bill: ${tx.litres}L @ Rs. ${tx.ratePerLitre}/L for Veh ${tx.vehicleNumber || tx.vehicleId || 'Bulk'}`,
  });

  // 3. Paid on spot
  const actualPaid = tx.paidAmount !== undefined ? Number(tx.paidAmount) || 0 : (tx.paymentType === 'Cash' || tx.paymentType === 'Bank' ? tx.totalAmount : 0);
  if (actualPaid > 0) {
    const isBank = tx.paymentType === 'Bank' && !!tx.bankId;
    const cashOrBankAccountId = isBank ? tx.bankId! : 'cash';
    const cashOrBankAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: tx.date,
      type: 'diesel',
      referenceId: tx.id,
      accountId: effectiveVendorId,
      accountType: 'vendor',
      debit: actualPaid,
      credit: 0,
      description: `Diesel Payment Paid (${isBank ? 'Bank' : 'Cash'}) to ${effectiveVendorId}`,
    });

    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: tx.date,
      type: 'diesel',
      referenceId: tx.id,
      accountId: cashOrBankAccountId,
      accountType: cashOrBankAccountType,
      debit: 0,
      credit: actualPaid,
      description: `Diesel Purchase Outflow for Veh ${tx.vehicleNumber || tx.vehicleId || 'Bulk'}`,
    });
  }
}

export async function deleteDieselTransaction(txId: string): Promise<void> {
  await deleteRecord('diesel_transactions', txId);
  await clearLedgersForTransaction(txId);
}

export async function saveDieselUsage(usage: DBDieselUsage): Promise<void> {
  await putRecord<DBDieselUsage>('diesel_usage', usage);
}

export async function deleteDieselUsage(usageId: string): Promise<void> {
  await deleteRecord('diesel_usage', usageId);
}

// ==========================================
// VEHICLE MAINTENANCE & WORKSHOP
// ==========================================

export async function saveVehicleMaintenanceTransaction(maint: DBVehicleMaintenance): Promise<void> {
  await putRecord<DBVehicleMaintenance>('vehicle_maintenance', maint);
  await clearLedgersForTransaction(maint.id);

  const effectiveVendorId = maint.vendorId || maint.workshopVendor || 'workshop-vendor';

  // 1. Debit: Maintenance Expense Account
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: maint.date,
    type: 'maintenance',
    referenceId: maint.id,
    accountId: 'expenses_maintenance',
    accountType: 'expense',
    debit: maint.totalCost,
    credit: 0,
    description: `Vehicle Maintenance: ${maint.category} for Veh ${maint.vehicleNumber || maint.vehicleId} (${maint.description})`,
  });

  // 2. Credit: Workshop / Vendor Account
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: maint.date,
    type: 'maintenance',
    referenceId: maint.id,
    accountId: effectiveVendorId,
    accountType: 'vendor',
    debit: 0,
    credit: maint.totalCost,
    description: `Maintenance Bill: ${maint.category} for Veh ${maint.vehicleNumber || maint.vehicleId}`,
  });

  // 3. Paid on spot
  const actualPaid = maint.paidAmount !== undefined ? Number(maint.paidAmount) || 0 : (maint.paymentType === 'Cash' || maint.paymentType === 'Bank' ? maint.totalCost : 0);
  if (actualPaid > 0) {
    const isBank = maint.paymentType === 'Bank' && !!maint.bankId;
    const cashOrBankAccountId = isBank ? maint.bankId! : 'cash';
    const cashOrBankAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: maint.date,
      type: 'maintenance',
      referenceId: maint.id,
      accountId: effectiveVendorId,
      accountType: 'vendor',
      debit: actualPaid,
      credit: 0,
      description: `Maintenance Payment Paid (${isBank ? 'Bank' : 'Cash'}) to ${effectiveVendorId}`,
    });

    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: maint.date,
      type: 'maintenance',
      referenceId: maint.id,
      accountId: cashOrBankAccountId,
      accountType: cashOrBankAccountType,
      debit: 0,
      credit: actualPaid,
      description: `Maintenance Outflow for Veh ${maint.vehicleNumber || maint.vehicleId}`,
    });
  }
}

export async function deleteVehicleMaintenanceTransaction(maintId: string): Promise<void> {
  await deleteRecord('vehicle_maintenance', maintId);
  await clearLedgersForTransaction(maintId);
}

// ==========================================
// DRIVER ADVANCES & EXPENSE SETTLEMENTS
// ==========================================

export async function saveDriverAdvanceTransaction(adv: DBDriverAdvance): Promise<void> {
  await putRecord<DBDriverAdvance>('driver_advances', adv);
  await clearLedgersForTransaction(adv.id);

  const isBank = adv.paymentType === 'Bank' && !!adv.bankId;
  const cashOrBankAccountId = isBank ? adv.bankId! : 'cash';
  const cashOrBankAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

  // 1. Debit: Staff / Driver Account (Receivable Advance)
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: adv.date,
    type: 'driver_advance',
    referenceId: adv.id,
    accountId: adv.driverId,
    accountType: 'staff',
    debit: adv.amount,
    credit: 0,
    description: `Driver Trip Advance Issued: ${adv.purpose} (Veh: ${adv.vehicleId || 'N/A'})`,
  });

  // 2. Credit: Cash / Bank Account (Money Outflow)
  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: adv.date,
    type: 'driver_advance',
    referenceId: adv.id,
    accountId: cashOrBankAccountId,
    accountType: cashOrBankAccountType,
    debit: 0,
    credit: adv.amount,
    description: `Driver Advance Payout to ID ${adv.driverId} (${adv.purpose})`,
  });
}

export async function deleteDriverAdvanceTransaction(advId: string): Promise<void> {
  await deleteRecord('driver_advances', advId);
  await clearLedgersForTransaction(advId);
}

export async function saveDriverExpenseSettlementTransaction(expense: DBDriverExpenseSubmission, returnCashAmount?: number): Promise<void> {
  await putRecord<DBDriverExpenseSubmission>('driver_expenses', expense);
  await clearLedgersForTransaction(expense.id);

  if (expense.amountApproved > 0) {
    // Debit: Trip Expenses
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: expense.date,
      type: 'driver_expense',
      referenceId: expense.id,
      accountId: 'expenses_trip',
      accountType: 'expense',
      debit: expense.amountApproved,
      credit: 0,
      description: `Approved Driver Trip Expense: ${expense.category} (${expense.description}) - Veh: ${expense.vehicleId || 'N/A'}`,
    });

    // Credit: Driver Account (Decreases Driver's Advance Debt)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: expense.date,
      type: 'driver_expense',
      referenceId: expense.id,
      accountId: expense.driverId,
      accountType: 'staff',
      debit: 0,
      credit: expense.amountApproved,
      description: `Driver Expense Approved: ${expense.category} adjusted against advance`,
    });
  }

  if (returnCashAmount && returnCashAmount > 0) {
    // Debit: Cash (Cash returned by driver back to company cashbox)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: expense.date,
      type: 'driver_expense',
      referenceId: expense.id,
      accountId: 'cash',
      accountType: 'cash',
      debit: returnCashAmount,
      credit: 0,
      description: `Unused advance cash returned by driver ID ${expense.driverId}`,
    });

    // Credit: Driver Account (Further Decreases Driver's Advance Debt)
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: expense.date,
      type: 'driver_expense',
      referenceId: expense.id,
      accountId: expense.driverId,
      accountType: 'staff',
      debit: 0,
      credit: returnCashAmount,
      description: `Driver cash return credited against advance debt`,
    });
  }
}

export async function saveDriverAssignment(assignment: DBDriverAssignment): Promise<void> {
  await putRecord<DBDriverAssignment>('driver_assignments', assignment);
  
  // Also update vehicle's assigned driver and status
  const allVehicles = await getAllRecords<DBVehicle>('vehicles');
  const targetVeh = allVehicles.find(v => v.id === assignment.vehicleId);
  if (targetVeh) {
    targetVeh.driver = assignment.driverName;
    targetVeh.driverId = assignment.driverId;
    await putRecord<DBVehicle>('vehicles', targetVeh);
  }
}
