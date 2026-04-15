import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrdersExport } from '../hooks/useOrdersExport';
import { generateOrdersCSV, downloadCSV } from '../utils/csvExport';
import { supabase } from '../lib/supabaseClient';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AdminPanel = () => {
  const navigate = useNavigate();
  const { orders, loading, error, fetchOrdersForExport } = useOrdersExport();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    paymentStatus: 'all',
    orderSource: 'all',
  });
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [clearingCompleted, setClearingCompleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [todaySummary, setTodaySummary] = useState({ orders: 0, sales: 0 });

  const fetchTodaySummary = async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const endExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).toISOString();

    const { data, error: summaryError } = await supabase
      .from('orders')
      .select('id, total_amount, status')
      .gte('created_at', start)
      .lt('created_at', endExclusive);

    if (summaryError) return;

    const rows = data || [];
    const sales = rows
      .filter((row) => row.status !== 'cancelled')
      .reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

    setTodaySummary({ orders: rows.length, sales });
  };

  useEffect(() => {
    fetchTodaySummary();
    fetchOrdersForExport({});
  }, [fetchOrdersForExport]);

  const runFetch = async (nextFilters) => {
    setActionError('');
    setSuccessMessage('');
    await fetchOrdersForExport(nextFilters);
    await fetchTodaySummary();
  };

  const handleQuickRange = async (type) => {
    const now = new Date();
    let startDate = '';
    let endDate = '';

    if (type === 'today') {
      startDate = formatDateInput(now);
      endDate = formatDateInput(now);
    } else if (type === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = formatDateInput(yesterday);
      endDate = formatDateInput(yesterday);
    } else if (type === 'last7') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      startDate = formatDateInput(start);
      endDate = formatDateInput(now);
    } else if (type === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = formatDateInput(start);
      endDate = formatDateInput(now);
    }

    const nextFilters = { ...filters, startDate, endDate };
    setFilters(nextFilters);
    await runFetch(nextFilters);
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) => {
      const haystack = [
        order.orderId,
        order.orderDate,
        order.customerName,
        order.phoneNumber,
        order.deliveryAddress,
        order.specialInstructions,
        order.paymentMethod,
        order.paymentStatus,
        order.promoCode,
        order.discountAmount,
        order.orderSource,
        order.itemsSummary,
        ...(order.orderItems || []).map((item) => `${item.name} ${item.quantity}`),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [orders, searchTerm]);

  const completedCount = useMemo(
    () => orders.filter((order) => order.status === 'completed').length,
    [orders]
  );

  const rangeSummary = useMemo(() => {
    const nonCancelled = filteredOrders.filter((order) => order.status !== 'cancelled');
    const sales = nonCancelled.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const externalOrders = nonCancelled.filter((order) => order.orderSource === 'external');

    const totals = nonCancelled.reduce(
      (acc, order) => {
        const method = String(order.paymentMethod || '').toUpperCase();
        if (method === 'COD') acc.cod += Number(order.totalAmount || 0);
        if (method === 'GCASH') acc.gcash += Number(order.totalAmount || 0);
        if (method === 'GOTYME') acc.gotyme += Number(order.totalAmount || 0);
        if (method === 'UNIONBANK') acc.unionbank += Number(order.totalAmount || 0);
        return acc;
      },
      { cod: 0, gcash: 0, gotyme: 0, unionbank: 0 }
    );

    return {
      orders: filteredOrders.length,
      sales,
      externalOrders: externalOrders.length,
      externalSales: externalOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      ...totals,
    };
  }, [filteredOrders]);

  const renderProofText = (order) => {
    if (String(order.paymentMethod || '').toUpperCase() === 'COD') return 'Not required';
    if (order.paymentProofOption === 'scan_on_delivery') return 'Scan on delivery';
    if (order.paymentProofUrl) return 'Uploaded';
    return 'No upload yet';
  };

  const handleExportCSV = () => {
    if (!orders.length) {
      alert('No orders to export');
      return;
    }
    const csv = generateOrdersCSV(orders);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `orders_${stamp}.csv`);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setSavingOrderId(orderId);
    setActionError('');
    const { error: updateError } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    setSavingOrderId(null);
    if (updateError) {
      setActionError(updateError.message);
      return;
    }
    setSuccessMessage(`Order status updated to ${newStatus}.`);
    await runFetch(filters);
  };

  const handlePaymentStatusChange = async (orderId, newPaymentStatus) => {
    setSavingOrderId(orderId);
    setActionError('');
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: newPaymentStatus })
      .eq('id', orderId);
    setSavingOrderId(null);
    if (updateError) {
      setActionError(updateError.message);
      return;
    }
    setSuccessMessage(`Payment status updated to ${newPaymentStatus}.`);
    await runFetch(filters);
  };

  const handleClearCompletedOrders = async () => {
    const completed = orders.filter((order) => order.status === 'completed');
    if (!completed.length) return alert('No completed orders to clear.');
    if (!window.confirm('Clear all completed orders?')) return;

    setClearingCompleted(true);
    setActionError('');
    const ids = completed.map((order) => order.orderId);
    const { error: deleteError } = await supabase.from('orders').delete().in('id', ids);
    setClearingCompleted(false);
    if (deleteError) {
      setActionError(deleteError.message);
      return;
    }
    setExpandedOrderId(null);
    setSuccessMessage('Completed orders cleared.');
    await runFetch(filters);
  };

  const handlePrintReceipt = (order) => {
    const receiptWindow = window.open('', '_blank', 'width=800,height=900');
    if (!receiptWindow) return alert('Please allow popups to print the receipt.');

    const subtotalBeforeDiscount = Number(order.totalAmount || 0) + Number(order.discountAmount || 0);
    const itemRows = (order.orderItems || [])
      .map(
        (item) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">₱${Number(item.subtotal || 0).toFixed(2)}</td>
          </tr>
        `
      )
      .join('');

    receiptWindow.document.write(`<!DOCTYPE html><html><head><title>Receipt ${order.orderId}</title><meta charset="UTF-8" /></head><body style="font-family:Arial,sans-serif;padding:24px;color:#111827;"><div style="max-width:700px;margin:0 auto;"><h1>FoodiefyCo Receipt</h1><p>Order ID: ${order.orderId}</p><p>Date Ordered: ${order.orderDate}</p><p>Customer: ${order.customerName}</p><p>Phone: ${order.phoneNumber}</p><p>Address: ${order.deliveryAddress}</p><p>Payment Method: ${order.paymentMethod}</p><p>Payment Status: ${order.paymentStatus}</p><p>Source: ${order.orderSource}</p><p>Special Instructions: ${order.specialInstructions}</p><p>Promo Code: ${order.promoCode || 'None'}</p><table style="width:100%;border-collapse:collapse;margin-top:16px;"><thead><tr style="background:#f3f4f6;"><th style="padding:10px;text-align:left;">Item</th><th style="padding:10px;text-align:center;">Qty</th><th style="padding:10px;text-align:right;">Subtotal</th></tr></thead><tbody>${itemRows || '<tr><td colspan="3" style="padding:10px;">No items found.</td></tr>'}</tbody></table><div style="margin-top:20px;text-align:right;"><p>Subtotal: ₱${subtotalBeforeDiscount.toFixed(2)}</p><p>Discount: -₱${Number(order.discountAmount || 0).toFixed(2)}</p><p><strong>Total: ₱${Number(order.totalAmount || 0).toFixed(2)}</strong></p></div></div><script>window.onload=function(){window.print();};</script></body></html>`);
    receiptWindow.document.close();
  };

  const handleSignOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) return setActionError(signOutError.message);
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-md bg-gray-900 px-4 py-2 text-white">Orders</Link>
            <Link to="/admin/menu" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Menu</Link>
            <Link to="/admin/gallery" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Gallery</Link>
            <button onClick={handleSignOut} className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Sign Out</button>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Fetch Orders</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => handleQuickRange('today')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Today</button>
            <button onClick={() => handleQuickRange('yesterday')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Yesterday</button>
            <button onClick={() => handleQuickRange('last7')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Last 7 Days</button>
            <button onClick={() => handleQuickRange('thisMonth')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">This Month</button>
            <button onClick={() => { const next = { ...filters, startDate: '', endDate: '' }; setFilters(next); runFetch(next); }} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">All Dates</button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-6">
            <div><label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label><input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" /></div>
            <div><label className="mb-2 block text-sm font-medium text-gray-700">End Date</label><input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" /></div>
            <div><label className="mb-2 block text-sm font-medium text-gray-700">Status</label><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2"><option value="all">All</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
            <div><label className="mb-2 block text-sm font-medium text-gray-700">Payment Status</label><select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2"><option value="all">All</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></div>
            <div><label className="mb-2 block text-sm font-medium text-gray-700">Order Source</label><select value={filters.orderSource} onChange={(e) => setFilters({ ...filters, orderSource: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2"><option value="all">All</option><option value="internal">Internal</option><option value="external">External</option></select></div>
            <div className="flex items-end"><button onClick={() => runFetch(filters)} disabled={loading} className="w-full rounded-md bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400">{loading ? 'Loading...' : 'Fetch Orders'}</button></div>
          </div>

          {(error || actionError) && <div className="rounded border border-red-400 bg-red-100 p-3 text-red-700">{actionError || error}</div>}
          {successMessage && <div className="mt-3 rounded border border-green-400 bg-green-100 p-3 text-green-700">{successMessage}</div>}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Orders Today</p><p className="mt-2 text-3xl font-bold text-gray-900">{todaySummary.orders}</p></div>
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Total Sales Today</p><p className="mt-2 text-3xl font-bold text-green-600">₱{todaySummary.sales.toFixed(2)}</p></div>
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Range Orders</p><p className="mt-2 text-3xl font-bold text-gray-900">{rangeSummary.orders}</p></div>
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Range Sales</p><p className="mt-2 text-3xl font-bold text-green-600">₱{rangeSummary.sales.toFixed(2)}</p></div>
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">External Orders</p><p className="mt-2 text-3xl font-bold text-violet-600">{rangeSummary.externalOrders}</p></div>
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">External Sales</p><p className="mt-2 text-3xl font-bold text-violet-600">₱{rangeSummary.externalSales.toFixed(2)}</p></div>
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">COD Total</p><p className="mt-2 text-3xl font-bold text-orange-600">₱{rangeSummary.cod.toFixed(2)}</p></div>
          <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">GCASH Total</p><p className="mt-2 text-3xl font-bold text-blue-600">₱{rangeSummary.gcash.toFixed(2)}</p></div>
        </div>

        <div className="rounded-lg bg-white p-4 md:p-6 shadow">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Orders ({filteredOrders.length})</h2>
              {searchTerm && <p className="mt-1 text-sm text-gray-500">Showing {filteredOrders.length} of {orders.length} orders</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleClearCompletedOrders} disabled={clearingCompleted || completedCount === 0} className="rounded-md bg-red-600 px-4 py-2 text-white disabled:bg-gray-400">{clearingCompleted ? 'Clearing...' : 'Clear Completed Orders'}</button>
              <button onClick={handleExportCSV} className="rounded-md bg-green-600 px-4 py-2 text-white">Export CSV</button>
            </div>
          </div>

          <div className="mb-4">
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by customer, phone, address, order ID, item, payment, promo..." className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1900px] text-sm">
              <thead className="border-b bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Date Ordered</th>
                  <th className="px-4 py-3 text-left">Customer Name</th>
                  <th className="px-4 py-3 text-left">Phone Number</th>
                  <th className="px-4 py-3 text-left">Delivery Address</th>
                  <th className="px-4 py-3 text-left">Special Instructions</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Payment Status</th>
                  <th className="px-4 py-3 text-left">Proof</th>
                  <th className="px-4 py-3 text-left">Promo Code</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-center">Item Count</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!filteredOrders.length ? (
                  <tr><td colSpan="16" className="px-4 py-6 text-center text-gray-500">No orders found.</td></tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.orderId;
                    return (
                      <React.Fragment key={order.orderId}>
                        <tr className="border-b align-top hover:bg-gray-50">
                          <td className="px-4 py-3">{order.orderDate}</td>
                          <td className="px-4 py-3">{order.customerName}</td>
                          <td className="px-4 py-3">{order.phoneNumber}</td>
                          <td className="px-4 py-3">{order.deliveryAddress}</td>
                          <td className="px-4 py-3 max-w-[220px] whitespace-pre-wrap break-words">{order.specialInstructions}</td>
                          <td className="px-4 py-3">{order.paymentMethod}</td>
                          <td className="px-4 py-3">{order.orderSource}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <span>{order.paymentStatus}</span>
                              <select value={order.paymentStatus} onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <span>{renderProofText(order)}</span>
                              {order.paymentProofUrl && <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">View Proof</a>}
                            </div>
                          </td>
                          <td className="px-4 py-3">{order.promoCode || 'None'}</td>
                          <td className="px-4 py-3 text-right">-₱{Number(order.discountAmount || 0).toFixed(2)}</td>
                          <td className="px-4 py-3">{order.itemsSummary}</td>
                          <td className="px-4 py-3 text-center">{order.itemCount}</td>
                          <td className="px-4 py-3 text-right font-semibold">₱{Number(order.totalAmount || 0).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <span>{order.status}</span>
                              <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col gap-2">
                              <button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-white">{isExpanded ? 'Hide' : 'View'}</button>
                              <button onClick={() => handlePrintReceipt(order)} className="rounded-md bg-blue-600 px-3 py-2 text-white">Print</button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b bg-gray-50">
                            <td colSpan="16" className="px-6 py-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border border-gray-200 bg-white p-4">
                                  <h3 className="mb-3 font-semibold text-gray-800">Order Details</h3>
                                  <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Order ID:</span> {order.orderId}</p>
                                  <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Source:</span> {order.orderSource}</p>
                                  <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Payment Method:</span> {order.paymentMethod}</p>
                                  <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Payment Status:</span> {order.paymentStatus}</p>
                                  <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Special Instructions:</span> {order.specialInstructions}</p>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-white p-4">
                                  <h3 className="mb-3 font-semibold text-gray-800">Ordered Items</h3>
                                  {order.orderItems.length ? order.orderItems.map((item) => (
                                    <div key={item.id} className="flex items-start justify-between border-b border-gray-100 pb-2 mb-2">
                                      <div><p className="font-medium text-gray-800">{item.name}</p><p className="text-sm text-gray-500">Quantity: {item.quantity}</p></div>
                                      <p className="font-semibold text-gray-800">₱{Number(item.subtotal).toFixed(2)}</p>
                                    </div>
                                  )) : <p className="text-sm text-gray-500">No items found.</p>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
