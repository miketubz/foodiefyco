<h1 className="text-3xl font-bold text-red-600">SELLER DASHBOARD FC</h1>
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrdersExport } from '../hooks/useOrdersExport';
import { generateOrdersCSV, downloadCSV } from '../utils/csvExport';
import { supabase } from '../lib/supabaseClient';

const peso = (value) => `₱${Number(value || 0).toFixed(2)}`;

const filterSource = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'internal' || source === 'website') return 'internal';
  if (source === 'external') return 'external';
  return source;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [savingOrderId, setSavingOrderId] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [clearingCompleted, setClearingCompleted] = useState(false);
  const [clearingCancelled, setClearingCancelled] = useState(false);
  const [todaySummary, setTodaySummary] = useState({
    orders: 0,
    sales: 0,
    externalOrders: 0,
    externalSales: 0,
  });

  const fetchTodaySummary = async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const { data, error: summaryError } = await supabase
      .from('orders')
      .select('id, total_amount, status, order_source')
      .gte('created_at', start)
      .lte('created_at', end);

    if (summaryError) return;

    const rows = data || [];
    const nonCancelled = rows.filter((row) => row.status !== 'cancelled');
    const externalRows = nonCancelled.filter((row) => filterSource(row.order_source) === 'external');

    setTodaySummary({
      orders: rows.length,
      sales: nonCancelled.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
      externalOrders: externalRows.length,
      externalSales: externalRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    });
  };

  const runFetch = async (nextFilters) => {
    setActionError('');
    setSuccessMessage('');
    await fetchOrdersForExport(nextFilters);
    await fetchTodaySummary();
  };

  useEffect(() => {
    runFetch(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickRange = async (type) => {
    const now = new Date();
    const format = (date) => {
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, '0');
      const d = `${date.getDate()}`.padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    let startDate = '';
    let endDate = '';

    if (type === 'today') {
      startDate = format(now);
      endDate = format(now);
    } else if (type === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = format(yesterday);
      endDate = format(yesterday);
    } else if (type === 'last7') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      startDate = format(start);
      endDate = format(now);
    } else if (type === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = format(start);
      endDate = format(now);
    }

    const nextFilters = { ...filters, startDate, endDate };
    setFilters(nextFilters);
    await runFetch(nextFilters);
  };

  const handleFetchOrders = async () => {
    await runFetch(filters);
  };

  const handleStatusChange = async (orderId, nextStatus) => {
    setSavingOrderId(orderId);
    setActionError('');
    setSuccessMessage('');

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    if (updateError) {
      setActionError(updateError.message || 'Could not update order status.');
      setSavingOrderId('');
      return;
    }

    await runFetch(filters);
    setSavingOrderId('');
    setSuccessMessage(`Order status updated to ${nextStatus}.`);
  };

  const handlePaymentStatusChange = async (orderId, nextPaymentStatus) => {
    setSavingOrderId(orderId);
    setActionError('');
    setSuccessMessage('');

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: nextPaymentStatus })
      .eq('id', orderId);

    if (updateError) {
      setActionError(updateError.message || 'Could not update payment status.');
      setSavingOrderId('');
      return;
    }

    await runFetch(filters);
    setSavingOrderId('');
    setSuccessMessage(`Payment status updated to ${nextPaymentStatus}.`);
  };

  const clearOrdersByStatus = async (statusToClear) => {
    const matched = orders.filter((order) => order.status === statusToClear);
    if (matched.length === 0) {
      window.alert(`No ${statusToClear} orders to clear.`);
      return;
    }

    const confirmed = window.confirm(`Delete all ${statusToClear} orders? Uploaded proof files for those orders will also be removed.`);
    if (!confirmed) return;

    if (statusToClear === 'completed') setClearingCompleted(true);
    if (statusToClear === 'cancelled') setClearingCancelled(true);

    setActionError('');
    setSuccessMessage('');

    const proofPaths = matched.map((order) => order.paymentProofPath).filter(Boolean);
    if (proofPaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('payment-proofs').remove(proofPaths);
      if (storageError) {
        setActionError(storageError.message || 'Could not remove proof files.');
        setClearingCompleted(false);
        setClearingCancelled(false);
        return;
      }
    }

    const ids = matched.map((order) => order.orderId);
    const { error: deleteError } = await supabase.from('orders').delete().in('id', ids);
    if (deleteError) {
      setActionError(deleteError.message || 'Could not delete orders.');
      setClearingCompleted(false);
      setClearingCancelled(false);
      return;
    }

    await runFetch(filters);
    setExpandedOrderId('');
    setClearingCompleted(false);
    setClearingCancelled(false);
    setSuccessMessage(`${statusToClear} orders cleared.`);
  };

  const handleExportCSV = () => {
    if (!orders.length) {
      window.alert('No orders to export.');
      return;
    }

    const csvContent = generateOrdersCSV(orders);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCSV(csvContent, `orders_${timestamp}.csv`);
  };

  const handlePrintReceipt = (order) => {
    const popup = window.open('', '_blank', 'width=800,height=900');
    if (!popup) {
      window.alert('Please allow popups to print the receipt.');
      return;
    }

    const proofLabel =
      order.paymentMethod === 'COD'
        ? 'Not required'
        : order.paymentProofOption === 'scan_on_delivery'
        ? 'Scan on delivery'
        : order.paymentProofUrl
        ? 'Uploaded'
        : 'No upload yet';

    const itemRows = (order.orderItems || [])
      .map(
        (item) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${peso(item.subtotal)}</td>
          </tr>
        `
      )
      .join('');

    popup.document.write(`
      <html>
        <head>
          <title>Receipt ${order.orderId}</title>
          <meta charset="UTF-8" />
        </head>
        <body style="font-family:Arial,sans-serif;padding:24px;color:#111827;">
          <div style="max-width:700px;margin:0 auto;">
            <h1>FoodiefyCo Seller Receipt</h1>
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Date Ordered:</strong> ${order.orderDate}</p>
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.phoneNumber}</p>
            <p><strong>Address:</strong> ${order.deliveryAddress}</p>
            <p><strong>Source:</strong> ${order.orderSource}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
            <p><strong>Proof:</strong> ${proofLabel}</p>
            <p><strong>Promo Code:</strong> ${order.promoCode || 'None'}</p>
            <p><strong>Special Instructions:</strong> ${order.specialInstructions || 'None'}</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:10px;text-align:left;">Item</th>
                  <th style="padding:10px;text-align:center;">Qty</th>
                  <th style="padding:10px;text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows || '<tr><td colspan="3" style="padding:10px;">No items found.</td></tr>'}
              </tbody>
            </table>
            <div style="margin-top:20px;text-align:right;">
              <p><strong>Discount:</strong> -${peso(order.discountAmount)}</p>
              <p style="font-size:20px;"><strong>Total:</strong> ${peso(order.totalAmount)}</p>
            </div>
          </div>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const handleSignOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setActionError(signOutError.message || 'Could not sign out.');
      return;
    }
    navigate('/admin/login', { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      if (filters.paymentStatus !== 'all' && order.paymentStatus !== filters.paymentStatus) return false;
      if (filters.orderSource !== 'all' && order.orderSource !== filters.orderSource) return false;
      if (!needle) return true;

      const haystack = [
        order.orderId,
        order.orderDate,
        order.customerName,
        order.phoneNumber,
        order.deliveryAddress,
        order.paymentMethod,
        order.paymentStatus,
        order.promoCode,
        order.discountAmount,
        order.orderSource,
        order.specialInstructions,
        order.status,
        order.itemsSummary,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [orders, searchTerm, filters.paymentStatus, filters.orderSource]);

  const summary = useMemo(() => {
    const nonCancelled = filteredOrders.filter((order) => order.status !== 'cancelled');
    const external = nonCancelled.filter((order) => order.orderSource === 'external');

    const totalsByPayment = nonCancelled.reduce((acc, order) => {
      const method = String(order.paymentMethod || 'N/A').toUpperCase();
      acc[method] = (acc[method] || 0) + Number(order.totalAmount || 0);
      return acc;
    }, {});

    return {
      orders: filteredOrders.length,
      sales: nonCancelled.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      externalOrders: external.length,
      externalSales: external.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      cod: totalsByPayment.COD || 0,
      gcash: totalsByPayment.GCASH || 0,
      gotyme: totalsByPayment.GOTYME || 0,
      unionbank: totalsByPayment.UNIONBANK || 0,
      completedCount: orders.filter((order) => order.status === 'completed').length,
      cancelledCount: orders.filter((order) => order.status === 'cancelled').length,
    };
  }, [filteredOrders, orders]);

  const rangeLabel = useMemo(() => {
    if (filters.startDate && filters.endDate) return `${filters.startDate} to ${filters.endDate}`;
    if (filters.startDate) return `From ${filters.startDate}`;
    if (filters.endDate) return `Until ${filters.endDate}`;
    return 'Current View';
  }, [filters.startDate, filters.endDate]);

  const renderProofText = (order) => {
    if (String(order.paymentMethod).toUpperCase() === 'COD') return 'Not required';
    if (order.paymentProofOption === 'scan_on_delivery') return 'Scan on delivery';
    if (order.paymentProofUrl) return 'Uploaded';
    return 'No upload yet';
  };

  const cardClass = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-slate-900 px-6 py-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-300">Seller Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold">Orders and Sales Panel</h1>
            <p className="mt-2 text-sm text-slate-300">Fresh view that maps directly to your current database tables without changing the DB.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">Orders</Link>
            <Link to="/admin/menu" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">Menu</Link>
            <Link to="/admin/external" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">External Orders</Link>
            <Link to="/admin/gallery" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">Gallery</Link>
            <button onClick={handleSignOut} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Sign Out</button>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Fetch Orders</h2>
              <p className="text-sm text-gray-500">Use date filters or quick ranges, then fetch the latest records.</p>
            </div>
            <p className="text-sm font-medium text-gray-500">{rangeLabel}</p>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => handleQuickRange('today')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Today</button>
            <button onClick={() => handleQuickRange('yesterday')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Yesterday</button>
            <button onClick={() => handleQuickRange('last7')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Last 7 Days</button>
            <button onClick={() => handleQuickRange('thisMonth')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">This Month</button>
            <button onClick={() => { const next = { ...filters, startDate: '', endDate: '' }; setFilters(next); runFetch(next); }} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">All Dates</button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Start Date</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">End Date</label>
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Status</label>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Payment Status</label>
              <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5">
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Order Source</label>
              <select value={filters.orderSource} onChange={(e) => setFilters({ ...filters, orderSource: e.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2.5">
                <option value="all">All</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleFetchOrders} disabled={loading} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400">
                {loading ? 'Loading...' : 'Fetch Orders'}
              </button>
            </div>
          </div>

          {(error || actionError) && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError || error}</div>}
          {successMessage && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-2xl font-bold text-gray-900">Summary</h2>
            <span className="text-sm text-gray-500">{rangeLabel}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <div className={cardClass}><p className="text-sm text-gray-500">Orders Today</p><p className="mt-3 text-4xl font-bold text-gray-900">{todaySummary.orders}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">Total Sales Today</p><p className="mt-3 text-4xl font-bold text-green-600">{peso(todaySummary.sales)}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">External Orders Today</p><p className="mt-3 text-4xl font-bold text-gray-900">{todaySummary.externalOrders}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">External Sales Today</p><p className="mt-3 text-4xl font-bold text-green-600">{peso(todaySummary.externalSales)}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">Range Orders</p><p className="mt-3 text-4xl font-bold text-gray-900">{summary.orders}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">Range Sales</p><p className="mt-3 text-4xl font-bold text-green-600">{peso(summary.sales)}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">External Orders in View</p><p className="mt-3 text-4xl font-bold text-gray-900">{summary.externalOrders}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">External Sales in View</p><p className="mt-3 text-4xl font-bold text-green-600">{peso(summary.externalSales)}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">COD Total</p><p className="mt-3 text-4xl font-bold text-orange-600">{peso(summary.cod)}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">GCASH Total</p><p className="mt-3 text-4xl font-bold text-blue-600">{peso(summary.gcash)}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">GOtyme Total</p><p className="mt-3 text-4xl font-bold text-emerald-600">{peso(summary.gotyme)}</p></div>
            <div className={cardClass}><p className="text-sm text-gray-500">UnionBank Total</p><p className="mt-3 text-4xl font-bold text-violet-600">{peso(summary.unionbank)}</p></div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Orders ({filteredOrders.length})</h2>
              <p className="text-sm text-gray-500">Shows payment, source, special instructions, proof, items, print, and PDF-ready receipt.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => clearOrdersByStatus('cancelled')} disabled={clearingCancelled || summary.cancelledCount === 0} className="rounded-xl bg-gray-500 px-4 py-2 font-semibold text-white hover:bg-gray-600 disabled:bg-gray-300">{clearingCancelled ? 'Clearing...' : 'Clear Cancelled Orders'}</button>
              <button onClick={() => clearOrdersByStatus('completed')} disabled={clearingCompleted || summary.completedCount === 0} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:bg-gray-300">{clearingCompleted ? 'Clearing...' : 'Clear Completed Orders'}</button>
              <button onClick={handleExportCSV} className="rounded-xl bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">Export CSV</button>
            </div>
          </div>

          <div className="mb-5">
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by customer, phone, address, order ID, item, payment, promo..." className="w-full rounded-2xl border border-gray-300 px-4 py-3" />
          </div>

          <div className="space-y-4 lg:hidden">
            {filteredOrders.map((order) => (
              <div key={order.orderId} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">{order.orderDate}</p>
                    <h3 className="text-lg font-bold text-gray-900">{order.customerName}</h3>
                    <p className="text-sm text-gray-600">{order.phoneNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{peso(order.totalAmount)}</p>
                    <p className="text-sm text-gray-500">{order.itemCount} item(s)</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-sm text-gray-700">
                  <p><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
                  <p><span className="font-semibold">Source:</span> {order.orderSource}</p>
                  <p><span className="font-semibold">Payment:</span> {order.paymentMethod}</p>
                  <p><span className="font-semibold">Payment Status:</span> {order.paymentStatus}</p>
                  <p><span className="font-semibold">Proof:</span> {renderProofText(order)}</p>
                  <p><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
                  <p><span className="font-semibold">Special Instructions:</span> {order.specialInstructions || 'None'}</p>
                  <p><span className="font-semibold">Items:</span> {order.itemsSummary}</p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <select value={order.paymentStatus} onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-xl border border-gray-300 px-3 py-2.5">
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                  <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-xl border border-gray-300 px-3 py-2.5">
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => setExpandedOrderId(expandedOrderId === order.orderId ? '' : order.orderId)} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{expandedOrderId === order.orderId ? 'Hide' : 'View'}</button>
                  <button onClick={() => handlePrintReceipt(order)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Print</button>
                  <button onClick={() => handlePrintReceipt(order)} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white">PDF</button>
                </div>
                {expandedOrderId === order.orderId && (
                  <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                    {(order.orderItems || []).length ? order.orderItems.map((item) => (
                      <div key={`${order.orderId}-${item.id}`} className="flex items-center justify-between border-b border-gray-200 py-2 text-sm">
                        <span>{item.name} x{item.quantity}</span>
                        <span>{peso(item.subtotal)}</span>
                      </div>
                    )) : <p className="text-sm text-gray-500">No items found.</p>}
                  </div>
                )}
              </div>
            ))}
            {!filteredOrders.length && <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-gray-500">No orders matched your search.</div>}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[2200px] w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Date Ordered</th>
                  <th className="px-4 py-3 text-left">Customer Name</th>
                  <th className="px-4 py-3 text-left">Phone Number</th>
                  <th className="px-4 py-3 text-left">Delivery Address</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-left">Payment Status</th>
                  <th className="px-4 py-3 text-left">Proof</th>
                  <th className="px-4 py-3 text-left">Special Instructions</th>
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
                {filteredOrders.map((order) => (
                  <React.Fragment key={order.orderId}>
                    <tr className="border-b border-gray-200 align-top hover:bg-gray-50">
                      <td className="px-4 py-4">{order.orderDate}</td>
                      <td className="px-4 py-4">{order.customerName}</td>
                      <td className="px-4 py-4">{order.phoneNumber}</td>
                      <td className="px-4 py-4">{order.deliveryAddress}</td>
                      <td className="px-4 py-4">{order.orderSource}</td>
                      <td className="px-4 py-4">{order.paymentMethod}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.paymentStatus}</div>
                          <select value={order.paymentStatus} onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="block w-full rounded-xl border border-gray-300 px-3 py-2">
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p>{renderProofText(order)}</p>
                          {order.paymentProofUrl && <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">View Proof</a>}
                        </div>
                      </td>
                      <td className="px-4 py-4 max-w-[240px] whitespace-pre-wrap break-words">{order.specialInstructions || 'None'}</td>
                      <td className="px-4 py-4">{order.promoCode || 'None'}</td>
                      <td className="px-4 py-4 text-right">-{peso(order.discountAmount)}</td>
                      <td className="px-4 py-4 max-w-[260px] whitespace-pre-wrap break-words">{order.itemsSummary}</td>
                      <td className="px-4 py-4 text-center">{order.itemCount}</td>
                      <td className="px-4 py-4 text-right font-semibold">{peso(order.totalAmount)}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.status}</div>
                          <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="block w-full rounded-xl border border-gray-300 px-3 py-2">
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <button onClick={() => setExpandedOrderId(expandedOrderId === order.orderId ? '' : order.orderId)} className="rounded-xl bg-slate-900 px-3 py-2 text-white">{expandedOrderId === order.orderId ? 'Hide' : 'View'}</button>
                          <button onClick={() => handlePrintReceipt(order)} className="rounded-xl bg-blue-600 px-3 py-2 text-white">Print</button>
                          <button onClick={() => handlePrintReceipt(order)} className="rounded-xl bg-violet-600 px-3 py-2 text-white">PDF</button>
                        </div>
                      </td>
                    </tr>
                    {expandedOrderId === order.orderId && (
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td colSpan="16" className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                              <h3 className="mb-3 text-lg font-bold text-gray-900">Order Details</h3>
                              <div className="space-y-2 text-sm text-gray-700">
                                <p><span className="font-semibold">Order ID:</span> {order.orderId}</p>
                                <p><span className="font-semibold">Customer:</span> {order.customerName}</p>
                                <p><span className="font-semibold">Phone:</span> {order.phoneNumber}</p>
                                <p><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
                                <p><span className="font-semibold">Source:</span> {order.orderSource}</p>
                                <p><span className="font-semibold">Payment Method:</span> {order.paymentMethod}</p>
                                <p><span className="font-semibold">Payment Status:</span> {order.paymentStatus}</p>
                                <p><span className="font-semibold">Proof:</span> {renderProofText(order)}</p>
                                <p><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
                                <p><span className="font-semibold">Discount:</span> -{peso(order.discountAmount)}</p>
                                <p><span className="font-semibold">Total:</span> {peso(order.totalAmount)}</p>
                                <p><span className="font-semibold">Special Instructions:</span> {order.specialInstructions || 'None'}</p>
                              </div>
                            </div>
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                              <h3 className="mb-3 text-lg font-bold text-gray-900">Ordered Items</h3>
                              {(order.orderItems || []).length ? order.orderItems.map((item) => (
                                <div key={`${order.orderId}-${item.id}`} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
                                  <div>
                                    <p className="font-semibold text-gray-900">{item.name}</p>
                                    <p className="text-gray-500">Qty: {item.quantity}</p>
                                  </div>
                                  <p className="font-semibold text-gray-900">{peso(item.subtotal)}</p>
                                </div>
                              )) : <p className="text-sm text-gray-500">No items found.</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!filteredOrders.length && (
                  <tr>
                    <td colSpan="16" className="px-4 py-10 text-center text-gray-500">No orders matched your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
