import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { exportSelectedArchiveToPDF } from '../utils/useOrdersExport';

const PAYMENT_QR_MAP = {
  gcash: '/pix/gcash-qr.jpg',
  gotyme: '/pix/gotyme-qr.jpg',
  unionbank: '/pix/unionbank-qr.jpg',
};

const getPaymentQrPath = (method) => PAYMENT_QR_MAP[String(method || '').trim().toLowerCase()] || '';

const getPublicProofUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('payment-proofs').getPublicUrl(path).data?.publicUrl || '';
};

const isArchiveSchemaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('is_archived') || message.includes('archived_at') || message.includes('archive_reason') || message.includes('archived_by');
};

const ArchivePage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [schemaError, setSchemaError] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [filters, setFilters] = useState({ start: '', end: '', status: 'all', dateField: 'archived_at' });
  const [successMessage, setSuccessMessage] = useState('');

  const fetchArchivedOrders = async () => {
    setLoading(true);
    setError('');
    setSchemaError('');
    setSuccessMessage('');

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('id, created_at, archived_at, archived_by, archive_reason, customer_name, total_amount, status, payment_method, payment_proof_path')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false });

    if (fetchError) {
      if (isArchiveSchemaError(fetchError)) {
        setSchemaError('Archive columns are not yet available. Run supabase/migrations/20260417_add_order_archive_columns.sql.');
      } else {
        setError(fetchError.message);
      }
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders((data || []).map((order) => ({
      ...order,
      paymentProofUrl: getPublicProofUrl(order.payment_proof_path),
    })));
    setLoading(false);
  };

  useEffect(() => {
    fetchArchivedOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filters.status !== 'all' && order.status !== filters.status) return false;
      const dateSource = filters.dateField === 'created_at' ? order.created_at : order.archived_at;
      if (!dateSource) return false;
      if (filters.start && new Date(dateSource) < new Date(`${filters.start}T00:00:00`)) return false;
      if (filters.end && new Date(dateSource) > new Date(`${filters.end}T23:59:59`)) return false;
      return true;
    });
  }, [orders, filters]);

  const allSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrders.includes(order.id));

  const toggleOrderSelect = (orderId) => {
    setSelectedOrders((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
  };

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedOrders([]);
      return;
    }
    setSelectedOrders(filteredOrders.map((order) => order.id));
  };

  const unarchiveByIds = async (ids) => {
    if (!ids.length) {
      setError('Select orders to unarchive.');
      return;
    }

    setError('');
    const { error: updateError } = await supabase
      .from('orders')
      .update({ is_archived: false, archived_at: null, archived_by: null, archive_reason: null })
      .in('id', ids);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSelectedOrders([]);
    setSuccessMessage(`${ids.length} order(s) unarchived.`);
    await fetchArchivedOrders();
  };

  const handleExportPDF = () => {
    const ordersToExport = filteredOrders.filter((order) => selectedOrders.includes(order.id));
    if (!ordersToExport.length) {
      setError('Select archived orders to export.');
      return;
    }

    setError('');
    exportSelectedArchiveToPDF(ordersToExport);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Archive - Orders</h1>
            <p className="text-sm text-gray-600">Manage archived completed and cancelled orders.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin" className="rounded bg-blue-600 px-4 py-2 text-white">Back to Admin</Link>
            <button onClick={() => window.print()} className="rounded bg-gray-600 px-4 py-2 text-white">Print</button>
            <button onClick={() => navigate('/')} className="rounded bg-white px-4 py-2 text-gray-700 shadow">Front Store</button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Start Date</label>
            <input type="date" value={filters.start} onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))} className="w-full rounded border px-2 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">End Date</label>
            <input type="date" value={filters.end} onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))} className="w-full rounded border px-2 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Status</label>
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded border px-2 py-2">
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Date Type</label>
            <select value={filters.dateField} onChange={(e) => setFilters((prev) => ({ ...prev, dateField: e.target.value }))} className="w-full rounded border px-2 py-2">
              <option value="archived_at">Archived Date</option>
              <option value="created_at">Order Date</option>
            </select>
          </div>
          <button onClick={() => unarchiveByIds(selectedOrders)} className="rounded bg-emerald-600 px-3 py-2 text-white">Unarchive Selected ({selectedOrders.length})</button>
          <button onClick={handleExportPDF} className="rounded bg-purple-600 px-3 py-2 text-white">Export to PDF</button>
        </div>

        {(error || schemaError) && <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-red-700">{error || schemaError}</div>}
        {successMessage && <div className="mb-3 rounded border border-green-300 bg-green-50 p-3 text-green-700">{successMessage}</div>}

        {loading ? (
          <div className="rounded-lg bg-white p-6 shadow">Loading archived orders...</div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredOrders.map((order) => (
                <div key={order.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                      <h3 className="font-semibold">{order.customer_name || 'N/A'}</h3>
                    </div>
                    <input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleOrderSelect(order.id)} />
                  </div>
                  <p className="text-sm text-gray-700">Status: {order.status}</p>
                  <p className="text-sm text-gray-700">Total: ₱{Number(order.total_amount || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Archived: {order.archived_at ? new Date(order.archived_at).toLocaleString() : '-'}</p>
                  <div className="mt-2">
                    {order.paymentProofUrl ? (
                      <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">View payment proof</a>
                    ) : getPaymentQrPath(order.payment_method) ? (
                      <img src={getPaymentQrPath(order.payment_method)} alt={`${order.payment_method} QR`} className="h-14 w-14 rounded border object-cover" />
                    ) : (
                      <span className="text-xs text-gray-500">No proof/QR</span>
                    )}
                  </div>
                  <button onClick={() => unarchiveByIds([order.id])} className="mt-3 rounded bg-emerald-600 px-3 py-2 text-xs text-white">Unarchive</button>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-lg bg-white shadow md:block">
              <table className="min-w-full border print:text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border"><input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                    <th className="p-2 border">ID</th>
                    <th className="p-2 border">Customer</th>
                    <th className="p-2 border">Total</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border">Payment</th>
                    <th className="p-2 border">Proof / QR</th>
                    <th className="p-2 border">Ordered</th>
                    <th className="p-2 border">Archived</th>
                    <th className="p-2 border">Reason</th>
                    <th className="p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="p-2 border text-center"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleOrderSelect(order.id)} /></td>
                      <td className="p-2 border text-xs">{order.id}</td>
                      <td className="p-2 border">{order.customer_name || 'N/A'}</td>
                      <td className="p-2 border">₱{Number(order.total_amount || 0).toFixed(2)}</td>
                      <td className="p-2 border"><span className={`rounded px-2 py-1 text-xs ${order.status === 'completed' ? 'bg-green-100' : 'bg-red-100'}`}>{order.status}</span></td>
                      <td className="p-2 border">{order.payment_method || 'N/A'}</td>
                      <td className="p-2 border">
                        {order.paymentProofUrl ? (
                          <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">View proof</a>
                        ) : getPaymentQrPath(order.payment_method) ? (
                          <img src={getPaymentQrPath(order.payment_method)} alt={`${order.payment_method} QR`} className="h-14 w-14 rounded border object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                      <td className="p-2 border text-xs">{order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</td>
                      <td className="p-2 border text-xs">{order.archived_at ? new Date(order.archived_at).toLocaleString() : '-'}</td>
                      <td className="p-2 border text-xs">{order.archive_reason || '-'}</td>
                      <td className="p-2 border text-center"><button onClick={() => unarchiveByIds([order.id])} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">Unarchive</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ArchivePage;
