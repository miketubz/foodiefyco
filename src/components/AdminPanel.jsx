import React, { useMemo, useState } from 'react';
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
  });
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [clearingCompleted, setClearingCompleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleFetchOrders = async () => {
    setActionError('');
    setSuccessMessage('');

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
    setActionError('');
    setSuccessMessage('');

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
    setSavingOrderId(null);
    setSuccessMessage(`Order status updated to ${newStatus}.`);
  };

  const handleClearCompletedOrders = async () => {
    const completedOrders = orders.filter((order) => order.status === 'completed');

    if (completedOrders.length === 0) {
      alert('No completed orders to clear.');
      return;
    }

    const confirmed = window.confirm('Clear all completed orders?');
    if (!confirmed) return;

    setClearingCompleted(true);
    setActionError('');
    setSuccessMessage('');

    const ids = completedOrders.map((order) => order.orderId);

    const { error } = await supabase.from('orders').delete().in('id', ids);

    if (error) {
      setActionError(error.message);
      setClearingCompleted(false);
      return;
    }

    await handleFetchOrders();
    setClearingCompleted(false);
    setExpandedOrderId(null);
    setSuccessMessage('Completed orders cleared.');
  };

  const handlePrintReceipt = (order) => {
    const receiptWindow = window.open('', '_blank', 'width=800,height=900');

    if (!receiptWindow) {
      alert('Please allow popups to print the receipt.');
      return;
    }

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
              <p><strong>Promo Code:</strong> ${order.promoCode || 'None'}</p>
              <p><strong>Discount:</strong> ₱${Number(order.discountAmount || 0).toFixed(2)}</p>
              <p><strong>Status:</strong> ${order.status}</p>
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

            <p style="font-size: 18px; text-align: right;"><strong>Total: ₱${Number(order.totalAmount || 0).toFixed(2)}</strong></p>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  const handlePdfReceipt = (order) => {
    handlePrintReceipt(order);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setActionError(error.message);
      return;
    }

    navigate('/admin/login', { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return orders;

    return orders.filter((order) => {
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
        order.promoCode,
        order.itemsSummary,
        order.specialInstructions,
        order.status,
        orderItemText,
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

  const getStatusClasses = (status) => {
    if (status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (status === 'cancelled') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  const renderExpandedDetails = (order) => (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-gray-800">Order Details</h3>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Order ID:</span> {order.orderId}</p>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Date Ordered:</span> {order.orderDate}</p>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Customer:</span> {order.customerName}</p>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Phone:</span> {order.phoneNumber}</p>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Payment Method:</span> {order.paymentMethod || 'Not specified'}</p>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
        <p className="mb-2 text-sm text-gray-700"><span className="font-semibold">Discount:</span> ₱{Number(order.discountAmount || 0).toFixed(2)}</p>
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
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>

          <div className="flex flex-wrap gap-3">
            <Link to="/" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Storefront</Link>
            <Link to="/admin" className="rounded-md bg-gray-900 px-4 py-2 text-white">Orders</Link>
            <Link to="/admin/menu" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Menu</Link>
            <button onClick={handleSignOut} className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Sign Out</button>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Fetch Orders</h2>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
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
          <div className="rounded-lg bg-white p-4 sm:p-6 shadow">
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

            <div className="space-y-4 lg:hidden">
              {filteredOrders.length === 0 ? (
                <div className="rounded-xl border border-gray-200 p-6 text-center text-gray-500">No orders matched your search.</div>
              ) : (
                filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.orderId;
                  return (
                    <div key={order.orderId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-500">{order.orderDate}</p>
                          <h3 className="text-lg font-semibold text-gray-900">{order.customerName}</h3>
                          <p className="text-sm text-gray-600">{order.phoneNumber}</p>
                        </div>
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${getStatusClasses(order.status)}`}>{order.status}</span>
                      </div>

                      <div className="grid gap-2 text-sm text-gray-700">
                        <p><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
                        <p><span className="font-semibold">Payment:</span> {order.paymentMethod || 'N/A'}</p>
                        <p><span className="font-semibold">Promo Code:</span> {order.promoCode || 'None'}</p>
                        <p><span className="font-semibold">Discount:</span> ₱{Number(order.discountAmount || 0).toFixed(2)}</p>
                        <p><span className="font-semibold">Items:</span> {order.itemsSummary || 'No items'}</p>
                        <p><span className="font-semibold">Item Count:</span> {order.itemCount}</p>
                        <p><span className="font-semibold">Total:</span> ₱{Number(order.totalAmount).toFixed(2)}</p>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-800">{isExpanded ? 'Hide' : 'View'}</button>
                          <button onClick={() => handlePrintReceipt(order)} className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">Print</button>
                          <button onClick={() => handlePdfReceipt(order)} className="rounded-md bg-purple-600 px-3 py-2 text-white hover:bg-purple-700">PDF</button>
                        </div>
                      </div>

                      {isExpanded && <div className="mt-4">{renderExpandedDetails(order)}</div>}
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1750px] text-sm">
                <thead className="border-b bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Date Ordered</th>
                    <th className="px-4 py-3 text-left">Customer Name</th>
                    <th className="px-4 py-3 text-left">Phone Number</th>
                    <th className="px-4 py-3 text-left">Delivery Address</th>
                    <th className="px-4 py-3 text-left">Payment</th>
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
                    <tr>
                      <td colSpan="12" className="px-4 py-6 text-center text-gray-500">No orders matched your search.</td>
                    </tr>
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
                            <td className="px-4 py-3">{order.paymentMethod || 'N/A'}</td>
                            <td className="px-4 py-3">{order.promoCode || 'None'}</td>
                            <td className="px-4 py-3 text-right">₱{Number(order.discountAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3">{order.itemsSummary || 'No items'}</td>
                            <td className="px-4 py-3 text-center">{order.itemCount}</td>
                            <td className="px-4 py-3 text-right font-semibold">₱{Number(order.totalAmount).toFixed(2)}</td>
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
                                <button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-800">{isExpanded ? 'Hide' : 'View'}</button>
                                <button onClick={() => handlePrintReceipt(order)} className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">Print</button>
                                <button onClick={() => handlePdfReceipt(order)} className="rounded-md bg-purple-600 px-3 py-2 text-white hover:bg-purple-700">PDF</button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="border-b bg-gray-50">
                              <td colSpan="12" className="px-6 py-4">{renderExpandedDetails(order)}</td>
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
        )}
      </div>
    </div>
  );
};
