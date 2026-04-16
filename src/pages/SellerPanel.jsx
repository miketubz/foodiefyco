import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Change this path to match your AdminPanel.jsx if different

export default function SellerPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'archived'
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
       .from('orders')
       .select('*')
       .eq('is_archived', activeTab === 'archived')
       .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      setSelectedOrders(new Set());
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectOrder = (orderId) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const selectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const bulkArchive = async (archive) => {
    if (selectedOrders.size === 0) return;
    
    try {
      const updates = {
        is_archived: archive,
        archived_at: archive? new Date().toISOString() : null
      };

      const { error } = await supabase
       .from('orders')
       .update(updates)
       .in('id', Array.from(selectedOrders));

      if (error) throw error;
      fetchOrders();
    } catch (err) {
      console.error('Error updating orders:', err);
      alert('Failed to update orders: ' + err.message);
    }
  };

  if (loading) return <div className="p-8">Loading Seller Panel...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Seller Panel</h1>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'active'
               ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active Orders ({activeTab === 'active'? orders.length : '...'})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'archived'
               ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Archived Orders ({activeTab === 'archived'? orders.length : '...'})
          </button>
        </div>

        {/* Bulk Actions */}
        {orders.length > 0 && (
          <div className="mb-4 flex items-center gap-4 bg-white p-4 rounded-lg shadow">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedOrders.size === orders.length && orders.length > 0}
                onChange={selectAll}
                className="w-4 h-4"
              />
              <span className="text-sm">Select All</span>
            </label>
            
            {selectedOrders.size > 0 && (
              <>
                <span className="text-sm text-gray-600">
                  {selectedOrders.size} selected
                </span>
                {activeTab === 'active'? (
                  <button
                    onClick={() => bulkArchive(true)}
                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                  >
                    Archive Selected
                  </button>
                ) : (
                  <button
                    onClick={() => bulkArchive(false)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Unarchive Selected
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No {activeTab} orders found
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500"
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order.id)}
                    onChange={() => toggleSelectOrder(order.id)}
                    className="mt-1 w-4 h-4"
                  />
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg">Order #{order.id}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                        {order.is_archived && order.archived_at && (
                          <p className="text-xs text-orange-600 mt-1">
                            Archived: {new Date(order.archived_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          ₱{order.total_amount || 0}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded inline-block mt-1 ${
                          order.status === 'completed' 
                           ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status || 'pending'}
                        </div>
                      </div>
                    </div>

                    {/* Items from itemlist2 */}
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm font-semibold mb-2">Items:</div>
                      {order.itemlist2 && order.itemlist2.length > 0? (
                        <div className="space-y-1">
                          {order.itemlist2.map((item, idx) => (
                            <div key={idx} className="text-sm text-gray-700 flex justify-between">
                              <span>Item ID: {item.menu_item_id} × {item.quantity}</span>
                              <span className="font-medium">₱{item.price}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">No items</div>
                      )}
                    </div>

                    {/* Customer Info */}
                    {order.customer_name && (
                      <div className="mt-3 pt-3 border-t text-sm">
                        <div><span className="font-semibold">Customer:</span> {order.customer_name}</div>
                        {order.customer_phone && <div><span className="font-semibold">Phone:</span> {order.customer_phone}</div>}
                        {order.customer_address && <div><span className="font-semibold">Address:</span> {order.customer_address}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
