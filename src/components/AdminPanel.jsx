import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrdersExport } from '../hooks/useOrdersExport';
import { generateOrdersCSV, downloadCSV } from '../utils/csvExport';
import { supabase } from '../lib/supabaseClient';

export const AdminPanel = () => {
  const { orders, loading, error, fetchOrdersForExport } = useOrdersExport();
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
  });
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [isClearingCompleted, setIsClearingCompleted] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const handleFetchOrders = async () => {
    setActionMessage('');
    setActionError('');

    await fetchOrdersForExport({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      status: filters.status === 'all' ? undefined : filters.status,
    });
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
    setActionMessage('');
    setActionError('');

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      setActionError(error.message);
      setSavingOrderId(null);
      return;
    }

    await handleFetchOrders();
    setActionMessage(`Order status updated to ${newStatus}.`);
    setSavingOrderId(null);
  };

  const handleClearCompletedOrders = async () => {
    const confirmed = window.confirm(
      'Delete all completed orders matching the current date filters?'
    );

    if (!confirmed) return;

    setIsClearingCompleted(true);
    setActionMessage('');
    setActionError('');

    let query = supabase.from('orders').select('id').eq('status', 'completed');

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: completedOrders, error: fetchError } = await query;

    if (fetchError) {
      setActionError(fetchError.message);
      setIsClearingCompleted(false);
      return;
    }

    const completedIds = (completedOrders || []).map((order) => order.id);

    if (completedIds.length === 0) {
      setActionMessage('No completed orders found to clear.');
      setIsClearingCompleted(false);
      return;
    }

    const { error: itemsDeleteError } = await supabase
      .from('order_items')
      .delete()
      .in('order_id', completedIds);

    if (itemsDeleteError) {
      setActionError(itemsDeleteError.message);
      setIsClearingCompleted(false);
      return;
    }

    const { error: ordersDeleteError } = await supabase
      .from('orders')
      .delete()
      .in('id', completedIds);

    if (ordersDeleteError) {
      setActionError(ordersDeleteError.message);
      setIsClearingCompleted(false);
      return;
    }

    await handleFetchOrders();
    setActionMessage(`Cleared ${completedIds.length} completed order(s).`);
    setIsClearingCompleted(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>

          <div className="flex gap-3">
            <Link
              to="/admin"
              className="rounded-md bg-gray-900 px-4 py-2 text-white"
            >
              Orders
            </Link>
            <Link
              to="/admin/menu"
              className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100"
            >
              Menu
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Fetch Orders</h2>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleFetchOrders}
                disabled={loading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Loading...' : 'Fetch Orders'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
              {error}
            </div>
          )}

          {actionError && (
            <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
              {actionError}
            </div>
          )}

          {actionMessage && (
            <div className="rounded border border-green-400 bg-green-100 p-3 text-green-700">
              {actionMessage}
            </div>
          )}
        </div>

        {orders.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                Orders ({orders.length})
              </h2>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleClearCompletedOrders}
                  disabled={isClearingCompleted}
                  className="rounded-md bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:bg-gray-400"
                >
                  {isClearingCompleted ? 'Clearing...' : 'Clear Completed Orders'}
                </button>

                <button
                  onClick={handleExportCSV}
                  className="rounded-md bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="border-b bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Date Ordered</th>
                    <th className="px-4 py-3 text-left">Customer Name</th>
                    <th className="px-4 py-3 text-left">Phone Number</th>
                    <th className="px-4 py-3 text-left">Delivery Address</th>
                    <th className="px-4 py-3 text-left">Special Instructions</th>
                    <th className="px-4 py-3 text-left">Items</th>
                    <th className="px-4 py-3 text-center">Item Count</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.orderId} className="border-b align-top hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">{order.orderDate}</td>
                      <td className="px-4 py-3">{order.customerName}</td>
                      <td className="px-4 py-3">{order.phoneNumber}</td>
                      <td className="px-4 py-3">{order.deliveryAddress}</td>
                      <td className="px-4 py-3">{order.specialInstructions}</td>
                      <td className="px-4 py-3">{order.items}</td>
                      <td className="px-4 py-3 text-center">{order.itemCount}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ₱{Number(order.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          onChange={(e) =>
                            handleStatusChange(order.orderId, e.target.value)
                          }
                          disabled={savingOrderId === order.orderId}
                          className="rounded-md border border-gray-300 px-3 py-2"
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
