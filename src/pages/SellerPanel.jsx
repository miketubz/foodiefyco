import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const SellerPanel = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active'); // active | archived

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const isArchived = filter === 'archived';
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('is_archived', isArchived)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Use itemlist2 if it exists, fallback to empty array
      const ordersWithItems = ordersData.map(order => ({
        ...order,
        items: order.itemlist2 || []
      }));

      setOrders(ordersWithItems);
      setSelectedOrders(new Set());
    } catch (err) {
      console.error('SellerPanel fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleArchiveSelected = async () => {
    if (selectedOrders.size === 0) return;
    const ids = Array.from(selectedOrders);
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .in('id', ids);
    if (error) alert('Archive failed: ' + error.message);
    else fetchOrders();
  };

  const handleUnarchiveSelected = async () => {
    if (selectedOrders.size === 0) return;
    const ids = Array.from(selectedOrders);
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: false, archived_at: null })
      .in('id', ids);
    if (error) alert('Unarchive failed: ' + error.message);
    else fetchOrders();
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedOrders);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedOrders(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    return isNaN(num) ? '₱0.00' : `₱${num.toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleString('en-PH'); } 
    catch { return 'Invalid Date'; }
  };

  if (loading) return <div className="p-8 text-xl">Loading Seller Panel...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Seller Panel</h1>
          <div className="flex gap-2">
            <button onClick={() => setFilter('active')} className={`px-4 py-2 rounded ${filter==='active'?'bg-blue-600 text-white':'bg-white'}`}>Active</button>
            <button onClick={() => setFilter('archived')} className={`px-4 py-2 rounded ${filter==='archived'?'bg-blue-600 text-white':'bg-white'}`}>Archived</button>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {filter === 'active' ? (
            <button onClick={handleArchiveSelected} disabled={selectedOrders.size===0} className="px-4 py-2 bg-orange-600 text-white rounded disabled:bg-gray-300">
              Archive Selected ({selectedOrders.size})
            </button>
          ) : (
            <button onClick={handleUnarchiveSelected} disabled={selectedOrders.size===0} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-300">
              Unarchive Selected ({selectedOrders.size})
            </button>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">No {filter} orders found</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4 flex items-center gap-2">
              <input type="checkbox" checked={selectedOrders.size===orders.length && orders.length>0} onChange={toggleSelectAll} />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4 pb-4 border-b">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedOrders.has(order.id)} onChange={() => toggleSelect(order.id)} className="mt-1" />
                    <div>
                      <h2 className="text-xl font-semibold">Order #{String(order.id).substring(0, 8)}</h2>
                      <p className="text-gray-600">{order.customer_name || 'No name'} | {order.customer_email || 'No email'}</p>
                      <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatCurrency(order.total_amount)}</p>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>{order.status || 'unknown'}</span>
                  </div>
                </div>

                <h3 className="font-semibold mb-2">Items:</h3>
                {(!order.items || order.items.length === 0) ? (
                  <p className="text-gray-400 text-sm">No items found for this order</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-left">Qty</th>
                        <th className="p-2 text-left">Price</th>
                        <th className="p-2 text-left">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr key={item.id || idx} className="border-t">
                          <td className="p-2">{item.name || item.item_name || item.product_name || 'N/A'}</td>
                          <td className="p-2">{item.quantity || 0}</td>
                          <td className="p-2">{formatCurrency(item.price)}</td>
                          <td className="p-2">{formatCurrency((item.price || 0) * (item.quantity || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerPanel;