import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SUPABASE_URL, BUCKET_PAYMENT_PROOFS, QR_LINKS, getPaymentProofUrl } from '../config/supabase';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  const archiveOrder = async (orderId) => {
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', orderId);
    
    if (!error) fetchOrders();
  };

  const archiveSelected = async () => {
    if (selectedOrders.length === 0) return alert('Select orders to archive');
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .in('id', selectedOrders);
    
    if (!error) {
      setSelectedOrders([]);
      fetchOrders();
    }
  };

  const archiveByStatus = async (status) => {
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('is_archived', false)
      .eq('status', status);
    
    if (!error) fetchOrders();
  };

  const archiveByDateRange = async () => {
    if (!dateRange.start || !dateRange.end) return alert('Select date range');
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('is_archived', false)
      .in('status', ['completed', 'cancelled'])
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    
    if (!error) {
      setDateRange({ start: '', end: '' });
      fetchOrders();
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-2 mb-4 justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Panel - Orders</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/')} className="bg-blue-500 text-white px-4 py-2 rounded">Front Store</button>
          <button onClick={() => navigate('/admin/profit')} className="bg-green-500 text-white px-4 py-2 rounded">Profit Calculator</button>
          <button onClick={() => navigate('/admin/archive')} className="bg-purple-500 text-white px-4 py-2 rounded">View Archive</button>
          <button onClick={() => supabase.auth.signOut()} className="bg-red-500 text-white px-4 py-2 rounded">Sign Out</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <button onClick={archiveSelected} className="bg-orange-500 text-white px-3 py-2 rounded text-sm">Archive Selected ({selectedOrders.length})</button>
        <button onClick={() => archiveByStatus('completed')} className="bg-yellow-600 text-white px-3 py-2 rounded text-sm">Archive All Completed</button>
        <button onClick={() => archiveByStatus('cancelled')} className="bg-gray-600 text-white px-3 py-2 rounded text-sm">Archive All Cancelled</button>
        <div className="flex gap-1 items-center">
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="border px-2 py-1 rounded text-sm" />
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="border px-2 py-1 rounded text-sm" />
          <button onClick={archiveByDateRange} className="bg-indigo-500 text-white px-3 py-2 rounded text-sm">Archive by Date Range</button>
        </div>
      </div>

      {loading ? <p>Loading...</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border"><input type="checkbox" checked={selectedOrders.length === orders.length && orders.length > 0} onChange={handleSelectAll} /></th>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Customer</th>
                <th className="p-2 border">Total</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Payment Method</th>
                <th className="p-2 border">QR</th>
                <th className="p-2 border">Proof</th>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="p-2 border text-center"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => handleSelectOrder(order.id)} /></td>
                  <td className="p-2 border text-xs">{order.id}</td>
                  <td className="p-2 border">{order.customer_name}</td>
                  <td className="p-2 border">₱{order.total_amount}</td>
                  <td className="p-2 border"><span className={`px-2 py-1 rounded text-xs ${order.status === 'completed' ? 'bg-green-200' : order.status === 'cancelled' ? 'bg-red-200' : 'bg-yellow-200'}`}>{order.status}</span></td>
                  <td className="p-2 border">{order.payment_method}</td>
                  <td className="p-2 border text-center">
                    {QR_LINKS[order.payment_method] && <img src={QR_LINKS[order.payment_method]} alt="QR" className="w-12 h-12 mx-auto" />}
                  </td>
                  <td className="p-2 border text-center">
                    {order.payment_proof_path ? 
                      <a href={getPaymentProofUrl(order.payment_proof_path)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View Proof</a> 
                      : <span className="text-gray-400 text-xs">No upload yet</span>}
                  </td>
                  <td className="p-2 border text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="p-2 border">
                    <button onClick={() => archiveOrder(order.id)} className="bg-orange-500 text-white px-2 py-1 rounded text-xs">Archive</button>
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
