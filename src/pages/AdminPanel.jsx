import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrdersExport } from '../hooks/useOrdersExport';
import { generateOrdersCSV, downloadCSV } from '../utils/csvExport';
import { supabase } from '../lib/supabaseClient';

export const AdminPanel = () => {
  const navigate = useNavigate();
  const { orders, loading, error, fetchOrdersForExport } = useOrdersExport();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    paymentStatus: 'all',
    source: 'all',
  });
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [clearingCompleted, setClearingCompleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [todaySummary, setTodaySummary] = useState({ orders: 0, sales: 0 });

  const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayBounds = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchTodaySummary = async () => {
    const { start, end } = getTodayBounds();
    const { data, error: summaryError } = await supabase
      .from('orders')
      .select('id, total_amount, status')
      .gte('created_at', start)
      .lte('created_at', end);

    if (summaryError) return;

    const todayOrders = data || [];
    const todaySales = todayOrders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    setTodaySummary({ orders: todayOrders.length, sales: todaySales });
  };

  useEffect(() => {
    fetchTodaySummary();
  }, []);

  const runFetch = async (nextFilters) => {
    setActionError('');
    setSuccessMessage('');

    await fetchOrdersForExport({
      startDate: nextFilters.startDate || undefined,
      endDate: nextFilters.endDate || undefined,
      status: nextFilters.status === 'all' ? undefined : nextFilters.status,
      paymentStatus:
        nextFilters.paymentStatus === 'all' ? undefined : nextFilters.paymentStatus,
      orderSource: nextFilters.source === 'all' ? undefined : nextFilters.source,
    });

    await fetchTodaySummary();
  };

  const handleFetchOrders = async () => {
    await runFetch(filters);
  };

  const handleQuickRange = async (type) => {
    const now = new Date();
    let startDate = '';
    let endDate = '';

    if (type === 'today') {
      startDate = formatDateInput(now);
      endDate = formatDateInput(now);
    }
    if (type === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = formatDateInput(yesterday);
      endDate = formatDateInput(yesterday);
    }
    if (type === 'last7') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      startDate = formatDateInput(start);
      endDate = formatDateInput(now);
    }
    if (type === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = formatDateInput(start);
      endDate = formatDateInput(now);
    }
    if (type === 'all') {
      startDate = '';
      endDate = '';
    }

    const nextFilters = { ...filters, startDate, endDate };
    setFilters(nextFilters);
    await runFetch(nextFilters);
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert('No orders to export');
      return;
    }
    const csvContent = generateOrdersCSV(orders);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `orders_${timestamp}.csv`);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setSavingOrderId(orderId);
    setActionError('');
    setSuccessMessage('');

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (updateError) {
      setActionError(updateError.message);
      setSavingOrderId(null);
      return;
    }

    await handleFetchOrders();
    setSavingOrderId(null);
    setSuccessMessage(`Order status updated to ${newStatus}.`);
  };

  const handlePaymentStatusChange = async (orderId, newPaymentStatus) => {
    setSavingOrderId(orderId);
    setActionError('');
    setSuccessMessage('');

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: newPaymentStatus })
      .eq('id', orderId);

    if (updateError) {
      setActionError(updateError.message);
      setSavingOrderId(null);
      return;
    }

    await handleFetchOrders();
    setSavingOrderId(null);
    setSuccessMessage(`Payment status updated to ${newPaymentStatus}.`);
  };

  const handleClearCompletedOrders = async () => {
    const completedOrders = orders.filter((order) => order.status === 'completed');
    if (completedOrders.length === 0) {
      alert('No completed orders to clear.');
      return;
    }

    const confirmed = window.confirm('Clear all completed orders? This also removes uploaded proof files.');
    if (!confirmed) return;

    setClearingCompleted(true);
    setActionError('');
    setSuccessMessage('');

    const proofPaths = completedOrders
      .map((order) => order.paymentProofPath)
      .filter(Boolean);

    if (proofPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('payment-proofs')
        .remove(proofPaths);

      if (storageError) {
        setActionError(`Could not delete proof images: ${storageError.message}`);
        setClearingCompleted(false);
        return;
      }
    }

    const ids = completedOrders.map((order) => order.orderId);
    const { error: deleteError } = await supabase.from('orders').delete().in('id', ids);

    if (deleteError) {
      setActionError(deleteError.message);
      setClearingCompleted(false);
      return;
    }

    await handleFetchOrders();
    setClearingCompleted(false);
    setExpandedOrderId(null);
    setSuccessMessage('Completed orders and uploaded proof files cleared.');
  };

  const handlePrintReceipt = (order) => {
    const receiptWindow = window.open('', '_blank', 'width=800,height=900');
    if (!receiptWindow) {
      alert('Please allow popups to print the receipt.');
      return;
    }

    const subtotalBeforeDiscount = Number(order.totalAmount || 0) + Number(order.discountAmount || 0);
    const proofLabel =
      order.paymentMethod === 'COD'
        ? 'Not required'
        : order.paymentProofOption === 'scan_on_delivery'
        ? 'Scan upon delivery'
        : order.paymentProofUrl
        ? 'Uploaded'
        : 'No upload yet';

    const itemRows = (order.orderItems || [])
      .map(
        (item) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.name || 'Item'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 0}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${Number(item.subtotal || 0).toFixed(2)}</td>
          </tr>
        `
      )
      .join('');

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt ${order.orderId}</title>
          <meta charset="UTF-8" />
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">
          <div style="max-width: 700px; margin: 0 auto;">
            <h1 style="margin-bottom: 8px;">FoodiefyCo Receipt</h1>
            <p style="margin: 0 0 20px; color: #4b5563;">Order summary</p>
            <div style="margin-bottom: 20px;">
              <p><strong>Order ID:</strong> ${order.orderId}</p>
              <p><strong>Date Ordered:</strong> ${order.orderDate}</p>
              <p><strong>Customer:</strong> ${order.customerName}</p>
              <p><strong>Phone:</strong> ${order.phoneNumber}</p>
              <p><strong>Address:</strong> ${order.deliveryAddress}</p>
              <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Not specified'}</p>
              <p><strong>Payment Status:</strong> ${order.paymentStatus || 'unpaid'}</p>
              <p><strong>Proof Option:</strong> ${proofLabel}</p>
              <p><strong>Promo Code:</strong> ${order.promoCode || 'None'}</p>
              <p><strong>Special Instructions:</strong> ${order.specialInstructions || 'None'}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows || '<tr><td colspan="3" style="padding: 10px;">No items found.</td></tr>'}
              </tbody>
            </table>
            <div style="margin-top: 20px; text-align: right;">
              <p><strong>Subtotal:</strong> ₱${subtotalBeforeDiscount.toFixed(2)}</p>
              <p><strong>Discount:</strong> -₱${Number(order.discountAmount || 0).toFixed(2)}</p>
              <p style="font-size: 18px;"><strong>Total: ₱${Number(order.totalAmount || 0).toFixed(2)}</strong></p>
            </div>
          </div>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  const handlePdfReceipt = (order) => {
    handlePrintReceipt(order);
  };

  const handleSignOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setActionError(signOutError.message);
      return;
    }
    navigate('/admin/login', { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesPaymentStatus =
        filters.paymentStatus === 'all' || order.paymentStatus === filters.paymentStatus;
      const matchesSource =
        filters.source === 'all' || (order.orderSource || 'internal') === filters.source;

      if (!matchesPaymentStatus || !matchesSource) return false;
      if (!term) return true;

      const orderItemText = (order.orderItems || [])
        .map((item) => `${item.name || ''} ${item.quantity || ''}`)
        .join(' ')
        .toLowerCase();

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
        order.paymentProofOption,
        order.itemsSummary,
        order.specialInstructions,
        order.status,
        orderItemText,
      ].join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [orders, searchTerm, filters.paymentStatus, filters.source]);

  const completedCount = useMemo(
    () => orders.filter((order) => order.status === 'completed').length,
    [orders]
  );

  const rangeSummary = useMemo(() => {
    const nonCancelledOrders = filteredOrders.filter((order) => order.status !== 'cancelled');
    const totalSales = nonCancelledOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    const byMethod = nonCancelledOrders.reduce((acc, order) => {
      const method = order.paymentMethod || 'Unknown';
      acc[method] = (acc[method] || 0) + Number(order.totalAmount || 0);
      return acc;
    }, {});

    return {
      orders: filteredOrders.length,
      sales: totalSales,
      cod: byMethod.COD || 0,
      gcash: byMethod.GCASH || 0,
      gotyme: byMethod.GOtyme || 0,
      unionbank: byMethod.UnionBank || 0,
    };
  }, [filteredOrders]);

  const rangeLabel = useMemo(() => {
    const paymentPart =
      filters.paymentStatus === 'all'
        ? ''
        : ` • ${filters.paymentStatus === 'paid' ? 'Paid Only' : 'Unpaid Only'}`;
    const sourcePart =
      filters.source === 'all' ? '' : ` • ${filters.source === 'external' ? 'External Only' : 'Internal Only'}`;

    if (filters.startDate && filters.endDate) return `${filters.startDate} to ${filters.endDate}${paymentPart}${sourcePart}`;
    if (filters.startDate) return `From ${filters.startDate}${paymentPart}${sourcePart}`;
    if (filters.endDate) return `Until ${filters.endDate}${paymentPart}${sourcePart}`;
    return `Current View${paymentPart}${sourcePart}`;
  }, [filters.endDate, filters.startDate, filters.paymentStatus, filters.source]);

  const getStatusClasses = (status) => {
    if (status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (status === 'cancelled') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  const getPaymentStatusClasses = (paymentStatus) => {
    if (paymentStatus === 'paid') return 'bg-green-100 text-green-800';
    if (paymentStatus === 'unpaid') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-700';
  };

  const getOrderSourceClasses = (orderSource) => {
    if (orderSource === 'external') return 'bg-violet-100 text-violet-800';
    return 'bg-sky-100 text-sky-800';
  };

  const renderProofText = (order) => {
    if (order.paymentMethod === 'COD') return 'Not required';
    if (order.paymentProofOption === 'scan_on_delivery') return 'Scan on delivery';
    if (order.paymentProofUrl) return 'Uploaded';
    return 'No upload yet';
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
            <button onClick={() => handleQuickRange('today')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Today</button>
            <button onClick={() => handleQuickRange('yesterday')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Yesterday</button>
            <button onClick={() => handleQuickRange('last7')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Last 7 Days</button>
            <button onClick={() => handleQuickRange('thisMonth')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">This Month</button>
            <button onClick={() => handleQuickRange('all')} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">All Dates</button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Payment Status</label>
              <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Order Source</label>
              <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleFetchOrders} disabled={loading} className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:bg-gray-400">
                {loading ? 'Loading...' : 'Fetch Orders'}
              </button>
            </div>
          </div>

          {(error || actionError) && <div className="rounded border border-red-400 bg-red-100 p-3 text-red-700">{actionError || error}</div>}
          {successMessage && <div className="mt-3 rounded border border-green-400 bg-green-100 p-3 text-green-700">{successMessage}</div>}
        </div>

        {orders.length > 0 && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
              <p className="text-sm text-gray-500">{rangeLabel}</p>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Orders Today</p><p className="mt-2 text-3xl font-bold text-gray-900">{todaySummary.orders}</p></div>
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Total Sales Today</p><p className="mt-2 text-3xl font-bold text-green-600">₱{todaySummary.sales.toFixed(2)}</p></div>
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Range Orders</p><p className="mt-2 text-3xl font-bold text-gray-900">{rangeSummary.orders}</p></div>
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">Range Sales</p><p className="mt-2 text-3xl font-bold text-green-600">₱{rangeSummary.sales.toFixed(2)}</p></div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">COD Total</p><p className="mt-2 text-3xl font-bold text-orange-600">₱{rangeSummary.cod.toFixed(2)}</p></div>
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">GCASH Total</p><p className="mt-2 text-3xl font-bold text-blue-600">₱{rangeSummary.gcash.toFixed(2)}</p></div>
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">GOtyme Total</p><p className="mt-2 text-3xl font-bold text-emerald-600">₱{rangeSummary.gotyme.toFixed(2)}</p></div>
              <div className="rounded-xl bg-white p-5 shadow"><p className="text-sm font-medium text-gray-500">UnionBank Total</p><p className="mt-2 text-3xl font-bold text-indigo-600">₱{rangeSummary.unionbank.toFixed(2)}</p></div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 shadow">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Orders ({filteredOrders.length})</h2>
                  {searchTerm && <p className="mt-1 text-sm text-gray-500">Showing {filteredOrders.length} of {orders.length} orders</p>}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button onClick={handleClearCompletedOrders} disabled={clearingCompleted || completedCount === 0} className="rounded-md bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:bg-gray-400">
                    {clearingCompleted ? 'Clearing...' : 'Clear Completed Orders'}
                  </button>
                  <button onClick={handleExportCSV} className="rounded-md bg-green-600 px-4 py-2 text-white transition hover:bg-green-700">Export CSV</button>
                </div>
              </div>

              <div className="mb-4">
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by customer, phone, address, order ID, item, payment, promo..." className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="space-y-4 md:hidden">
                {filteredOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-gray-500">No orders matched your search.</div>
                ) : (
                  filteredOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.orderId;
                    const subtotalBeforeDiscount = Number(order.totalAmount || 0) + Number(order.discountAmount || 0);

                    return (
                      <div key={order.orderId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-gray-500">{order.orderDate}</p>
                            <h3 className="text-lg font-semibold text-gray-900">{order.customerName}</h3>
                            <p className="text-sm text-gray-600">{order.phoneNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">₱{Number(order.totalAmount).toFixed(2)}</p>
                            <p className="text-sm text-gray-500">{order.itemCount} item(s)</p>
                          </div>
                        </div>

                        <div className="mb-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                          <p><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
                          <p><span className="font-semibold">Payment:</span> {order.paymentMethod || 'N/A'}</p>
                          <p><span className="font-semibold">Source:</span> {(order.orderSource || 'internal').toUpperCase()}</p>
                          <p><span className="font-semibold">Special Instructions:</span> {order.specialInstructions || 'None'}</p>
                          <p><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
                          <p><span className="font-semibold">Discount:</span> -₱{Number(order.discountAmount || 0).toFixed(2)}</p>
                          <p><span className="font-semibold">Proof:</span> {renderProofText(order)}</p>
                          {order.paymentProofUrl && (
                            <a
                              href={order.paymentProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold text-blue-600 underline"
                            >
                              View Proof
                            </a>
                          )}
                          <p><span className="font-semibold">Items:</span> {order.itemsSummary || 'No items'}</p>
                          <p><span className="font-semibold">Subtotal:</span> ₱{subtotalBeforeDiscount.toFixed(2)}</p>
                        </div>

                        <div className="mb-3 flex flex-wrap gap-2">
                          <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClasses(order.status)}`}>{order.status}</span>
                          <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getPaymentStatusClasses(order.paymentStatus)}`}>{order.paymentStatus}</span>
                          <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getOrderSourceClasses(order.orderSource)}`}>{order.orderSource || 'internal'}</span>
                        </div>

                        <div className="mb-3 grid grid-cols-1 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Order Status</label>
                            <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="w-full rounded-md border border-gray-300 px-3 py-2">
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Status</label>
                            <select value={order.paymentStatus} onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="w-full rounded-md border border-gray-300 px-3 py-2">
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800">
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                          <button onClick={() => handlePrintReceipt(order)} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Print</button>
                          <button onClick={() => handlePdfReceipt(order)} className="rounded-md bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700">PDF</button>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 rounded-lg bg-gray-50 p-4">
                            <h4 className="mb-2 font-semibold text-gray-800">Order Details</h4>
                            <div className="space-y-2 text-sm text-gray-700">
                              <p><span className="font-semibold">Order ID:</span> {order.orderId}</p>
                              <p><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
                              <p><span className="font-semibold">Discount:</span> -₱{Number(order.discountAmount || 0).toFixed(2)}</p>
                              <p><span className="font-semibold">Proof:</span> {renderProofText(order)}</p>
                              {order.paymentProofUrl && (
                                <p>
                                  <a
                                    href={order.paymentProofUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-blue-600 underline"
                                  >
                                    View Proof Image
                                  </a>
                                </p>
                              )}
                              <p><span className="font-semibold">Subtotal:</span> ₱{subtotalBeforeDiscount.toFixed(2)}</p>
                              <p><span className="font-semibold">Total:</span> ₱{Number(order.totalAmount || 0).toFixed(2)}</p>
                              <p><span className="font-semibold">Special Instructions:</span> {order.specialInstructions || 'None'}</p>
                            </div>

                            <div className="mt-4">
                              <h5 className="mb-2 font-semibold text-gray-800">Ordered Items</h5>
                              {order.orderItems.length > 0 ? (
                                <div className="space-y-2">
                                  {order.orderItems.map((item, index) => (
                                    <div key={`${order.orderId}-${index}`} className="flex items-start justify-between border-b border-gray-200 pb-2">
                                      <div>
                                        <p className="font-medium text-gray-800">{item.name}</p>
                                        <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                                      </div>
                                      <p className="font-semibold text-gray-800">₱{Number(item.subtotal).toFixed(2)}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No items found.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[2050px] text-sm">
                  <thead className="border-b bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Date Ordered</th>
                      <th className="px-4 py-3 text-left">Customer Name</th>
                      <th className="px-4 py-3 text-left">Phone Number</th>
                      <th className="px-4 py-3 text-left">Delivery Address</th>
                      <th className="px-4 py-3 text-left">Payment</th>
                      <th className="px-4 py-3 text-left">Source</th>
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
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan="16" className="px-4 py-6 text-center text-gray-500">No orders matched your search.</td></tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.orderId;
                        const subtotalBeforeDiscount = Number(order.totalAmount || 0) + Number(order.discountAmount || 0);

                        return (
                          <React.Fragment key={order.orderId}>
                            <tr className="border-b align-top hover:bg-gray-50">
                              <td className="px-4 py-3">{order.orderDate}</td>
                              <td className="px-4 py-3">{order.customerName}</td>
                              <td className="px-4 py-3">{order.phoneNumber}</td>
                              <td className="px-4 py-3">{order.deliveryAddress}</td>
                              <td className="px-4 py-3">{order.paymentMethod || 'N/A'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getOrderSourceClasses(order.orderSource)}`}>
                                  {order.orderSource || 'internal'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-2">
                                  <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getPaymentStatusClasses(order.paymentStatus)}`}>{order.paymentStatus}</span>
                                  <select value={order.paymentStatus} onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                                    <option value="unpaid">Unpaid</option>
                                    <option value="paid">Paid</option>
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-2">
                                  <span>{renderProofText(order)}</span>
                                  {order.paymentProofUrl && (
                                    <a
                                      href={order.paymentProofUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-semibold text-blue-600 underline"
                                    >
                                      View Proof
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 max-w-[220px]">
                                <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{order.specialInstructions || 'None'}</p>
                              </td>
                              <td className="px-4 py-3">{order.promoCode || 'None'}</td>
                              <td className="px-4 py-3 text-right">-₱{Number(order.discountAmount || 0).toFixed(2)}</td>
                              <td className="px-4 py-3">{order.itemsSummary || 'No items'}</td>
                              <td className="px-4 py-3 text-center">{order.itemCount}</td>
                              <td className="px-4 py-3 text-right font-semibold">₱{Number(order.totalAmount || 0).toFixed(2)}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-2">
                                  <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClasses(order.status)}`}>{order.status}</span>
                                  <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                                    <option value="pending">Pending</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex flex-col gap-2">
                                  <button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-800">
                                    {isExpanded ? 'Hide' : 'View'}
                                  </button>
                                  <button onClick={() => handlePrintReceipt(order)} className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">Print</button>
                                  <button onClick={() => handlePdfReceipt(order)} className="rounded-md bg-purple-600 px-3 py-2 text-white hover:bg-purple-700">PDF</button>
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
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Date Ordered:</span> {order.orderDate}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Customer:</span> {order.customerName}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Phone:</span> {order.phoneNumber}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Payment Method:</span> {order.paymentMethod || 'Not specified'}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Payment Status:</span> {order.paymentStatus}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Proof:</span> {renderProofText(order)}</p>
                                      {order.paymentProofUrl && (
                                        <p className="mb-2 text-sm text-gray-700">
                                          <a
                                            href={order.paymentProofUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-semibold text-blue-600 underline"
                                          >
                                            View Proof Image
                                          </a>
                                        </p>
                                      )}
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Subtotal:</span> ₱{subtotalBeforeDiscount.toFixed(2)}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Discount:</span> -₱{Number(order.discountAmount || 0).toFixed(2)}</p>
                                      <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Total:</span> ₱{Number(order.totalAmount || 0).toFixed(2)}</p>
                                      <p className="text-sm text-gray-700"><span className="font-semibold">Special Instructions:</span> {order.specialInstructions || 'None'}</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                                      <h3 className="mb-3 font-semibold text-gray-800">Ordered Items</h3>
                                      {order.orderItems.length > 0 ? (
                                        <div className="space-y-3">
                                          {order.orderItems.map((item, index) => (
                                            <div key={`${order.orderId}-${index}`} className="flex items-start justify-between border-b border-gray-100 pb-2">
                                              <div>
                                                <p className="font-medium text-gray-800">{item.name}</p>
                                                <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                                              </div>
                                              <p className="font-semibold text-gray-800">₱{Number(item.subtotal).toFixed(2)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-500">No items found.</p>
                                      )}
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
          </>
        )}
      </div>
    </div>
  );
};
