import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { QR_LINKS, getPaymentProofUrl } from '../config/supabase';

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
      
      console.log('Fetching orders...');
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        setError(`Database error: ${error.message}. Check if 'is_archived' column exists.`);
        setOrders([]);
        return;
      }

      console.log('Raw data from Supabase:', data);
      const safeOrders = (data || []).filter(order => order && typeof order === 'object' && order.id);
      setOrders(safeOrders);
      
    } catch (err) {
      console.error('Fetch crashed:', err);
      setError(`App crashed: ${err.message}`);
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
        .update({ 
          is_archived: true, 
          archived_at: new Date().toISOString() 
        })
        .in('id', selectedOrders);

      if (error) throw error;
      
      alert(`Archived ${selectedOrders.length} order(s)`);
      setSelectedOrders([]);
      fetchOrders();
    } catch (err) {
      console.error('Archive error:', err);
      alert('Failed to archive: ' + err.message);
    }
  };

  const toggleSelectOrder = (orderId) => {
    if (!orderId) return;
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === orders.length && orders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id).filter(Boolean));
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    return isNaN(num) ? '₱0.00' : `₱${num.toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl text-gray-600">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-red-50 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-2xl">
          <h2 className="font-bold text-lg mb-2">Error Loading Orders</h2>
          <p className="mb-3">{error}</p>
          <div className="text-sm bg-red-100 p-3 rounded">
            <p className="font-semibold mb-1">Most likely causes:</p>
            <p>1. Column 'is_archived' doesn't exist - run the SQL migration</p>
            <p>2. RLS is still blocking - run: <code>ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;</code></p>
            <p>3. Check browser console for more details</p>
          </div>
          <button 
            onClick={fetchOrders}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">Active Orders</h1>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate('/admin/archive')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
            >
              View Archive
            </button>
            <button
              onClick={() => navigate('/admin/profit')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Profit Calculator
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <button
            onClick={handleArchive}
            disabled={selectedOrders.length === 0}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            Archive Selected ({selectedOrders.length})
          </button>
          <span className="text-gray-600 text-sm">
            Total: {orders.length} orders
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">No active orders found</p>
            <p className="text-gray-400 text-sm">
              All orders may be archived, or check if 'is_archived' column exists in Supabase
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedOrders.length === orders.length && orders.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">ID</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">Customer</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">Total</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">Payment</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">Proof</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600 uppercase">QR</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id || Math.random()} className="hover:bg-gray-50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="p-3 text-xs font-mono text-gray-600">
                        {order.id ? String(order.id).substring(0, 8) : 'N/A'}
                      </td>
                      <td className="p-3 text-sm text-gray-800">
                        {order.customer_name || 'N/A'}
                      </td>
                      <td className="p-3 text-sm font-semibold text-gray-800">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {order.payment_method || 'N/A'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status || 'unknown'}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="p-3">
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
                      <td className="p-3">
                        {order.payment_method && QR_LINKS[order.payment_method] ? (
                          <img
                            src={QR_LINKS[order.payment_method]}
                            alt={`${order.payment_method} QR`}
                            className="w-12 h-12 object-contain"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
