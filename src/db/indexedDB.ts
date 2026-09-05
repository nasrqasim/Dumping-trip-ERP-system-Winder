// Database setup and typed wrappers for IndexedDB in the Norani Kanta ERP system

export const DB_NAME = 'NoraniKantaERP_DB';
export const DB_VERSION = 3;

export interface DBItem {
  id: string;
  name: string;
  unit: 'KG' | 'Ton' | 'Trip' | 'Truck' | 'Piece' | 'Liter';
  purchaseRate: number;
  saleRate: number;
  currentStock: number;
  minStock: number;
}

export interface DBCustomer {
  id: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  openingBalance: number; // positive = receivable, negative = advance
  creditLimit: number;
  contactPerson?: string;
  category?: string;
  ntn?: string;
  strn?: string;
  creditDays?: number;
  notes?: string;
}

export interface DBVendor {
  id: string;
  name: string;
  phone: string;
  address: string;
  openingBalance: number; // positive = payable, negative = advance
  contactPerson?: string;
  category?: string;
  ntn?: string;
  strn?: string;
  area?: string;
  creditDays?: number;
  notes?: string;
}

export interface DBVehicle {
  id: string;
  number: string;
  type: string;
  driver: string;
  capacity: number;
  active: boolean;
}

export interface DBBank {
  id: string;
  name: string;
  accountNumber: string;
  openingBalance: number;
}

export interface DBStaff {
  id: string;
  name: string;
  phone: string;
  designation: string;
  basicSalary: number;
}

export interface DBTripExpense {
  category: 'Load Tax' | 'Kanta' | 'Laiki / Arai' | 'Commission' | 'Roti / Food' | 'Maintenance / Mistri' | 'Diesel' | 'Loader Diesel' | 'Munshi / Clerk' | 'Driver' | string;
  amount: number;
  description: string;
}

export interface DBTripItem {
  itemId: string;
  itemName?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface DBTrip {
  id: string;
  date: string; // YYYY-MM-DD
  vehicleId: string;
  driverName: string;
  customerId: string; // default = walk-in customer id
  items?: DBTripItem[];
  itemId: string;
  quantity: number;
  unit: string;
  rate: number;
  materialTotal: number;
  vehicleCharges: number;
  discount: number;
  grandTotal: number;
  paidAmount?: number; // Amount paid on spot (e.g. in cash or bank)
  remainingBalance?: number; // grandTotal - paidAmount
  paymentType: 'Cash' | 'Bank' | 'Credit' | 'Advance';
  bankId?: string;
  expenses: DBTripExpense[];
  totalExpenses: number;
  netTripProfit: number; // vehicleCharges - totalExpenses
  from: string;
  to: string;
}

export interface DBPurchaseItem {
  id: string;
  itemId: string;
  itemName?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface DBPurchase {
  id: string;
  date: string; // YYYY-MM-DD
  vendorId: string;
  items?: DBPurchaseItem[];
  itemId: string;
  quantity: number;
  rate: number;
  total: number;
  paidAmount?: number; // Amount paid on spot to vendor (e.g. in cash or bank)
  remainingBalance?: number; // total - paidAmount (unpaid payable or excess advance)
  paymentType: 'Cash' | 'Bank' | 'Credit' | 'Advance';
  bankId?: string;
  vehicleNo?: string;
  driverName?: string;
  biltyNo?: string;
  location?: string;
  notes?: string;
}

export interface DBSale {
  id: string;
  date: string; // YYYY-MM-DD
  customerId: string;
  itemId: string;
  quantity: number;
  rate: number;
  discount: number;
  total: number;
  paymentType: 'Cash' | 'Bank' | 'Credit' | 'Advance';
  bankId?: string;
}

export interface DBLedgerEntry {
  id: string;
  date: string;
  type: 'opening' | 'trip' | 'purchase' | 'sale' | 'cash_receipt' | 'bank_receipt' | 'cash_payment' | 'bank_payment' | 'other_income' | 'general_expense' | 'salary_payment' | 'staff_advance' | 'staff_loan' | string;
  referenceId: string;
  accountId: string; // customerId | vendorId | bankId | staffId | 'cash' | 'sales_revenue' | 'trip_revenue' | 'expenses_trip' | 'expenses_general' | 'other_income_revenue' | 'salary_expense'
  accountType: 'customer' | 'vendor' | 'bank' | 'cash' | 'staff' | 'revenue' | 'expense';
  debit: number;
  credit: number;
  description: string;
}

export interface DBInventoryLedgerEntry {
  id: string;
  date: string;
  itemId: string;
  type: 'purchase' | 'sale' | 'trip' | 'return' | 'adjustment';
  referenceId: string;
  qtyIn: number;
  qtyOut: number;
  rate: number;
  value: number;
}

export interface DBGeneralExpense {
  id: string;
  date: string;
  amount: number;
  description: string;
  paymentType: 'Cash' | 'Bank';
  bankId?: string;
  category: string;
}

export interface DBOtherIncome {
  id: string;
  date: string;
  amount: number;
  description: string;
  paymentType: 'Cash' | 'Bank';
  bankId?: string;
  source: string;
}

export interface DBStaffPayment {
  id: string;
  date: string;
  staffId: string;
  type: 'salary' | 'advance' | 'loan' | 'settlement';
  amount: number;
  advanceAdjusted?: number;
  netPaid: number;
  paymentType: 'Cash' | 'Bank';
  bankId?: string;
  description: string;
}

export interface DBVoucher {
  id: string;
  date: string;
  type: 'receipt' | 'payment';
  partyType: 'customer' | 'vendor';
  partyId: string;
  paymentType: 'Cash' | 'Bank';
  bankId?: string;
  amount: number;
  reference: string;
  notes: string;
}

export type StoreName = 'items' | 'customers' | 'vendors' | 'vehicles' | 'banks' | 'staff' | 'trips' | 'purchases' | 'sales' | 'ledgers' | 'inventory_ledger' | 'general_expenses' | 'other_incomes' | 'staff_payments' | 'vouchers';

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB
export function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // Create object stores
      const storeConfigs: { [key in StoreName]?: { keyPath: string } } = {
        items: { keyPath: 'id' },
        customers: { keyPath: 'id' },
        vendors: { keyPath: 'id' },
        vehicles: { keyPath: 'id' },
        banks: { keyPath: 'id' },
        staff: { keyPath: 'id' },
        trips: { keyPath: 'id' },
        purchases: { keyPath: 'id' },
        sales: { keyPath: 'id' },
        ledgers: { keyPath: 'id' },
        inventory_ledger: { keyPath: 'id' },
        general_expenses: { keyPath: 'id' },
        other_incomes: { keyPath: 'id' },
        staff_payments: { keyPath: 'id' },
        vouchers: { keyPath: 'id' },
      };

      for (const name in storeConfigs) {
        if (!db.objectStoreNames.contains(name)) {
          const config = storeConfigs[name as StoreName];
          if (config) {
            db.createObjectStore(name, config);
          }
        }
      }
    };
  });
}

// Database Operations
export async function getAllRecords<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecordById<T>(storeName: StoreName, id: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result || null) as T | null);
    request.onerror = () => reject(request.error);
  });
}

export async function addRecord<T>(storeName: StoreName, record: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord<T>(storeName: StoreName, record: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecord(storeName: StoreName, id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Auto-migration to ensure all items have clean sequential IDs (item-001, item-002, etc.)
let isItemMigrationRunning = false;
export async function migrateItemIds(): Promise<void> {
  if (isItemMigrationRunning) return;
  isItemMigrationRunning = true;
  try {
    const allItems = await getAllRecords<DBItem>('items');
    // Specifically find 'dni4dkbmtoiknp4' or any items not starting with 'item-'
    const needsMigration = allItems.filter(i => i.id === 'dni4dkbmtoiknp4' || !i.id.startsWith('item-'));
    if (needsMigration.length === 0) {
      isItemMigrationRunning = false;
      return;
    }

    // Find highest current item-XXX number
    let maxNum = 0;
    for (const item of allItems) {
      if (item.id && item.id.startsWith('item-')) {
        const num = parseInt(item.id.replace('item-', ''), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    for (const item of needsMigration) {
      const oldId = item.id;
      let newId = '';
      if (oldId === 'dni4dkbmtoiknp4') {
        // Specifically requested to be item-001
        const hasItem001 = allItems.some(i => i.id === 'item-001');
        if (!hasItem001) {
          newId = 'item-001';
          if (maxNum < 1) maxNum = 1;
        } else {
          maxNum += 1;
          newId = `item-${String(maxNum).padStart(3, '0')}`;
        }
      } else {
        maxNum += 1;
        newId = `item-${String(maxNum).padStart(3, '0')}`;
      }

      // 1. Put new item and delete old item
      const updatedItem: DBItem = { ...item, id: newId };
      await putRecord<DBItem>('items', updatedItem);
      await deleteRecord('items', oldId);

      // 2. Update inventory_ledger entries
      const allInv = await getAllRecords<DBInventoryLedgerEntry>('inventory_ledger');
      for (const entry of allInv) {
        if (entry.itemId === oldId) {
          const updatedEntry: DBInventoryLedgerEntry = {
            ...entry,
            itemId: newId,
            referenceId: entry.referenceId === ('opening-' + oldId) ? ('opening-' + newId) : entry.referenceId,
          };
          await putRecord<DBInventoryLedgerEntry>('inventory_ledger', updatedEntry);
        }
      }

      // 3. Update trips
      const allTrips = await getAllRecords<DBTrip>('trips');
      for (const trip of allTrips) {
        let changed = false;
        if (trip.itemId === oldId) {
          trip.itemId = newId;
          changed = true;
        }
        if (trip.items && trip.items.length > 0) {
          for (const itm of trip.items) {
            if (itm.itemId === oldId) {
              itm.itemId = newId;
              changed = true;
            }
          }
        }
        if (changed) {
          await putRecord<DBTrip>('trips', trip);
        }
      }

      // 4. Update purchases
      const allPurchases = await getAllRecords<DBPurchase>('purchases');
      for (const purchase of allPurchases) {
        let changed = false;
        if (purchase.itemId === oldId) {
          purchase.itemId = newId;
          changed = true;
        }
        if (purchase.items && purchase.items.length > 0) {
          for (const itm of purchase.items) {
            if (itm.itemId === oldId) {
              itm.itemId = newId;
              changed = true;
            }
          }
        }
        if (changed) {
          await putRecord<DBPurchase>('purchases', purchase);
        }
      }

      // 5. Update sales
      const allSales = await getAllRecords<DBSale>('sales');
      for (const sale of allSales) {
        if (sale.itemId === oldId) {
          sale.itemId = newId;
          await putRecord<DBSale>('sales', sale);
        }
      }
    }
  } catch (err) {
    console.error('Migration error for item IDs:', err);
  } finally {
    isItemMigrationRunning = false;
  }
}

