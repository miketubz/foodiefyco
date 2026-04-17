import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { generateOrdersCSV, downloadCSV } from '../utils/csvExport';

const ARCHIVEABLE_STATUSES = new Set(['completed', 'cancelled']);

const PAYMENT_QR_MAP = {
  gcash: '/pix/gcash-qr.jpg',
  gotyme: '/pix/gotyme-qr.jpg',
  unionbank: '/pix/unionbank-qr.jpg',
};

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

const normalizeText = (value, fallback = 'N/A') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const isArchiveSchemaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('is_archived') || message.includes('archived_at') || message.includes('archive_reason') || message.includes('archived_by');
};

const getPublicProofUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('payment-proofs').getPublicUrl(path).data?.publicUrl || '';
};

const getPaymentQrPath = (method) => PAYMENT_QR_MAP[String(method || '').trim().toLowerCase()] || '';

const buildOrdersQuery = (activeFilters, withArchiveFields) => {
  const fields = withArchiveFields
    ? 'id, created_at, total_amount, status, payment_status, promo_code, discount_amount, order_source, payment_proof_option, payment_proof_path, customer_name, phone_number, delivery_address, special_instructions, payment_method, is_archived, archived_at, archived_by, archive_reason'
    : 'id, created_at, total_amount, status, payment_status, promo_code, discount_amount, order_source, payment_proof_option, payment_proof_path, customer_name, phone_number, delivery_address, special_instructions, payment_method';

  let query = supabase
    .from('orders')
    .select(fields)
    .order('created_at', { ascending: false });

  if (activeFilters.startDate) query = query.gte('created_at', toIsoStart(activeFilters.startDate));
  if (activeFilters.endDate) query = query.lt('created_at', toIsoNextDay(activeFilters.endDate));
  if (activeFilters.status !== 'all') query = query.eq('status', activeFilters.status);
  if (activeFilters.paymentStatus !== 'all') query = query.eq('payment_status', activeFilters.paymentStatus);

  if (activeFilters.source !== 'all') {
    if (activeFilters.source === 'external') {
      query = query.eq('order_source', 'external');
    } else {
      query = query.or('order_source.is.null,order_source.eq.internal,order_source.eq.website');
    }
  }

  if (withArchiveFields) {
    query = query.or('is_archived.is.null,is_archived.eq.false');
  }

  return query;
};

export const AdminPanel2 = () => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [archiveSchemaReady, setArchiveSchemaReady] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    const loadAdmin = async () => {
      const { data } = await supabase.auth.getUser();
      setAdminEmail(data?.user?.email || '');
    };

    loadAdmin();
  }, []);

  const normalizeOrders = async (ordersData) => {
    const orderIds = (ordersData || []).map((o) => o.id);
    let itemsByOrder = {};

    if (orderIds.length > 0) {
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id, quantity, price, menu_item_id')
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      const menuItemIds = [...new Set((orderItemsData || []).map((item) => item.menu_item_id).filter(Boolean))];
      let menuMap = {};

      if (menuItemIds.length > 0) {
        const { data: menuItemsData, error: menuError } = await supabase
          .from('menu_item')
          .select('id, name')
          .in('id', menuItemIds);

        if (menuError) throw menuError;
        menuMap = Object.fromEntries((menuItemsData || []).map((item) => [item.id, item.name]));
      }

      itemsByOrder = (orderItemsData || []).reduce((acc, item) => {
        const mapped = {
          name: menuMap[item.menu_item_id] || 'Unknown Item',
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
          subtotal: Number(item.quantity || 0) * Number(item.price || 0),
        };
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(mapped);
        return acc;
      }, {});
    }

    return (ordersData || []).map((order) => {
      const orderItems = itemsByOrder[order.id] || [];
      const paymentProofPath = order.payment_proof_path || '';

      return {
        orderId: order.id,
        id: order.id,
        createdAt: order.created_at,
        orderDate: order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A',
        customerName: normalizeText(order.customer_name),
        phoneNumber: normalizeText(order.phone_number),
        deliveryAddress: normalizeText(order.delivery_address),
        specialInstructions: normalizeText(order.special_instructions, 'None'),
        paymentMethod: normalizeText(order.payment_method, 'N/A'),
        paymentStatus: String(order.payment_status || 'unpaid').toLowerCase(),
        orderSource: normalizeSource(order.order_source),
        promoCode: order.promo_code || '',
        discountAmount: Number(order.discount_amount || 0),
        totalAmount: Number(order.total_amount || 0),
        paymentProofOption: order.payment_proof_option || '',
        paymentProofPath,
        paymentProofUrl: getPublicProofUrl(paymentProofPath),
        status: String(order.status || 'pending').toLowerCase(),
        isArchived: Boolean(order.is_archived),
        archivedAt: order.archived_at || null,
        archivedBy: order.archived_by || '',
        archiveReason: order.archive_reason || '',
        orderItems,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        itemsSummary: orderItems.length ? orderItems.map((item) => `${item.name} x${item.quantity}`).join(', ') : 'No items',
      };
    });
  };

  const fetchOrders = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setActionError('');
    setSuccessMessage('');

    try {
      const { data: primaryData, error: primaryError } = await buildOrdersQuery(activeFilters, true);

      if (primaryError) {
        if (!isArchiveSchemaError(primaryError)) {
          throw primaryError;
        }

        setArchiveSchemaReady(false);
        const { data: fallbackData, error: fallbackError } = await buildOrdersQuery(activeFilters, false);
        if (fallbackError) throw fallbackError;

        const normalizedFallback = await normalizeOrders(fallbackData || []);
        setOrders(normalizedFallback.map((order) => ({ ...order, isArchived: false, archivedAt: null, archivedBy: '', archiveReason: '' })));
        return;
      }

      setArchiveSchemaReady(true);
      const normalized = await normalizeOrders(primaryData || []);
      setOrders(normalized);
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

  useEffect(() => {
    const validIds = new Set(orders.map((order) => order.orderId));
    setSelectedOrderIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [orders]);

  const handleFetchOrders = async () => {
    await fetchOrders(filters);
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
    if (type === 'all') {
      nextFilters.startDate = '';
      nextFilters.endDate = '';
    }
    setFilters(nextFilters);
    await fetchOrders(nextFilters);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setSavingOrderId(orderId);
    const { error: updateError } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    setSavingOrderId(null);
    if (updateError) return setActionError(updateError.message);
    setSuccessMessage('Order status updated.');
    await fetchOrders(filters);
  };

  const handlePaymentStatusChange = async (orderId, newPaymentStatus) => {
    setSavingOrderId(orderId);
    const { error: updateError } = await supabase.from('orders').update({ payment_status: newPaymentStatus }).eq('id', orderId);
    setSavingOrderId(null);
    if (updateError) return setActionError(updateError.message);
    setSuccessMessage('Payment status updated.');
    await fetchOrders(filters);
  };

  const archiveOrdersByIds = async (orderIds, archiveReason) => {
    if (!archiveSchemaReady) {
      setActionError('Archive columns are not available yet. Run the SQL migration in supabase/migrations.');
      return;
    }

    if (!orderIds.length) {
      setActionError('No archiveable orders found for this action.');
      return;
    }

    setBulkArchiving(true);
    setActionError('');

    const payload = {
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: archiveReason,
      archived_by: adminEmail || null,
    };

    const { error: archiveError } = await supabase
      .from('orders')
      .update(payload)
      .in('id', orderIds);

    setBulkArchiving(false);

    if (archiveError) {
      if (isArchiveSchemaError(archiveError)) {
        setArchiveSchemaReady(false);
      }
      setActionError(archiveError.message);
      return;
    }

    setSelectedOrderIds([]);
    setSuccessMessage(`${orderIds.length} order(s) archived.`);
    await fetchOrders(filters);
  };

  const handleArchiveSelected = async () => {
    await archiveOrdersByIds(selectedOrderIds, 'bulk_selected');
  };

  const handleArchiveByStatus = async (status) => {
    const statusIds = filteredOrders
      .filter((order) => !order.isArchived && order.status === status)
      .map((order) => order.orderId);

    await archiveOrdersByIds(statusIds, status === 'completed' ? 'bulk_completed' : 'bulk_cancelled');
  };

  const handleArchiveByDateRange = async () => {
    if (!filters.startDate || !filters.endDate) {
      setActionError('Set both start and end date first to archive by date range.');
      return;
    }

    const start = new Date(`${filters.startDate}T00:00:00`);
    const end = new Date(`${filters.endDate}T23:59:59`);
    const rangeIds = filteredOrders
      .filter((order) => {
        if (order.isArchived || !ARCHIVEABLE_STATUSES.has(order.status)) return false;
        const createdDate = new Date(order.createdAt);
        return createdDate >= start && createdDate <= end;
      })
      .map((order) => order.orderId);

    await archiveOrdersByIds(rangeIds, 'bulk_date_range');
  };

  const handleArchiveSingle = async (order) => {
    if (!ARCHIVEABLE_STATUSES.has(order.status)) {
      setActionError('Only completed or cancelled orders can be archived.');
      return;
    }

    await archiveOrdersByIds([order.orderId], `single_${order.status}`);
  };

  const handleExportCSV = () => {
    if (!orders.length) return;
    const csvContent = generateOrdersCSV(orders);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `orders_${timestamp}.csv`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => [
      order.orderDate,
      order.customerName,
      order.phoneNumber,
      order.deliveryAddress,
      order.paymentMethod,
      order.paymentStatus,
      order.orderSource,
      order.specialInstructions,
      order.promoCode,
      order.itemsSummary,
      order.status,
    ].join(' ').toLowerCase().includes(term));
  }, [orders, searchTerm]);

  const archiveableFilteredOrders = useMemo(
    () => filteredOrders.filter((order) => ARCHIVEABLE_STATUSES.has(order.status) && !order.isArchived),
    [filteredOrders]
  );

  const allArchiveableSelected = archiveableFilteredOrders.length > 0
    && archiveableFilteredOrders.every((order) => selectedOrderIds.includes(order.orderId));

  const toggleSelectOrder = (orderId) => {
    setSelectedOrderIds((prev) => (
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    ));
  };

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedOrderIds([]);
      return;
    }

    setSelectedOrderIds(archiveableFilteredOrders.map((order) => order.orderId));
  };

  const renderProofContent = (order) => {
    if (order.paymentProofUrl) {
      return (
        <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          <span className="block">View proof</span>
          <img src={order.paymentProofUrl} alt={`Payment proof for ${order.customerName}`} className="mt-1 h-14 w-14 rounded border object-cover" />
        </a>
      );
    }

    const qrImage = getPaymentQrPath(order.paymentMethod);
    if (qrImage && order.paymentMethod !== 'COD') {
      return (
        <div className="text-xs text-gray-600">
          <span className="block">QR available</span>
          <img src={qrImage} alt={`${order.paymentMethod} QR`} className="mt-1 h-14 w-14 rounded border object-cover" />
        </div>
      );
    }

    if (order.paymentMethod === 'COD') return <span className="text-xs text-gray-500">Not required</span>;
    if (order.paymentProofOption === 'scan_on_delivery') return <span className="text-xs text-gray-500">Scan on delivery</span>;
    return <span className="text-xs text-gray-500">No upload yet</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Orders</h1>
            <p className="mt-1 text-sm text-gray-600">Archived orders are hidden from this active list by default.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Front Store</Link>
            <Link to="/admin/profit-calculator" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Profit Calculator</Link>
            <Link to="/admin/archive" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Archive</Link>
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
            <button onClick={() => handleQuickRange('all')} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">All Dates</button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-6">
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2" />
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2" />
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2">
              <option value="all">All Status</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
            <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2">
              <option value="all">All Payment</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
            </select>
            <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2">
              <option value="all">All Source</option><option value="internal">Internal</option><option value="external">External</option>
            </select>
            <button onClick={handleFetchOrders} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-white">{loading ? 'Loading...' : 'Fetch Orders'}</button>
          </div>

          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search orders" className="w-full rounded-md border border-gray-300 px-3 py-2" />

          {!archiveSchemaReady && (
            <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
              Archive columns are missing in your current DB. Run the SQL migration in <code>supabase/migrations/20260417_add_order_archive_columns.sql</code>.
            </div>
          )}

          {(error || actionError) && <div className="mt-3 rounded border border-red-400 bg-red-100 p-3 text-red-700">{actionError || error}</div>}
          {successMessage && <div className="mt-3 rounded border border-green-400 bg-green-100 p-3 text-green-700">{successMessage}</div>}
        </div>

        <div className="rounded-lg bg-white p-4 md:p-6 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Orders ({filteredOrders.length})</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleArchiveSelected} disabled={bulkArchiving || !selectedOrderIds.length || !archiveSchemaReady} className="rounded-md bg-purple-600 px-4 py-2 text-white disabled:bg-gray-300">Archive Selected ({selectedOrderIds.length})</button>
              <button onClick={() => handleArchiveByStatus('completed')} disabled={bulkArchiving || !archiveSchemaReady} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:bg-gray-300">Archive Completed</button>
              <button onClick={() => handleArchiveByStatus('cancelled')} disabled={bulkArchiving || !archiveSchemaReady} className="rounded-md bg-orange-600 px-4 py-2 text-white disabled:bg-gray-300">Archive Cancelled</button>
              <button onClick={handleArchiveByDateRange} disabled={bulkArchiving || !archiveSchemaReady} className="rounded-md bg-slate-700 px-4 py-2 text-white disabled:bg-gray-300">Archive by Date Range</button>
              <button onClick={handleExportCSV} className="rounded-md bg-green-600 px-4 py-2 text-white">Export CSV</button>
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            {filteredOrders.map((order) => {
              const canArchive = ARCHIVEABLE_STATUSES.has(order.status) && !order.isArchived;
              const isSelected = selectedOrderIds.includes(order.orderId);
              return (
                <div key={order.orderId} className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">{order.orderDate}</p>
                      <h3 className="text-base font-semibold text-gray-900">{order.customerName}</h3>
                      <p className="text-sm text-gray-500">{order.phoneNumber}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={isSelected} disabled={!canArchive} onChange={() => toggleSelectOrder(order.orderId)} />
                      Select
                    </label>
                  </div>
                  <p className="text-sm text-gray-700">{order.itemsSummary}</p>
                  <div className="mt-2 text-sm text-gray-600">Payment: {order.paymentMethod} • {order.paymentStatus}</div>
                  <div className="mt-2 text-sm text-gray-600">Total: ₱{Number(order.totalAmount || 0).toFixed(2)}</div>
                  <div className="mt-2 text-sm text-gray-600">Status: {order.status}</div>
                  <div className="mt-2">{renderProofContent(order)}</div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleArchiveSingle(order)} disabled={!canArchive || !archiveSchemaReady || bulkArchiving} className="rounded-md bg-purple-600 px-3 py-2 text-xs text-white disabled:bg-gray-300">Archive</button>
                    <button onClick={() => setExpandedOrderId(expandedOrderId === order.orderId ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white">{expandedOrderId === order.orderId ? 'Hide' : 'View'}</button>
                  </div>
                  {expandedOrderId === order.orderId && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
                      <p><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
                      <p className="mt-1"><span className="font-semibold">Instructions:</span> {order.specialInstructions}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[2400px] text-sm">
              <thead className="border-b bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-center"><input type="checkbox" checked={allArchiveableSelected} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                  <th className="px-4 py-3 text-left">Date Ordered</th>
                  <th className="px-4 py-3 text-left">Customer Name</th>
                  <th className="px-4 py-3 text-left">Phone Number</th>
                  <th className="px-4 py-3 text-left">Delivery Address</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-left">Payment Status</th>
                  <th className="px-4 py-3 text-left">Proof / QR</th>
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
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.orderId;
                  const canArchive = ARCHIVEABLE_STATUSES.has(order.status) && !order.isArchived;
                  return (
                    <React.Fragment key={order.orderId}>
                      <tr className="border-b align-top hover:bg-gray-50">
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={selectedOrderIds.includes(order.orderId)} disabled={!canArchive} onChange={() => toggleSelectOrder(order.orderId)} />
                        </td>
                        <td className="px-4 py-3">{order.orderDate}</td>
                        <td className="px-4 py-3">{order.customerName}</td>
                        <td className="px-4 py-3">{order.phoneNumber}</td>
                        <td className="px-4 py-3">{order.deliveryAddress}</td>
                        <td className="px-4 py-3">{order.orderSource}</td>
                        <td className="px-4 py-3">{order.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <select value={order.paymentStatus} onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">{renderProofContent(order)}</td>
                        <td className="px-4 py-3 max-w-[220px] whitespace-pre-wrap break-words">{order.specialInstructions}</td>
                        <td className="px-4 py-3">{order.promoCode || 'None'}</td>
                        <td className="px-4 py-3 text-right">-₱{Number(order.discountAmount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">{order.itemsSummary}</td>
                        <td className="px-4 py-3 text-center">{order.itemCount}</td>
                        <td className="px-4 py-3 text-right">₱{Number(order.totalAmount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-800">
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                            <button onClick={() => handleArchiveSingle(order)} disabled={!canArchive || !archiveSchemaReady || bulkArchiving} className="rounded-md bg-purple-600 px-3 py-2 text-white disabled:bg-gray-300">
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-gray-50">
                          <td colSpan="17" className="px-6 py-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                              <h3 className="mb-3 font-semibold text-gray-800">Ordered Items</h3>
                              {order.orderItems.length > 0 ? order.orderItems.map((item, index) => (
                                <div key={`${order.orderId}-${index}`} className="flex items-start justify-between border-b border-gray-100 pb-2">
                                  <div>
                                    <p className="font-medium text-gray-800">{item.name}</p>
                                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                                  </div>
                                  <p className="font-semibold text-gray-800">₱{Number(item.subtotal).toFixed(2)}</p>
                                </div>
                              )) : <p className="text-sm text-gray-500">No items found.</p>}
                            </div>
                          </td>
                        </tr>
                      )}
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

export default AdminPanel2;
