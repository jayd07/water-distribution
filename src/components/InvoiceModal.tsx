import React, { useState, useEffect } from 'react';
import { Printer, Share2, X, Droplets, Calendar, MapPin, Phone, User, Edit2, Building2, QrCode, Boxes } from 'lucide-react';
import { DeliveryLog, Customer, OrderBooking, BusinessAccount, InventoryItem } from '../types';
import { getActiveBusiness, updateBusiness } from '../services/businessService';
import { getCustomerSkuHoldings, formatSkuHoldingsForWhatsApp, SkuHoldingItem } from '../utils/skuHoldingUtils';
import { generateUpiUri } from '../utils/upiUtils';

export interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery?: DeliveryLog | null;
  order?: OrderBooking | null;
  customer?: Customer | null;
  business?: BusinessAccount | null;
  onUpdateBusiness?: (business: BusinessAccount) => void;
  inventory?: InventoryItem[];
  deliveries?: DeliveryLog[];
  customers?: Customer[];
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  delivery,
  order,
  customer,
  business,
  onUpdateBusiness,
  inventory = [],
  deliveries = [],
  customers = []
}) => {
  const fallbackBiz = getActiveBusiness();
  const currentBiz = business || fallbackBiz;

  // Local state for quick edit if user wants to change business name/address directly on invoice
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [bizNameInput, setBizNameInput] = useState(currentBiz?.name || '');
  const [bizAddressInput, setBizAddressInput] = useState(currentBiz?.address || '');
  const [bizCityInput, setBizCityInput] = useState(currentBiz?.city || '');
  const [bizPhoneInput, setBizPhoneInput] = useState(currentBiz?.ownerPhone || '');
  const [bizGstinInput, setBizGstinInput] = useState(currentBiz?.gstin || '');
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  
  // Option to include transactional due amount QR in WhatsApp text
  const [includeDueQrInWhatsApp, setIncludeDueQrInWhatsApp] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen && currentBiz) {
      setBizNameInput(currentBiz.name || '');
      setBizAddressInput(currentBiz.address || '');
      setBizCityInput(currentBiz.city || '');
      setBizPhoneInput(currentBiz.ownerPhone || '');
      setBizGstinInput(currentBiz.gstin || '');
      setIsEditingBusiness(false);
    }
  }, [isOpen, currentBiz]);

  // Ensure all hooks are declared unconditionally above before this early return
  if (!isOpen || (!delivery && !order && !customer)) return null;

  const displayedBizName = currentBiz?.name?.trim() || 'AquaPure Springs Water Distribution';
  const displayedBizAddress = currentBiz?.address?.trim()
    ? `${currentBiz.address}${currentBiz.city?.trim() ? `, ${currentBiz.city.trim()}` : ''}`
    : (currentBiz?.city?.trim() || 'Plot 42, Water Works Road, Industrial Area, Phase II');
  const displayedBizPhone = currentBiz?.ownerPhone?.trim() || '';
  const displayedBizGstin = currentBiz?.gstin?.trim() || '';
  const displayedBizCategory = currentBiz?.category?.trim() || 'Bulk Water Delivery & Event Cooling Logistics';

  const handleSaveBusinessInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingBiz(true);
    try {
      const bizId = currentBiz?.id || fallbackBiz?.id || 'AquaPure_Springs';
      const updated = await updateBusiness(bizId, {
        name: bizNameInput.trim() || displayedBizName,
        address: bizAddressInput.trim(),
        city: bizCityInput.trim(),
        ownerPhone: bizPhoneInput.trim(),
        gstin: bizGstinInput.trim()
      });
      if (updated) {
        onUpdateBusiness?.(updated);
      }
      setIsEditingBusiness(false);
    } catch (err) {
      console.error('Failed to update business on invoice:', err);
    } finally {
      setIsSavingBiz(false);
    }
  };

  const isOrder = !!order;
  const isCustomerAccount = !delivery && !order && !!customer;
  const invoiceNumber = isOrder 
    ? `INV-ORD-${order.id.replace('ord_', '').toUpperCase()}` 
    : isCustomerAccount
    ? `BILL-CUST-${customer!.id.replace('cust_', '').toUpperCase()}`
    : `INV-DEL-${delivery!.id.replace('del_', '').toUpperCase()}`;
  
  // Resolve customer info
  const targetCustomer = customer || (delivery?.customerId && customers.length > 0 ? customers.find(c => c.id === delivery.customerId) : null);
  const customerName = isOrder ? order.customerName : (delivery?.customerName || targetCustomer?.name || 'Customer');
  const customerPhone = isOrder ? order.customerMobile : (delivery?.customerPhone || targetCustomer?.phone || 'N/A');
  const customerAddress = isOrder ? (order.customerAddress || 'Direct Pickup / Event Venue') : (delivery?.customerAddress || targetCustomer?.address || 'On-file Route Address');
  const timestamp = isOrder ? order.bookingDate : (delivery ? delivery.timestamp : (targetCustomer?.createdAt || Date.now()));
  const dateFormatted = new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate SKU-wise held jars
  const skuHoldings: SkuHoldingItem[] = getCustomerSkuHoldings(targetCustomer, deliveries, inventory);
  const totalHoldingCount = skuHoldings.reduce((sum, h) => sum + h.count, 0) || (targetCustomer?.jarsHolding || 0);

  const handlePrint = () => {
    window.print();
  };

  const payableAmount = isOrder 
    ? (order.paymentStatus !== 'PAID' ? order.totalAmount : 0)
    : isCustomerAccount
    ? (targetCustomer?.dueAmount || 0)
    : (delivery?.amountCollected || 0);

  // STRICT: Only use genuine configured UPI ID. NO defaults, NO synthetic phone@upi.
  const upiId = (currentBiz?.upiId || '').trim();

  // Dynamic transaction URI and live QR code only when a genuine UPI ID is configured
  const upiUrl = (upiId && payableAmount > 0)
    ? generateUpiUri({
        upiId,
        merchantName: displayedBizName,
        amount: payableAmount,
        note: `${invoiceNumber} - ${customerName}`,
        transactionRef: invoiceNumber
      })
    : (upiId ? generateUpiUri({ upiId, merchantName: displayedBizName, note: invoiceNumber }) : '');

  const qrCodeUrl = upiUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(upiUrl)}` : '';

  const generateBillText = () => {
    const headerPrefix = `*${displayedBizName}*
${displayedBizAddress ? `📍 ${displayedBizAddress}\n` : ''}${displayedBizPhone ? `📞 Tel: ${displayedBizPhone}\n` : ''}========================================\n`;

    // Dynamic Due Amount QR and UPI section only when genuinely configured
    let upiFooter = '';
    if (upiId && payableAmount > 0) {
      if (includeDueQrInWhatsApp) {
        upiFooter = `
----------------------------------------
📲 *INSTANT UPI PAYMENT (₹${payableAmount.toLocaleString('en-IN')})*
• UPI ID: \`${upiId}\`
• Direct UPI Pay Link: ${upiUrl}
• Scan / View Due QR Code: ${qrCodeUrl}
----------------------------------------\n`;
      } else {
        upiFooter = `
----------------------------------------
📲 *UPI ID for Payment:* \`${upiId}\`
👉 Pay via GPay / PhonePe / Paytm / BHIM
----------------------------------------\n`;
      }
    }

    if (isOrder) {
      return `${headerPrefix}*Invoice & Order Receipt*
----------------------------------------
*Invoice No:* ${invoiceNumber}
*Date:* ${dateFormatted}
*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Address:* ${customerAddress}
----------------------------------------
*Item:* ${order.itemType}
*Quantity Booked:* ${order.quantity} units
*Rate/Unit:* ₹${order.rentOrPricePerUnit}
*Deposit Paid:* ₹${order.depositAmount}
*Grand Total:* ₹${order.totalAmount}
*Payment Status:* ${order.paymentStatus}
*Order Status:* ${order.status}
${order.deliveryDate ? `*Delivery Date:* ${order.deliveryDate}\n` : ''}${order.notes ? `*Notes:* ${order.notes}\n` : ''}----------------------------------------${upiFooter}
Thank you for your business!`;
    } else if (isCustomerAccount) {
      const skuBreakdownText = formatSkuHoldingsForWhatsApp(skuHoldings);
      return `${headerPrefix}*💧 Customer Account Bill & Ledger*
----------------------------------------
*Bill No:* ${invoiceNumber}
*Date:* ${dateFormatted}
*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Address:* ${customerAddress}
----------------------------------------
${skuBreakdownText}*Pending Due Balance:* ₹${(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')}
*Security Deposit Paid:* ₹${(targetCustomer?.depositPaid || 0).toLocaleString('en-IN')}
*Status:* ${(targetCustomer?.dueAmount || 0) > 0 ? 'PAYMENT PENDING' : 'ALL DUES SETTLED'}
----------------------------------------
${(targetCustomer?.dueAmount || 0) > 0 ? `Please clear the pending balance of ₹${(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')} via UPI or Cash.\n` : ''}${upiFooter}
Thank you for your business!`;
    } else {
      const isReturnOnly = delivery!.jarsDelivered === 0 && delivery!.emptyJarsCollected > 0;
      const skuBreakdownText = skuHoldings.length > 0 ? formatSkuHoldingsForWhatsApp(skuHoldings) : '';
      return `${headerPrefix}*${isReturnOnly ? 'Jar Return Receipt' : 'Delivery Invoice & Receipt'}*
----------------------------------------
*Receipt No:* ${invoiceNumber}
*Date:* ${dateFormatted}
*Customer:* ${customerName}
*Phone:* ${customerPhone}
*Staff / Driver:* ${delivery!.workerName || 'Delivery Staff'}
----------------------------------------
${isReturnOnly ? `*Transaction:* Empty Jar Return
*Empty Jars Returned:* ${delivery!.emptyJarsCollected}
*Amount Collected:* ₹${delivery!.amountCollected}` : `*Item:* ${delivery!.itemType || '20L Normal Jar'}
*Jars Delivered:* ${delivery!.jarsDelivered}
*Empty Collected:* ${delivery!.emptyJarsCollected}
*Amount Paid:* ₹${delivery!.amountCollected}`}
*Payment Mode:* ${delivery!.paymentMode}
${skuBreakdownText ? `----------------------------------------\n${skuBreakdownText}` : ''}----------------------------------------${upiFooter}
Thank you for choosing our service!`;
    }
  };

  const handleSendBill = () => {
    const billText = generateBillText();
    let cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const encodedText = encodeURIComponent(billText);
    const whatsappUrl = cleanPhone.length >= 10 
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
  };

  const handleNativeShare = async () => {
    const text = generateBillText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoiceNumber}`,
          text: text
        });
      } catch (e) {
        console.log('Share dismissed or not supported', e);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert('Invoice details copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        
        {/* Header - Interactive & Actionable (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">Tax Invoice & Receipt</h3>
              <p className="text-xs text-slate-400">{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              id="print-invoice-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={handleSendBill}
              id="send-bill-whatsapp-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Send bill to customer on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Send Bill</span>
            </button>
            <button
              onClick={onClose}
              id="close-invoice-modal-btn"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Paper Area */}
        <div className="p-6 sm:p-8 overflow-y-auto print-only-container bg-white text-slate-900 space-y-6">
          
          {/* Company Brand Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b border-slate-200 gap-4">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-md shrink-0 mt-0.5">
                <Droplets className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {displayedBizName}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsEditingBusiness(!isEditingBusiness)}
                    className="no-print text-[11px] text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                    title="Click to edit business name and address"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingBusiness ? 'Close' : 'Edit Info'}</span>
                  </button>
                </div>

                {isEditingBusiness ? (
                  <form onSubmit={handleSaveBusinessInfo} className="no-print mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 max-w-lg">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                      Edit Business & Invoice Header Details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Business Name</label>
                        <input
                          type="text"
                          value={bizNameInput}
                          onChange={(e) => setBizNameInput(e.target.value)}
                          placeholder="e.g. AquaPure Springs"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Contact Phone</label>
                        <input
                          type="text"
                          value={bizPhoneInput}
                          onChange={(e) => setBizPhoneInput(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Business Address</label>
                      <input
                        type="text"
                        value={bizAddressInput}
                        onChange={(e) => setBizAddressInput(e.target.value)}
                        placeholder="e.g. Plot 42, Water Works Road, Industrial Area"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">City / Location</label>
                        <input
                          type="text"
                          value={bizCityInput}
                          onChange={(e) => setBizCityInput(e.target.value)}
                          placeholder="e.g. Phase II, Ring Road"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">GSTIN / Tax ID (Optional)</label>
                        <input
                          type="text"
                          value={bizGstinInput}
                          onChange={(e) => setBizGstinInput(e.target.value)}
                          placeholder="e.g. 27AAAAA0000A1Z5"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 uppercase"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingBusiness(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingBiz}
                        className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSavingBiz ? 'Saving...' : 'Save & Update'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="text-xs text-slate-600 flex items-start gap-1.5 mt-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
                      <span>{displayedBizAddress}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                      {displayedBizPhone && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{displayedBizPhone}</span>
                        </span>
                      )}
                      {displayedBizGstin && (
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          GST: {displayedBizGstin}
                        </span>
                      )}
                      <span className="text-slate-400 text-[11px]">
                        {displayedBizCategory}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tax Invoice & Delivery Receipt</p>
                  </>
                )}
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 mb-1">
                {isOrder ? 'FUNCTION / EVENT ORDER BILL' : isCustomerAccount ? 'CUSTOMER ACCOUNT STATEMENT' : 'DELIVERY RECEIPT'}
              </span>
              <p className="text-sm font-bold text-slate-800">{invoiceNumber}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 sm:justify-end mt-0.5">
                <Calendar className="w-3 h-3" />
                {dateFormatted}
              </p>
            </div>
          </div>

          {/* Customer & Bill-To Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Customer Details</span>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-600" />
                {customerName}
              </p>
              <p className="text-slate-600 flex items-center gap-1.5 mt-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {customerPhone}
              </p>
              <p className="text-slate-600 flex items-start gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{customerAddress}</span>
              </p>
            </div>

            <div className="sm:border-l sm:border-slate-200 sm:pl-4 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                {isCustomerAccount ? 'Account Particulars' : 'Order Particulars'}
              </span>
              {isOrder ? (
                <>
                  <p className="text-slate-700"><strong className="text-slate-900">Booking Status:</strong> <span className="capitalize">{order.status}</span></p>
                  <p className="text-slate-700"><strong className="text-slate-900">Payment Status:</strong> {order.paymentStatus}</p>
                  {order.deliveryDate && <p className="text-slate-700"><strong className="text-slate-900">Scheduled Delivery:</strong> {order.deliveryDate}</p>}
                  {order.assignedDriver && <p className="text-slate-700"><strong className="text-slate-900">Assigned Van:</strong> {order.assignedDriver}</p>}
                </>
              ) : isCustomerAccount ? (
                <>
                  <p className="text-slate-700"><strong className="text-slate-900">Account Type:</strong> Route Customer</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Status:</strong> {(targetCustomer?.dueAmount || 0) > 0 ? 'Payment Due' : 'All Settled'}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Statement Date:</strong> {dateFormatted}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Total Containers Held:</strong> {totalHoldingCount} jars</p>
                </>
              ) : (
                <>
                  <p className="text-slate-700"><strong className="text-slate-900">Staff Worker:</strong> {delivery!.workerName}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Payment Mode:</strong> {delivery!.paymentMode}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Dispatched:</strong> {dateFormatted}</p>
                  <p className="text-slate-700"><strong className="text-slate-900">Total Containers Held:</strong> {totalHoldingCount} jars</p>
                </>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Qty / Bottles</th>
                  <th className="py-2.5 px-3 text-right">Unit Rate</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {isOrder ? (
                  <>
                    <tr>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {order.itemType}
                        <span className="block text-[11px] text-slate-500 font-normal">Cooler / Bulk jar event booking reservation</span>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold">{order.quantity}</td>
                      <td className="py-3 px-3 text-right">₹{order.rentOrPricePerUnit}</td>
                      <td className="py-3 px-3 text-right font-medium">₹{order.quantity * order.rentOrPricePerUnit}</td>
                    </tr>
                    {order.depositAmount > 0 && (
                      <tr className="bg-amber-50/50">
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          Security Deposit (Refundable)
                          <span className="block text-[11px] text-slate-500 font-normal">Held for equipment & jars safe return</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">-</td>
                        <td className="py-2.5 px-3 text-right">-</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-amber-900">₹{order.depositAmount}</td>
                      </tr>
                    )}
                  </>
                ) : isCustomerAccount ? (
                  <>
                    {/* SKU-Wise Breakdown of Jars Held with Customer */}
                    {skuHoldings.length > 0 ? (
                      skuHoldings.map((sku) => (
                        <tr key={sku.itemType} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span className="font-semibold text-slate-900">{sku.displayName || sku.itemType}</span>
                            </div>
                            <span className="block text-[11px] text-slate-500 font-normal pl-5">
                              Jars in customer possession (Refill Rate: ₹{sku.unitPrice}/jar • Deposit: ₹{sku.depositAmount})
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-extrabold text-slate-900 text-sm">
                            {sku.count}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-slate-600">
                            ₹{sku.unitPrice}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-900">
                            {sku.count} {sku.count === 1 ? 'jar' : 'jars'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          Packaged Water Jars in Circulation
                          <span className="block text-[11px] text-slate-500 font-normal">No jars currently in customer possession</span>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">0</td>
                        <td className="py-3 px-3 text-right">-</td>
                        <td className="py-3 px-3 text-right font-medium text-slate-500">0 jars</td>
                      </tr>
                    )}

                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        Customer Security Deposit (Paid)
                        <span className="block text-[11px] text-slate-500 font-normal">Refundable deposit on bottle return</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">-</td>
                      <td className="py-2.5 px-3 text-right">-</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">₹{(targetCustomer?.depositPaid || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-rose-900 bg-rose-50/50">
                        Outstanding Due Balance
                        <span className="block text-[11px] text-slate-500 font-normal">Unpaid deliveries and account ledger dues</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">-</td>
                      <td className="py-2.5 px-3 text-right">-</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600">₹{(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </>
                ) : (
                  <>
                    {delivery!.jarsDelivered > 0 && (
                      <tr>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="font-semibold text-slate-900">{delivery!.itemType || '20L Normal Jar'}</span>
                          </div>
                          <span className="block text-[11px] text-slate-500 font-normal pl-5">Fresh refill containers delivered</span>
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-slate-900">{delivery!.jarsDelivered}</td>
                        <td className="py-3 px-3 text-right">
                          ₹{((delivery!.amountCollected && delivery!.jarsDelivered) ? (delivery!.amountCollected / delivery!.jarsDelivered).toFixed(0) : '35')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">₹{delivery!.amountCollected}</td>
                      </tr>
                    )}
                    {delivery!.emptyJarsCollected > 0 && (
                      <tr className="bg-emerald-50/40">
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          Empty Bottles / Jars Returned ({delivery!.itemType || '20L Normal Jar'})
                          <span className="block text-[11px] text-emerald-700 font-normal">Jar return transaction • Customer float updated</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{delivery!.emptyJarsCollected}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-500">₹0</td>
                      </tr>
                    )}
                    {delivery!.jarsDelivered === 0 && delivery!.amountCollected > 0 && (
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          Pending Due Settlement Collected
                          <span className="block text-[11px] text-slate-500 font-normal">Received during empty jar return</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold">-</td>
                        <td className="py-2.5 px-3 text-right">-</td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-700">₹{delivery!.amountCollected}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals, Terms & Instant UPI QR Payment Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* UPI QR Payment Block for Customer - ONLY if genuine UPI configured */}
            {upiId && qrCodeUrl ? (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3.5">
                <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-2xs shrink-0">
                  <img 
                    src={qrCodeUrl} 
                    alt="UPI QR Code" 
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <QrCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Scan to Pay via UPI</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    GPay • PhonePe • Paytm • BHIM
                  </p>
                  <div className="pt-0.5">
                    <span className="text-[10px] text-slate-400 block font-mono">UPI ID:</span>
                    <span className="text-xs font-semibold text-indigo-900 font-mono select-all bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 block truncate">
                      {upiId}
                    </span>
                  </div>
                  {payableAmount > 0 && (
                    <span className="text-[11px] font-bold text-slate-900 block pt-0.5">
                      Amount: <span className="text-emerald-700 font-extrabold">₹{payableAmount.toLocaleString('en-IN')}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Settlement & Payment Modes</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Cash on Delivery / Direct Settlement with Delivery Driver.
                </p>
                {displayedBizPhone && (
                  <p className="text-[11px] font-medium text-slate-500">
                    Contact: +91 {displayedBizPhone}
                  </p>
                )}
                {!upiId && (
                  <p className="text-[10px] text-slate-400 italic pt-0.5">
                    (To enable UPI QR & 1-tap links, configure your UPI ID in Business Settings)
                  </p>
                )}
              </div>
            )}

            {/* Financial Summary Box with SKU Breakdown */}
            <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs flex flex-col justify-between">
              {isOrder ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Booking Subtotal:</span>
                    <span>₹{order.quantity * order.rentOrPricePerUnit}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Security Deposit:</span>
                    <span>₹{order.depositAmount}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total Amount:</span>
                    <span className="text-cyan-700">₹{order.totalAmount}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-500 pt-1">
                    <span>Payment Status:</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${
                      order.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {order.paymentStatus}
                    </span>
                  </div>
                </>
              ) : isCustomerAccount ? (
                <>
                  {/* SKU-Wise Bottles Held Summary */}
                  <div className="space-y-1.5 border-b border-slate-200 pb-2">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-bold text-slate-900">Jars in Possession (SKU-wise):</span>
                      <strong className="text-slate-900 font-extrabold">{totalHoldingCount} jars</strong>
                    </div>
                    {skuHoldings.length > 0 ? (
                      <div className="space-y-1 pl-2 border-l-2 border-sky-400">
                        {skuHoldings.map((sku) => (
                          <div key={sku.itemType} className="flex justify-between text-[11px] text-slate-600">
                            <span className="truncate pr-1">• {sku.displayName || sku.itemType}:</span>
                            <span className="font-bold text-slate-900 shrink-0">{sku.count} jars</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 pl-2">0 jars with customer</p>
                    )}
                  </div>

                  <div className="flex justify-between text-slate-600 pt-0.5">
                    <span>Deposit Paid:</span>
                    <span className="font-medium text-slate-800">₹{(targetCustomer?.depositPaid || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                    <span>Pending Due Balance:</span>
                    <span className={(targetCustomer?.dueAmount || 0) > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                      ₹{(targetCustomer?.dueAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Refill Cost:</span>
                    <span>₹{delivery!.amountCollected}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Mode:</span>
                    <span className="font-medium text-slate-800">{delivery!.paymentMode}</span>
                  </div>

                  {/* SKU-Wise Customer Possession Status */}
                  {skuHoldings.length > 0 && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1 my-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800">Customer Jars Held (SKU-wise):</span>
                        <strong className="text-sky-700 font-extrabold">{totalHoldingCount} total</strong>
                      </div>
                      <div className="space-y-0.5 pl-1.5 border-l-2 border-sky-300">
                        {skuHoldings.map((sku) => (
                          <div key={sku.itemType} className="flex justify-between text-[10px] text-slate-600">
                            <span className="truncate pr-1">• {sku.displayName || sku.itemType}:</span>
                            <span className="font-bold text-slate-900 shrink-0">{sku.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                    <span>Amount Paid:</span>
                    <span className="text-emerald-700">₹{delivery!.amountCollected}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
            <p>• Coolers & empty jars remain property of {displayedBizName}.</p>
            <p>• Security deposits are refundable upon undamaged equipment return.</p>
          </div>

          {/* Authorized Signature Box */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-400">
            <div className="text-left text-[11px] text-slate-500">
              <p>Thank you for your business!</p>
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1"></div>
              <p className="text-[11px] text-slate-500">Authorized Signature</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden during print) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Due QR WhatsApp Inclusion Option */}
          {upiId && payableAmount > 0 ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors select-none shadow-2xs">
              <input
                type="checkbox"
                checked={includeDueQrInWhatsApp}
                onChange={(e) => setIncludeDueQrInWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Include Due Amount QR Link (₹{payableAmount.toLocaleString('en-IN')})</span>
              </span>
            </label>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              {!upiId ? 'No UPI ID configured' : 'No balance pending'}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleNativeShare}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Copy Text</span>
            </button>
            <button
              type="button"
              onClick={handleSendBill}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Send WhatsApp Bill</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
