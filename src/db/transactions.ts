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
  DBTripItem
} from './indexedDB';

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

export async function calculateLiveBalances(): Promise<LiveBalances> {
  await migrateLegacyVouchers();
  await migrateLegacyStaffAndPayments();
  const ledgers = await getAllRecords<DBLedgerEntry>('ledgers');
  const inventoryEntries = await getAllRecords<DBInventoryLedgerEntry>('inventory_ledger');
  
  const customers = await getAllRecords<DBCustomer>('customers');
  const vendors = await getAllRecords<DBVendor>('vendors');
  const banks = await getAllRecords<DBBank>('banks');
  const items = await getAllRecords<DBItem>('items');
  const staff = await getAllRecords<DBStaff>('staff');

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

  // 3. Write Customer & Revenue Ledger entries
  // Debit: Customer Account (receivable) or Cash/Bank
  // Credit: Material Sales Revenue & Trip Transportation Revenue
  const descStr = trip.items && trip.items.length > 0
    ? `Trip dispatch (${trip.items.length} materials): ${trip.items.map(i => `${i.quantity} ${i.unit} ${i.itemName || i.itemId}`).join(', ')} via vehicle ${trip.vehicleId || 'Direct'}`
    : `Trip dispatch: ${trip.quantity} ${trip.unit} item ID ${trip.itemId} via vehicle ${trip.vehicleId || 'Direct'}`;
  
  // Create Revenue Entries
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
      description: `Vehicle Freight Charges: ${trip.vehicleCharges} for Trip ${trip.id}`,
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
      description: `Billed Trip Expenses: ${trip.totalExpenses} for Trip ${trip.id}`,
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
      description: `Trip Discount: ${trip.discount} for Trip ${trip.id}`,
    });
  }

  // Create Debit / Payment Entries based on Payment Type and paidAmount
  const actualPaid = trip.paidAmount !== undefined
    ? Number(trip.paidAmount) || 0
    : (trip.paymentType === 'Cash' || trip.paymentType === 'Bank' ? trip.grandTotal : 0);
  
  const isBank = trip.paymentType === 'Bank' && !!trip.bankId;
  const cashOrBankAccountId = isBank ? trip.bankId! : 'cash';
  const cashOrBankAccountType: 'cash' | 'bank' = isBank ? 'bank' : 'cash';

  // 1) Record cash/bank received if any amount was paid on spot
  if (actualPaid > 0) {
    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: trip.date,
      type: 'trip',
      referenceId: trip.id,
      accountId: cashOrBankAccountId,
      accountType: cashOrBankAccountType,
      debit: actualPaid,
      credit: 0,
      description: `Trip ${trip.id} Payment Received (${isBank ? 'Bank' : 'Cash'}) - Total Bill: Rs. ${trip.grandTotal.toLocaleString()}`,
    });
  }

  // 2) Check if there is an unpaid balance or an excess overpayment
  const unpaid = trip.grandTotal - actualPaid;

  if (unpaid > 0) {
    // Customer owes remaining balance (on credit / using advance)
    if (trip.customerId && trip.customerId !== 'walk-in') {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: trip.date,
        type: 'trip',
        referenceId: trip.id,
        accountId: trip.customerId,
        accountType: 'customer',
        debit: unpaid,
        credit: 0,
        description: `Trip ${trip.id} Credit / Unpaid Balance (Bill: Rs. ${trip.grandTotal.toLocaleString()}, Paid: Rs. ${actualPaid.toLocaleString()})`,
      });
    } else {
      // Walk-in fallback
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: trip.date,
        type: 'trip',
        referenceId: trip.id,
        accountId: 'cash',
        accountType: 'cash',
        debit: unpaid,
        credit: 0,
        description: `Trip ${trip.id} Walk-in Counter Sale (Net Bill: Rs. ${trip.grandTotal.toLocaleString()})`,
      });
    }
  } else if (unpaid < 0) {
    // Customer paid MORE than the bill amount (excess money goes to customer advance)
    const excess = actualPaid - trip.grandTotal;
    if (trip.customerId && trip.customerId !== 'walk-in') {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: trip.date,
        type: 'trip',
        referenceId: trip.id,
        accountId: trip.customerId,
        accountType: 'customer',
        debit: 0,
        credit: excess,
        description: `Trip ${trip.id} Overpayment (Rs. ${excess.toLocaleString()}) Credited to Customer Advance`,
      });
    }
  }

  // 4. Record Trip Expenses in Ledger
  // Each expense decreases cash (default) or bank and increases trip expense
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

    // Credit: Cash (Default) or Bank (if Trip Payment Type was Bank, reduce bank; otherwise cash)
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

  // 5. Update Inventory Ledger
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
}

export async function deleteTripTransaction(tripId: string): Promise<void> {
  await deleteRecord('trips', tripId);
  await clearLedgersForTransaction(tripId);
}

export async function savePurchaseTransaction(purchase: DBPurchase): Promise<void> {
  await putRecord<DBPurchase>('purchases', purchase);
  await clearLedgersForTransaction(purchase.id);

  const descStr = purchase.items && purchase.items.length > 0
    ? `Purchase Bill ${purchase.id} from ${purchase.vendorId} - ${purchase.items.length} items (Total: Rs. ${purchase.total.toLocaleString()})`
    : `Purchase Bill ${purchase.id} from ${purchase.vendorId} - Item: ${purchase.itemId}, Qty: ${purchase.quantity}`;

  // 1. Debit Purchase Cost
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

  // 2. Settlement & Split Payment Accounting
  const actualPaid = purchase.paidAmount !== undefined
    ? purchase.paidAmount
    : (purchase.paymentType === 'Credit' ? 0 : purchase.total);

  const unpaid = purchase.total - actualPaid;

  // 2a. Record Cash or Bank Paid Out
  if (actualPaid > 0) {
    let paymentAccountId = 'cash';
    let paymentAccountType: 'cash' | 'bank' = 'cash';

    if (purchase.paymentType === 'Bank' && purchase.bankId) {
      paymentAccountId = purchase.bankId;
      paymentAccountType = 'bank';
    }

    await putRecord<DBLedgerEntry>('ledgers', {
      id: generateUuid(),
      date: purchase.date,
      type: 'purchase',
      referenceId: purchase.id,
      accountId: paymentAccountId,
      accountType: paymentAccountType,
      debit: 0,
      credit: actualPaid,
      description: `Purchase Bill ${purchase.id} Paid Out on Spot via ${purchase.paymentType}`,
    });
  }

  // 2b. Record Vendor Credit (Unpaid Balance) or Advance (Overpayment)
  if (unpaid > 0) {
    if (purchase.vendorId && purchase.vendorId !== 'walk-in-vendor') {
      // Crediting vendor account increases payable or consumes vendor advance
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: purchase.date,
        type: 'purchase',
        referenceId: purchase.id,
        accountId: purchase.vendorId,
        accountType: 'vendor',
        debit: 0,
        credit: unpaid,
        description: `Purchase Bill ${purchase.id} Remaining Unpaid (Payable: Rs. ${unpaid.toLocaleString()})`,
      });
    }
  } else if (unpaid < 0) {
    // Paid MORE than the bill (excess paid creates or increases vendor advance)
    const excess = actualPaid - purchase.total;
    if (purchase.vendorId && purchase.vendorId !== 'walk-in-vendor') {
      await putRecord<DBLedgerEntry>('ledgers', {
        id: generateUuid(),
        date: purchase.date,
        type: 'purchase',
        referenceId: purchase.id,
        accountId: purchase.vendorId,
        accountType: 'vendor',
        debit: excess,
        credit: 0,
        description: `Purchase Bill ${purchase.id} Overpayment (Rs. ${excess.toLocaleString()}) Credited to Vendor Advance`,
      });
    }
  }

  // 3. Update Inventory Ledger
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

  const descStr = `POS Sale to customer ID ${sale.customerId} - Qty: ${sale.quantity}`;

  // 1. Credit Sales Revenue
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

  // 2. Debit Customer or Cash/Bank
  let debitAccountId = 'cash';
  let debitAccountType: 'cash' | 'bank' | 'customer' = 'cash';

  if ((sale.paymentType === 'Credit' || sale.paymentType === 'Advance') && sale.customerId && sale.customerId !== 'walk-in') {
    debitAccountId = sale.customerId;
    debitAccountType = 'customer';
  } else if (sale.paymentType === 'Bank' && sale.bankId) {
    debitAccountId = sale.bankId;
    debitAccountType = 'bank';
  }

  await putRecord<DBLedgerEntry>('ledgers', {
    id: generateUuid(),
    date: sale.date,
    type: 'sale',
    referenceId: sale.id,
    accountId: debitAccountId,
    accountType: debitAccountType,
    debit: sale.total,
    credit: 0,
    description: `POS Sale Payment: ${sale.paymentType}`,
  });

  // 3. Update Inventory Ledger
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
