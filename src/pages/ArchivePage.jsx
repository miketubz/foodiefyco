import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getPaymentProofUrl, QR_LINKS } from '../config/supabase';
import { exportSelectedArchiveToPDF } from '../utils/useOrdersExport';

const ArchivePage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [filters, setFilters] = useState({ start: '', end: '', status: 'all' });

  useEffect(() => {
    fetchArchivedOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [orders, filters]);

  const fetchArchivedOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false });
    
    if (error) console.error(error);
    else setOrders(data || []);
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...orders];
    if (filters.status !== 'all') {
      filtered = filtered.filter(o => o.status === filters.status);
    }
    if (filters.start) {
      filtered = filtered.filter(o => new Date(o.created_at) >= new Date(filters.start));
    }
    if (filters.end) {
      filtered = filtered.filter(o => new Date(o.created_at) <= new Date(filters.end + 'T23:59:59'));
    }
    setFilteredOrders(filtered);
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const unarchiveOrder = async (orderId) => {
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: false, archived_at: null })
      .eq('id', orderId);
    
    if (!error) fetchArchivedOrders();
  };

  const unarchiveSelected = async () => {
    if (selectedOrders.length === 0) return alert('Select orders to unarchive');
    const { error } = await supabase
      .from('orders')
      .update({ is_archived: false, archived_at: null })
      .in('id', selectedOrders);
    
    if (!error) {
      setSelectedOrders([]);
      fetchArchivedOrders();
    }
  };

  const handleExportPDF = () => {
    const ordersToExport = filteredOrders.filter(o => selectedOrders.includes(o.id));
    if (ordersToExport.length === 0) return alert('Select orders to export');
    exportSelectedArchiveToPDF(ordersToExport);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-2 mb-4 justify-between items-center">
        <h1 className="text-2xl font-bold">Archive - Orders</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/admin')} className="bg-blue-500 text-white px-4 py-2 rounded">Back to Admin</button>
          <button onClick={handlePrint} className="bg-gray-500 text-white px-4 py-2 rounded">Print</button>
          <button onClick={() => supabase.auth.signOut()} className="bg-red-500 text-white px-4 py-2 rounded">Sign Out</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm">Start Date</label>
          <input type="date" value={filters.start} onChange={(e) => setFilters({...filters, start: e.target.value})} className="border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block text-sm">End Date</label>
          <input type="date" value={filters.end} onChange={(e) => setFilters({...filters, end: e.target.value})} className="border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block text-sm">Status</label>
          <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} className="border px-2 py-1 rounded">
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button onClick={unarchiveSelected} className="bg-green-500 text-white px-3 py-2 rounded text-sm">Unarchive Selected ({selectedOrders.length})</button>
        <button onClick={handleExportPDF} className="bg-purple-500 text-white px-3 py-2 rounded text-sm">Export to PDF</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border print:text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border print:hidden"><input type="checkbox" onChange={(e) => setSelectedOrders(e.target.checked ? filteredOrders.map(o => o.id) : [])} /></th>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Customer</th>
                <th className="p-2 border">Total</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Payment</th>
                <th className="p-2 border">Proof</th>
                <th className="p-2 border">Ordered</th>
                <th className="p-2 border">Archived</th>
                <th className="p-2 border print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="p-2 border text-center print:hidden"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => handleSelectOrder(order.id)} /></td>
                  <td className="p-2 border text-xs">{order.id}</td>
                  <td className="p-2 border">{order.customer_name}</td>
                  <td className="p-2 border">₱{order.total_amount}</td>
                  <td className="p-2 border"><span className={`px-2 py-1 rounded text-xs ${order.status === 'completed' ? 'bg-green-200' : 'bg-red-200'}`}>{order.status}</span></td>
                  <td className="p-2 border">{order.payment_method}</td>
                  <td className="p-2 border text-center">
                    {order.payment_proof_path ? 
                      <a href={getPaymentProofUrl(order.payment_proof_path)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View</a> 
                      : <span className="text-gray-400 text-xs">None</span>}
                  </td>
                  <td className="p-2 border text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="p-2 border text-xs">{order.archived_at ? new Date(order.archived_at).toLocaleDateString() : '-'}</td>
                  <td className="p-2 border print:hidden">
                    <button onClick={() => unarchiveOrder(order.id)} className="bg-green-500 text-white px-2 py-1 rounded text-xs">Unarchive</button>
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

export default ArchivePage;
