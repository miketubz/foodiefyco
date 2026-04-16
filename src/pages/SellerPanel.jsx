import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SellerPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [activeTab, setActiveTab] = useState('active');
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

  if (loading) return <div style={{padding: '40px', fontFamily: 'sans-serif'}}>Loading Seller Panel...</div>;
  if (error) return <div style={{padding: '40px', fontFamily: 'sans-serif', color: 'red'}}>Error: {error}</div>;

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f9fafb', padding: '16px', fontFamily: 'sans-serif'}}>
      <div style={{maxWidth: '1280px', margin: '0 auto'}}>
        <h1 style={{fontSize: '30px', fontWeight: 'bold', marginBottom: '24px'}}>Seller Panel</h1>
        
        <div style={{display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb'}}>
          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'active'? '2px solid #2563eb' : 'none',
              color: activeTab === 'active'? '#2563eb' : '#4b5563'
            }}
          >
            Active Orders ({activeTab === 'active'? orders.length : '...'})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'archived'? '2px solid #2563eb' : 'none',
              color: activeTab === 'archived'? '#2563eb' : '#4b5563'
            }}
          >
            Archived Orders ({activeTab === 'archived'? orders.length : '...'})
          </button>
        </div>

        {orders.length > 0 && (
          <div style={{marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
              <input
                type="checkbox"
                checked={selectedOrders.size === orders.length && orders.length > 0}
                onChange={selectAll}
              />
              <span style={{fontSize: '14px'}}>Select All</span>
            </label>
            
            {selectedOrders.size > 0 && (
              <>
                <span style={{fontSize: '14px', color: '#4b5563'}}>{selectedOrders.size} selected</span>
                <button
                  onClick={() => bulkArchive(activeTab === 'active')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeTab === 'active'? '#ea580c' : '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {activeTab === 'active'? 'Archive Selected' : 'Unarchive Selected'}
                </button>
              </>
            )}
          </div>
        )}

        {orders.length === 0? (
          <div style={{backgroundColor: 'white', borderRadius: '8px', padding: '32px', textAlign: 'center', color: '#6b7280'}}>
            No {activeTab} orders found
          </div>
        ) : (
          <div style={{display: 'grid', gap: '16px'}}>
            {orders.map((order) => (
              <div key={order.id} style={{backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #3b82f6'}}>
                <div style={{display: 'flex', alignItems: 'start', gap: '16px'}}>
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order.id)}
                    onChange={() => toggleSelectOrder(order.id)}
                    style={{marginTop: '4px'}}
                  />
                  
                  <div style={{flex: 1}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px'}}>
                      <div>
                        <h3 style={{fontWeight: 'bold', fontSize: '18px', margin: 0}}>Order #{order.id}</h3>
                        <p style={{fontSize: '14px', color: '#4b5563', margin: '4px 0 0 0'}}>
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                        {order.is_archived && order.archived_at && (
                          <p style={{fontSize: '12px', color: '#ea580c', margin: '4px 0 0 0'}}>
                            Archived: {new Date(order.archived_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div style={{textAlign: 'right'}}>
                        <div style={{fontSize: '24px', fontWeight: 'bold', color: '#16a34a'}}>
                          ₱{order.total_amount || 0}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          marginTop: '4px',
                          backgroundColor: order.status === 'completed'? '#dcfce7' : '#fef3c7',
                          color: order.status === 'completed'? '#166534' : '#854d0e'
                        }}>
                          {order.status || 'pending'}
                        </div>
                      </div>
                    </div>

                    <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb'}}>
                      <div style={{fontSize: '14px', fontWeight: '600', marginBottom: '8px'}}>Items:</div>
                      {order.itemlist2 && order.itemlist2.length > 0? (
                        <div>
                          {order.itemlist2.map((item, idx) => (
                            <div key={idx} style={{fontSize: '14px', color: '#374151', display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                              <span>Item ID: {item.menu_item_id} × {item.quantity}</span>
                              <span style={{fontWeight: '500'}}>₱{item.price}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{fontSize: '14px', color: '#9ca3af'}}>No items</div>
                      )}
                    </div>

                    {order.customer_name && (
                      <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', fontSize: '14px'}}>
                        <div><span style={{fontWeight: '600'}}>Customer:</span> {order.customer_name}</div>
                        {order.customer_phone && <div><span style={{fontWeight: '600'}}>Phone:</span> {order.customer_phone}</div>}
                        {order.customer_address && <div><span style={{fontWeight: '600'}}>Address:</span> {order.customer_address}</div>}
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
