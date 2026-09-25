import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Type definitions matching exact application schema
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
  category?: 'tons' | 'hours' | 'trips' | 'truck';
  measurement?: 'tons' | 'hours' | 'trips';
  make?: string;
  model?: string;
  manufacturingYear?: string;
  chassisNo?: string;
  engineNo?: string;
  ownerName?: string;
  ownerContact?: string;
  capacityUnit?: 'Ton' | 'KG' | 'Hour' | 'Trip';
  hourlyRate?: number;
  perTripRate?: number;
  perTonRate?: number;
  currentOdometer?: number;
  currentEngineHours?: number;
  status?: 'active' | 'inactive' | 'available' | 'on_trip' | 'maintenance';
  driverId?: string;
  driverCnic?: string;
  driverPhone?: string;
  driverAddress?: string;
  currentLocation?: string;
  currentTripId?: string;
  regExpiry?: string;
  fitnessExpiry?: string;
  insuranceExpiry?: string;
  notes?: string;
}

export interface DBDriverAssignment {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  originalDriverId?: string;
  originalDriverName?: string;
  replacementDriverId?: string;
  replacementDriverName?: string;
  reason?: string;
  startDateTime: string;
  endDateTime?: string;
  tripId?: string;
  authorizedBy?: string;
  createdDate: string;
}

export interface DBDirectPurchase {
  id: string;
  date: string;
  vendorId: string;
  vendorName?: string;
  invoiceNo?: string;
  category: string;
  description: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  total: number;
  paidAmount: number;
  remainingBalance: number;
  paymentType: 'Cash' | 'Bank' | 'Credit';
  bankId?: string;
  vehicleId?: string;
  driverId?: string;
  tripId?: string;
  notes?: string;
}

export interface DBDieselTransaction {
  id: string;
  date: string;
  vehicleId: string;
  vehicleNumber?: string;
  driverId?: string;
  driverName?: string;
  vendorId: string;
  vendorName?: string;
  fuelPumpName?: string;
  slipNo?: string;
  litres: number;
  ratePerLitre: number;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  paymentType: 'Cash' | 'Bank' | 'Credit';
  bankId?: string;
  odometerReading?: number;
  meterReading?: number;
  fuelType?: 'Diesel' | 'Petrol' | 'Mobil Oil';
  tripId?: string;
  receiptNo?: string;
  notes?: string;
}

export interface DBDieselUsage {
  id: string;
  date: string;
  vehicleId: string;
  vehicleNumber?: string;
  driverId?: string;
  driverName?: string;
  litresUsed: number;
  ratePerLitre: number;
  totalCost: number;
  odometer?: number;
  engineHours?: number;
  tripId?: string;
  source?: string;
  notes?: string;
}

export interface DBVehicleMaintenance {
  id: string;
  date: string;
  vehicleId: string;
  vehicleNumber?: string;
  driverId?: string;
  driverName?: string;
  category: string;
  maintenanceType?: string;
  workshopVendor?: string;
  workshopVendorId?: string;
  workshopName?: string;
  vendorId?: string;
  description: string;
  partsCost: number;
  labourCost: number;
  otherCost?: number;
  totalCost: number;
  paidAmount: number;
  remainingBalance: number;
  paymentType: 'Cash' | 'Bank' | 'Credit';
  bankId?: string;
  odometer?: number;
  engineHours?: number;
  nextServiceDate?: string;
  nextServiceOdometer?: number;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  notes?: string;
}

export interface DBDriverAdvance {
  id: string;
  date: string;
  driverId: string;
  driverName?: string;
  vehicleId?: string;
  tripId?: string;
  amount: number;
  paymentType: 'Cash' | 'Bank';
  bankId?: string;
  purpose: string;
  status: 'Approved' | 'Settled' | 'Carried Forward' | 'Returned';
  approvedBy?: string;
  notes?: string;
}

export interface DBDriverExpenseSubmission {
  id: string;
  date: string;
  driverId: string;
  driverName?: string;
  vehicleId?: string;
  tripId?: string;
  category: string;
  description: string;
  amountClaimed: number;
  amountApproved: number;
  amountRejected: number;
  status: 'Pending' | 'Approved' | 'Partially Approved' | 'Rejected' | 'Settled';
  notes?: string;
}

export interface DBStaffCategory {
  id: string;
  name: string;
  active: boolean;
}

export interface DBMaintenanceCategory {
  id: string;
  name: string;
  active: boolean;
}

export interface DBDirectPurchaseCategory {
  id: string;
  name: string;
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
  category?: string;
  cnic?: string;
  cnicDocUrl?: string;
  licenseNo?: string;
  licenseExpiry?: string;
  salaryType?: 'Monthly' | 'Daily' | 'Trip-based' | 'Commission';
  address?: string;
  emergencyContact?: string;
  fatherName?: string;
  status?: 'Active' | 'Inactive' | 'On Leave' | 'Suspended' | 'Available' | 'On Trip';
  assignedVehicleId?: string;
  assignedDuties?: string;
  joiningDate?: string;
  notes?: string;
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
  billingType?: 'fixed' | 'hourly';
  startTime?: string;
  endTime?: string;
  totalHours?: number;
  hourlyRate?: number;
  odometerStart?: number;
  odometerEnd?: number;
  hoursStart?: number;
  hoursEnd?: number;
  driverCnic?: string;
  driverPhone?: string;
  vehicleModel?: string;
  tripStatus?: 'active' | 'completed' | 'cancelled';
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
  paidAmount?: number; // Amount paid on spot (e.g. in cash or bank)
  remainingBalance?: number; // total - paidAmount
  paymentType: 'Cash' | 'Bank' | 'Credit' | 'Advance';
  bankId?: string;
}

export interface DBLedgerEntry {
  id: string;
  date: string;
  type: 'opening' | 'trip' | 'purchase' | 'direct_purchase' | 'diesel' | 'maintenance' | 'driver_advance' | 'driver_expense' | 'sale' | 'cash_receipt' | 'bank_receipt' | 'cash_payment' | 'bank_payment' | 'other_income' | 'general_expense' | 'salary_payment' | 'staff_advance' | 'staff_loan' | string;
  referenceId: string;
  accountId: string; // customerId | vendorId | bankId | staffId | 'cash' | 'sales_revenue' | 'trip_revenue' | 'expenses_trip' | 'expenses_general' | 'expenses_diesel' | 'expenses_maintenance' | 'expenses_direct_purchase' | 'other_income_revenue' | 'salary_expense'
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
  type: 'salary' | 'advance' | 'loan' | 'settlement' | 'advance_repayment' | 'loan_repayment';
  amount: number;
  advanceAdjusted?: number;
  loanAdjusted?: number;
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

export interface DBUser {
  id: string;
  username: string;
  name: string;
  role: 'superadmin' | 'manager' | 'operator';
  passwordHash: string;
  salt: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type StoreName =
  | 'items'
  | 'customers'
  | 'vendors'
  | 'vehicles'
  | 'banks'
  | 'staff'
  | 'trips'
  | 'purchases'
  | 'direct_purchases'
  | 'diesel_transactions'
  | 'diesel_usage'
  | 'vehicle_maintenance'
  | 'driver_advances'
  | 'driver_expenses'
  | 'driver_assignments'
  | 'staff_categories'
  | 'maintenance_categories'
  | 'direct_purchase_categories'
  | 'sales'
  | 'ledgers'
  | 'inventory_ledger'
  | 'general_expenses'
  | 'other_incomes'
  | 'staff_payments'
  | 'vouchers'
  | 'users';

// Helper to sanitize JavaScript objects for Firestore (removes undefined values)
export function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)).filter(item => item !== undefined);
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean;
  }
  return data;
}

// In-memory cache layer for high-speed multi-tab navigation & reporting
interface CacheEntry<T = any> {
  data: T[];
  timestamp: number;
}

const memoryCache = new Map<StoreName, CacheEntry>();
const inFlightPromises = new Map<StoreName, Promise<any[]>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Invalidate cached collection data.
 * If storeName is provided, only that collection is invalidated.
 * If omitted, the entire cache is cleared.
 */
export function invalidateCache(storeName?: StoreName): void {
  if (storeName) {
    memoryCache.delete(storeName);
    inFlightPromises.delete(storeName);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Firestore Cache] Invalidated cache for: ${storeName}`);
    }
  } else {
    memoryCache.clear();
    inFlightPromises.clear();
    if (process.env.NODE_ENV === 'development') {
      console.log('[Firestore Cache] Cleared entire collection cache');
    }
  }
}

/**
 * Fetch all records for a collection from Firestore, utilizing in-memory caching and request deduplication.
 * @param storeName Name of the Firestore collection
 * @param forceRefresh If true, bypasses the in-memory cache and re-fetches fresh data from Firestore
 */
export async function getAllRecords<T>(storeName: StoreName, forceRefresh: boolean = false): Promise<T[]> {
  const now = Date.now();
  
  // 1. Check valid memory cache
  if (!forceRefresh) {
    const cached = memoryCache.get(storeName);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data as T[];
    }
  }

  // 2. Check if a request for this store is already in-flight
  if (!forceRefresh && inFlightPromises.has(storeName)) {
    return inFlightPromises.get(storeName)! as Promise<T[]>;
  }

  // 3. Initiate fresh Firestore query
  const startTime = performance.now();
  const fetchPromise = (async () => {
    try {
      const colRef = collection(db, storeName);
      const snap = await getDocs(colRef);
      const records: T[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        records.push({ ...data, id: docSnap.id } as unknown as T);
      });

      // Save to memory cache
      memoryCache.set(storeName, { data: records, timestamp: Date.now() });

      if (process.env.NODE_ENV === 'development') {
        const duration = Math.round(performance.now() - startTime);
        console.log(`[Firestore Cache] Fetched '${storeName}' (${records.length} docs) in ${duration}ms`);
      }

      return records;
    } catch (err) {
      console.error('Error fetching collection ' + storeName + ' from Firestore:', err);
      return [];
    } finally {
      inFlightPromises.delete(storeName);
    }
  })();

  inFlightPromises.set(storeName, fetchPromise);
  return fetchPromise;
}

/**
 * Concurrently fetch multiple collections in parallel using Promise.all
 */
export async function getMultipleStores<T = any>(storeNames: StoreName[], forceRefresh: boolean = false): Promise<{ [key in StoreName]?: T[] }> {
  const results = await Promise.all(
    storeNames.map(async (name) => {
      const data = await getAllRecords(name, forceRefresh);
      return { name, data };
    })
  );

  const map: { [key in StoreName]?: any[] } = {};
  for (const { name, data } of results) {
    map[name] = data;
  }
  return map;
}

export async function getRecordById<T>(storeName: StoreName, id: string): Promise<T | null> {
  if (!id) return null;
  try {
    const docRef = doc(db, storeName, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...snap.data(), id: snap.id } as unknown as T;
    }
    return null;
  } catch (err) {
    console.error('Error fetching document ' + storeName + '/' + id + ' from Firestore:', err);
    return null;
  }
}

export async function putRecord<T extends { id?: string }>(storeName: StoreName, record: T): Promise<void> {
  try {
    const cleanRecord = sanitizeForFirestore(record);
    const docId = record.id;
    if (!docId) {
      const docRef = doc(collection(db, storeName));
      await setDoc(docRef, { ...cleanRecord, id: docRef.id });
    } else {
      const docRef = doc(db, storeName, docId);
      await setDoc(docRef, cleanRecord, { merge: true });
    }
    // Invalidate collection cache so subsequent reads immediately reflect mutations
    invalidateCache(storeName);
  } catch (err) {
    console.error('Error writing document to ' + storeName + ':', err);
    throw err;
  }
}

export async function addRecord<T extends { id?: string }>(storeName: StoreName, record: T): Promise<void> {
  return putRecord(storeName, record);
}

export async function deleteRecord(storeName: StoreName, id: string): Promise<void> {
  if (!id) return;
  try {
    const docRef = doc(db, storeName, id);
    await deleteDoc(docRef);
    // Invalidate collection cache
    invalidateCache(storeName);
  } catch (err) {
    console.error('Error deleting document ' + storeName + '/' + id + ' from Firestore:', err);
    throw err;
  }
}

export async function clearStore(storeName: StoreName): Promise<void> {
  try {
    const colRef = collection(db, storeName);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      invalidateCache(storeName);
      return;
    }
    
    // Delete in batches (Firestore max 500 operations per batch)
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      count++;
      if (count === 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
    invalidateCache(storeName);
  } catch (err) {
    console.error('Error clearing collection ' + storeName + ' in Firestore:', err);
    throw err;
  }
}

// Auto-migration to ensure all items have clean sequential IDs (item-001, item-002, etc.)
let isItemMigrationRunning = false;
export async function migrateItemIds(): Promise<void> {
  if (isItemMigrationRunning) return;
  isItemMigrationRunning = true;
  try {
    const allItems = await getAllRecords<DBItem>('items');
    // Find 'dni4dkbmtoiknp4' or any legacy non-sequential item IDs
    const needsMigration = allItems.filter(i => i.id === 'dni4dkbmtoiknp4' || !i.id.startsWith('item-'));
    if (needsMigration.length === 0) {
      isItemMigrationRunning = false;
      return;
    }

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
        const hasItem001 = allItems.some(i => i.id === 'item-001');
        if (!hasItem001) {
          newId = 'item-001';
          if (maxNum < 1) maxNum = 1;
        } else {
          maxNum += 1;
          newId = 'item-' + String(maxNum).padStart(3, '0');
        }
      } else {
        maxNum += 1;
        newId = 'item-' + String(maxNum).padStart(3, '0');
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
