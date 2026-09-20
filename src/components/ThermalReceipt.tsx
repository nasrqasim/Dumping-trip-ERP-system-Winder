import React from 'react';

export interface ThermalReceiptItem {
  name: string;
  subText?: string;
  qty: number | string;
  unit?: string;
  rate: number;
  total: number;
}

export interface ThermalReceiptProps {
  receiptTitle?: string; // e.g. "SALE RECEIPT", "TRIP RECEIPT", "DIESEL RECEIPT", "MAINTENANCE RECEIPT"
  receiptNo: string;
  date: string;
  time?: string;
  operatorName?: string;
  salesPerson?: string;
  customerName?: string;
  customerLabel?: string;
  paymentType?: string;
  vehicleNo?: string;
  driverName?: string;
  pumpVendorName?: string;
  slipNo?: string;
  extraFields?: { label: string; value: string }[];
  items: ThermalReceiptItem[];
  itemCount?: number;
  totalQty?: number | string;
  grossTotal: number;
  discount?: number;
  netTotal: number;
  amountReceived: number;
  remainingDue?: number;
  cashBack?: number;
  notes?: string;
}

export default function ThermalReceipt({
  receiptTitle = 'SALE RECEIPT',
  receiptNo,
  date,
  time,
  operatorName = 'Administrator',
  salesPerson = '-',
  customerName,
  customerLabel = 'Customer Name:',
  paymentType = 'CASH',
  vehicleNo,
  driverName,
  pumpVendorName,
  slipNo,
  extraFields = [],
  items,
  itemCount,
  totalQty,
  grossTotal,
  discount = 0,
  netTotal,
  amountReceived,
  remainingDue,
  cashBack,
  notes,
}: ThermalReceiptProps) {
  const currentTimeStr = time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  
  // Format Date to DD/MM/YYYY if in YYYY-MM-DD
  let displayDate = date;
  if (date && date.includes('-')) {
    const parts = date.split('-');
    if (parts.length === 3) {
      displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  const computedItemCount = itemCount !== undefined ? itemCount : items.length;
  const computedTotalQty = totalQty !== undefined ? totalQty : items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
  const computedCashBack = cashBack !== undefined ? cashBack : Math.max(0, amountReceived - netTotal);
  const computedRemainingDue = remainingDue !== undefined ? remainingDue : Math.max(0, netTotal - amountReceived);

  return (
    <div className="print-only print-receipt p-2 bg-white text-black font-sans text-xs max-w-[320px] mx-auto select-none leading-tight">
      {/* Centered Logo */}
      <div className="flex justify-center mb-1">
        <img 
          src="/logo.jpeg" 
          alt="Emblem" 
          className="h-12 w-12 rounded-full object-contain mx-auto" 
        />
      </div>

      {/* Business Header */}
      <div className="text-center mb-1">
        <h1 className="text-xl font-black uppercase tracking-wide text-black leading-none mb-1">
          AL HADEED TRADERS
        </h1>
        <p className="text-xs font-bold text-black">Winder Lasbela</p>
        <p className="text-xs font-bold text-black">Tel: 03108444612</p>
      </div>

      {/* Black Header Banner */}
      <div className="bg-black text-white text-center font-black py-1 px-2 text-xs tracking-widest uppercase my-2">
        {receiptTitle}
      </div>

      {/* Metadata Key-Value Block */}
      <div className="text-[11px] text-black space-y-1 mb-1 font-sans">
        <div className="flex justify-between items-center">
          <span className="text-slate-900 font-medium">Receipt No.</span>
          <span className="font-bold">{receiptNo}</span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-slate-900 font-medium">Date </span>
            <span className="font-bold">{displayDate}</span>
          </div>
          <div>
            <span className="text-slate-900 font-medium">Time </span>
            <span className="font-bold">{currentTimeStr}</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-900 font-medium">Operator Name:</span>
          <span className="font-bold">{operatorName}</span>
        </div>
        {salesPerson && (
          <div className="flex justify-between items-center">
            <span className="text-slate-900 font-medium">Sales Person:</span>
            <span>{salesPerson}</span>
          </div>
        )}
        {customerName && (
          <div className="flex justify-between items-center">
            <span className="text-slate-900 font-medium">{customerLabel}</span>
            <span className="font-bold truncate max-w-[170px] text-right">{customerName}</span>
          </div>
        )}
        {vehicleNo && (
          <div className="flex justify-between items-center">
            <span className="text-slate-900 font-medium">Vehicle / Dumper:</span>
            <span className="font-bold">{vehicleNo}</span>
          </div>
        )}
        {driverName && (
          <div className="flex justify-between items-center">
            <span className="text-slate-900 font-medium">Driver Name:</span>
            <span className="font-bold">{driverName}</span>
          </div>
        )}
        {pumpVendorName && (
          <div className="flex justify-between items-center">
            <span className="text-slate-900 font-medium">Fuel Pump / Station:</span>
            <span className="font-bold">{pumpVendorName}</span>
          </div>
        )}
        {slipNo && (
          <div className="flex justify-between items-center">
            <span className="text-slate-900 font-medium">Slip / Reference #:</span>
            <span className="font-bold">{slipNo}</span>
          </div>
        )}
        {extraFields.map((f, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-slate-900 font-medium">{f.label}</span>
            <span className="font-bold">{f.value}</span>
          </div>
        ))}
        <div className="flex justify-between items-center">
          <span className="text-slate-900 font-medium">Payment Type:</span>
          <span className="font-bold uppercase">{paymentType}</span>
        </div>
      </div>

      {/* Items Table Divider Header */}
      <div className="border-t-2 border-b-2 border-black py-1 my-1">
        <div className="flex justify-between text-[11px] font-black uppercase text-black">
          <span className="w-5/12 text-left">Description</span>
          <span className="w-2/12 text-center">Qty</span>
          <span className="w-2/12 text-right">Price/Unit</span>
          <span className="w-3/12 text-right">Total</span>
        </div>
      </div>

      {/* Items Rows */}
      <div className="space-y-1.5 my-1.5 text-[11px]">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="font-bold text-black text-xs">
              {item.name}
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="w-5/12 text-[10px] text-slate-800 truncate pr-1">
                {item.subText || (item.unit ? `Unit: ${item.unit}` : '')}
              </span>
              <span className="w-2/12 text-center font-bold">
                {item.qty} {item.unit ? <span className="text-[9px] block font-normal">{item.unit}</span> : null}
              </span>
              <span className="w-2/12 text-right font-bold">
                {item.rate.toLocaleString()}
              </span>
              <span className="w-3/12 text-right font-bold">
                {item.total.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Fine dashed separator */}
      <div className="border-b border-dashed border-black my-1.5"></div>

      {/* Item Count & Quantity */}
      <div className="flex justify-between items-center text-[11px] font-bold text-black my-1">
        <span>Item(s) &nbsp;{computedItemCount}</span>
        <span>Total Qty &nbsp;{computedTotalQty}</span>
      </div>

      {/* Gross & Discounts */}
      <div className="border-t-2 border-b-2 border-black py-1 my-1 space-y-0.5 text-xs font-bold">
        <div className="flex justify-between">
          <span>Gross Total</span>
          <span>{grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-slate-900">
            <span>Discount</span>
            <span>-{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {/* NET TOTAL PKR BANNER */}
      <div className="flex justify-between items-center py-1 my-1 text-sm font-black border-t-2 border-b-2 border-black text-black">
        <span>NET TOTAL PKR</span>
        <span>{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      {/* Payment / Balance Section */}
      <div className="space-y-0.5 text-xs font-bold text-black pt-0.5 mb-2">
        <div className="flex justify-between">
          <span>Amount Received</span>
          <span>{amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        {computedRemainingDue > 0 ? (
          <div className="flex justify-between font-black">
            <span>Remaining Due (Credit)</span>
            <span>{computedRemainingDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span>Cash Back PKR</span>
            <span>{computedCashBack.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {/* Visit Greeting */}
      <div className="text-center font-black text-[11px] tracking-wider uppercase my-2">
        *THANKS FOR YOUR VISIT*
      </div>

      {/* Divider */}
      <div className="border-t-2 border-black pt-1.5 my-1"></div>

      {/* Software Developer Footer */}
      <div className="text-center text-[10px] font-bold text-black font-sans leading-tight">
        Software By: Roonjha Developers - 03152914836
      </div>
    </div>
  );
}
