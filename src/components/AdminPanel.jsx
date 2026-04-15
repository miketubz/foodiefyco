import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { generateOrdersCSV, downloadCSV } from '../utils/csvExport';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoStart = (date) => new Date(`${date}T00:00:00`).toISOString();
const toIsoNextDay = (date) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

const normalizeSource = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'website' || source === 'internal') return 'internal';
  if (source === 'external') return 'external';
  return source;
};

const getPublicProofUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('payment-proofs').getPublicUrl(path).data?.publicUrl || '';
};

const normalizeOrder = (order) => {
  const orderItems = (order.order_items || []).map((item) => {
    const menuItem = item?.menu_item;
    const itemName =
      menuItem?.name ||
      (Array.isArray(menuItem) ? menuItem[0]?.name : '') ||
      'Unknown Item';

    const quantity = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);

    return {
      name: itemName,
      quantity,
      price,
      subtotal: quantity * price,
    };
  });

  const paymentProofPath = order.payment_proof_path || '';

  return {
    orderId: order.id,
    id: order.id,
    createdAt: order.created_at,
    orderDate: order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A',
    customerName: order.customer_name || 'N/A',
    phoneNumber: order.phone_number || 'N/A',
    deliveryAddress: order.delivery_address || 'N/A',
    specialInstructions: order.special_instructions || '',
    paymentMethod: order.payment_method || 'N/A',
    paymentStatus: String(order.payment_status || 'unpaid').toLowerCase(),
    orderSource: normalizeSource(order.order_source),
    promoCode: order.promo_code || '',
    discountAmount: Number(order.discount_amount || 0),
    totalAmount: Number(order.total_amount || 0),
    paymentProofOption: order.payment_proof_option || '',
    paymentProofPath,
    paymentProofUrl: getPublicProofUrl(paymentProofPath),
    status: String(order.status || 'pending').toLowerCase(),
    orderItems,
    itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    itemsSummary: orderItems.length ? orderItems.map((item) => `${item.name} x${item.quantity}`).join(', ') : 'No items',
  };
};

export const AdminPanel = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const fetchTodaySummary = async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).toISOString();

    const { data, error: summaryError } = await supabase
      .from('orders')
      .select('id, total_amount, status')
      .gte('created_at', start)
      .lt('created_at', end);

    if (summaryError) return;

    const todayOrders = data || [];
    const todaySales = todayOrders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    setTodaySummary({ orders: todayOrders.length, sales: todaySales });
  };

  const fetchOrders = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setActionError('');
    setSuccessMessage('');

    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          status,
          payment_status,
          promo_code,
          discount_amount,
          order_source,
          payment_proof_option,
          payment_proof_path,
          customer_name,
          phone_number,
          delivery_address,
          special_instructions,
          payment_method,
          order_items (
            quantity,
            price,
            menu_item:menu_item_id (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (activeFilters.startDate) {
        query = query.gte('created_at', toIsoStart(activeFilters.startDate));
      }
      if (activeFilters.endDate) {
        query = query.lt('created_at', toIsoNextDay(activeFilters.endDate));
      }
      if (activeFilters.status !== 'all') {
        query = query.eq('status', activeFilters.status);
      }
      if (activeFilters.paymentStatus !== 'all') {
        query = query.eq('payment_status', activeFilters.paymentStatus);
      }
      if (activeFilters.source !== 'all') {
        if (activeFilters.source === 'external') {
          query = query.eq('order_source', 'external');
        } else {
          query = query.or('order_source.is.null,order_source.eq.internal,order_source.eq.website');
        }
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setOrders((data || []).map(normalizeOrder));
      await fetchTodaySummary();
    } catch (err) {
      setOrders([]);
      setError(err?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    await fetchOrders(nextFilters);
  };

  const handleExportCSV = () => {
    if (!filteredOrders.length) {
      alert('No orders to export');
      return;
    }
    const csvContent = generateOrdersCSV(filteredOrders);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `orders_${timestamp}.csv`);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setSavingOrderId(orderId);
    const { error: updateError } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (updateError) {
      setActionError(updateError.message);
      setSavingOrderId(null);
      return;
    }
    await fetchOrders(filters);
    setSavingOrderId(null);
    setSuccessMessage(`Order status updated to ${newStatus}.`);
  };

  const handlePaymentStatusChange = async (orderId, newPaymentStatus) => {
    setSavingOrderId(orderId);
    const { error: updateError } = await supabase.from('orders').update({ payment_status: newPaymentStatus }).eq('id', orderId);
    if (updateError) {
      setActionError(updateError.message);
      setSavingOrderId(null);
      return;
    }
    await fetchOrders(filters);
    setSavingOrderId(null);
    setSuccessMessage(`Payment status updated to ${newPaymentStatus}.`);
  };

  const handleClearCompletedOrders = async () => {
    const completedOrders = orders.filter((order) => order.status === 'completed');
    if (!completedOrders.length) {
      alert('No completed orders to clear.');
      return;
    }

    if (!window.confirm('Clear all completed orders?')) return;

    setClearingCompleted(true);

    const ids = completedOrders.map((order) => order.orderId);
    const { error: deleteError } = await supabase.from('orders').delete().in('id', ids);

    if (deleteError) {
      setActionError(deleteError.message);
      setClearingCompleted(false);
      return;
    }

    await fetchOrders(filters);
    setClearingCompleted(false);
    setSuccessMessage('Completed orders cleared.');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesPaymentStatus = filters.paymentStatus === 'all' || order.paymentStatus === filters.paymentStatus;
      const matchesSource = filters.source === 'all' || order.orderSource === filters.source;
      if (!matchesPaymentStatus || !matchesSource) return false;
      if (!term) return true;

      const haystack = [
        order.orderId,
        order.customerName,
        order.phoneNumber,
        order.deliveryAddress,
        order.paymentMethod,
        order.paymentStatus,
        order.promoCode,
        order.specialInstructions,
        order.itemsSummary,
        order.orderSource,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [orders, searchTerm, filters.paymentStatus, filters.source]);

  const rangeSummary = useMemo(() => {
    const active = filteredOrders.filter((order) => order.status !== 'cancelled');
    return {
      orders: filteredOrders.length,
      sales: active.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      cod: active.filter((o) => o.paymentMethod === 'COD').reduce((s, o) => s + o.totalAmount, 0),
      gcash: active.filter((o) => o.paymentMethod === 'GCASH').reduce((s, o) => s + o.totalAmount, 0),
      gotyme: active.filter((o) => o.paymentMethod === 'GOtyme').reduce((s, o) => s + o.totalAmount, 0),
      unionbank: active.filter((o) => o.paymentMethod === 'UnionBank').reduce((s, o) => s + o.totalAmount, 0),
    };
  }, [filteredOrders]);

  const rangeLabel = useMemo(() => {
    if (filters.startDate && filters.endDate) return `${filters.startDate} to ${filters.endDate}`;
    if (filters.startDate) return `From ${filters.startDate}`;
    if (filters.endDate) return `Until ${filters.endDate}`;
    return 'Current View';
  }, [filters.startDate, filters.endDate]);

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
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel v2</h1>
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
            <button onClick={() => { const next = { ...filters, startDate: '', endDate: '' }; setFilters(next); fetchOrders(next); }} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">All Dates</button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Payment Status</label>
              <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Order Source</label>
              <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="all">All</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => fetchOrders(filters)} disabled={loading} className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400">{loading ? 'Loading...' : 'Fetch Orders'}</button>
            </div>
          </div>

          {(error || actionError) && <div className="rounded border border-red-400 bg-red-100 p-3 text-red-700">{actionError || error}</div>}
          {successMessage && <div className="mt-3 rounded border border-green-400 bg-green-100 p-3 text-green-700">{successMessage}</div>}
        </div>

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

        <div className="rounded-lg bg-white p-4 md:p-6 shadow">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Orders ({filteredOrders.length})</h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleClearCompletedOrders} disabled={clearingCompleted} className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-gray-400">{clearingCompleted ? 'Clearing...' : 'Clear Completed Orders'}</button>
              <button onClick={handleExportCSV} className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700">Export CSV</button>
            </div>
          </div>

          <div className="mb-4">
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by customer, phone, address, order ID, item, payment, promo..." className="w-full rounded-md border border-gray-300 px-3 py-2" />
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
                  <tr><td colSpan="16" className="px-4 py-6 text-center text-gray-500">No orders found.</td></tr>
                ) : filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.orderId;
                  return (
                    <React.Fragment key={order.orderId}>
                      <tr className="border-b align-top hover:bg-gray-50">
                        <td className="px-4 py-3">{order.orderDate}</td>
                        <td className="px-4 py-3">{order.customerName}</td>
                        <td className="px-4 py-3">{order.phoneNumber}</td>
                        <td className="px-4 py-3">{order.deliveryAddress}</td>
                        <td className="px-4 py-3">{order.paymentMethod}</td>
                        <td className="px-4 py-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getOrderSourceClasses(order.orderSource)}`}>{order.orderSource}</span></td>
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
                            {order.paymentProofUrl ? <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">View Proof</a> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[220px]"><p className="whitespace-pre-wrap break-words text-sm text-gray-700">{order.specialInstructions || 'None'}</p></td>
                        <td className="px-4 py-3">{order.promoCode || 'None'}</td>
                        <td className="px-4 py-3 text-right">-₱{order.discountAmount.toFixed(2)}</td>
                        <td className="px-4 py-3">{order.itemsSummary}</td>
                        <td className="px-4 py-3 text-center">{order.itemCount}</td>
                        <td className="px-4 py-3 text-right font-semibold">₱{order.totalAmount.toFixed(2)}</td>
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
                        <td className="px-4 py-3 text-center"><button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-800">{isExpanded ? 'Hide' : 'View'}</button></td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-b bg-gray-50">
                          <td colSpan="16" className="px-6 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <h3 className="mb-3 font-semibold text-gray-800">Order Details</h3>
                                <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Source:</span> {order.orderSource}</p>
                                <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Payment:</span> {order.paymentMethod}</p>
                                <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Special Instructions:</span> {order.specialInstructions || 'None'}</p>
                                <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <h3 className="mb-3 font-semibold text-gray-800">Ordered Items</h3>
                                {order.orderItems.length ? order.orderItems.map((item, index) => (
                                  <div key={`${order.orderId}-${index}`} className="flex items-start justify-between border-b border-gray-100 pb-2">
                                    <div>
                                      <p className="font-medium text-gray-800">{item.name}</p>
                                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                                    </div>
                                    <p className="font-semibold text-gray-800">₱{item.subtotal.toFixed(2)}</p>
                                  </div>
                                )) : <p className="text-sm text-gray-500">No items found.</p>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
