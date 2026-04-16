import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SUPABASE_URL, BUCKET_PAYMENT_PROOFS, QR_LINKS, getPaymentProofUrl } from '../config/supabase';

const AdminPanel = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        setError(`Database error: ${error.message}. Check RLS policies.`);
        setOrders([]);
        return;
      }

      // Filter out null/invalid orders and ensure required fields exist
      const validOrders = (data || []).filter(order => order && order.id);
      setOrders(validOrders);
      
    } catch (err) {
      console.error('Fetch failed:', err);
      setError('Failed to load orders. Check console for details.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (selectedOrders.length === 0) {
      alert('Please select orders to archive');
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .in('id', selectedOrders);

      if (error) throw error;
      
      alert(`${selectedOrders.length} orders archived`);
      setSelectedOrders([]);
      fetchOrders();
    } catch (err) {
      console.error('Archive error:', err);
      alert('Failed to archive orders: ' + err.message);
    }
  };

  const toggleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(order => order.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded max-w-2xl">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <div className="mt-2 text-sm">
            <p>Common fixes:</p>
            <p>1. Run this SQL in Supabase: <code>ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;</code></p>
            <p>2. Make sure you ran the SQL migration for is_archived column</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Panel - Active Orders</h1>
        <div className="space-x-2">
          <button
            onClick={() => navigate('/admin/archive')}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            View Archive
          </button>
          <button
            onClick={() => navigate('/admin/profit')}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Profit Calculator
          </button>
        </div>
      </div>

      <div className="mb-4">
        <button
          onClick={handleArchive}
          disabled={selectedOrders.length === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Archive Selected ({selectedOrders.length})
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No active orders found. Check if RLS is blocking the query or if all orders are archived.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3 border text-left">ID</th>
                <th className="p-3 border text-left">Customer</th>
                <th className="p-3 border text-left">Total</th>
                <th className="p-3 border text-left">Payment</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Date</th>
                <th className="p-3 border text-left">Proof</th>
                <th className="p-3 border text-left">QR Code</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="p-3 border text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => toggleSelectOrder(order.id)}
                    />
                  </td>
                  <td className="p-3 border text-xs">{order.id ? order.id.substring(0, 8) : 'N/A'}</td>
                  <td className="p-3 border">{order.customer_name || 'N/A'}</td>
                  <td className="p-3 border">₱{parseFloat(order.total_amount || 0).toFixed(2)}</td>
                  <td className="p-3 border">{order.payment_method || 'N/A'}</td>
                  <td className="p-3 border">
                    <span className={`px-2 py-1 rounded text-xs ${
                      order.status === 'completed' ? 'bg-green-200 text-green-800' : 
                      order.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : 
                      'bg-gray-200 text-gray-800'
                    }`}>
                      {order.status || 'unknown'}
                    </span>
                  </td>
                  <td className="p-3 border text-sm">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-3 border">
                    {order.payment_proof_path ? (
                      <a
                        href={getPaymentProofUrl(order.payment_proof_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">None</span>
                    )}
                  </td>
                  <td className="p-3 border">
                    {order.payment_method && QR_LINKS[order.payment_method] ? (
                      <img
                        src={QR_LINKS[order.payment_method]}
                        alt={`${order.payment_method} QR`}
                        className="w-16 h-16 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
