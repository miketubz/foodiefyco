import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProfitCalculator = () => {
  const navigate = useNavigate();
  const [investment, setInvestment] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ start: today, end: today });
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    setDateRange({ start: dateStr, end: dateStr });
  };

  const calculateProfit = async () => {
    if (!dateRange.start || !dateRange.end) return alert('Select date range');
    if (!investment) return alert('Enter investment amount');
    
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('total_amount, discount_amount, status')
      .eq('status', 'completed')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const totalSales = data.reduce((sum, order) => {
      const amount = parseFloat(order.total_amount) || 0;
      const discount = parseFloat(order.discount_amount) || 0;
      return sum + (amount - discount);
    }, 0);

    const investmentNum = parseFloat(investment) || 0;
    const grossProfit = totalSales - investmentNum;
    const margin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(2) : 0;

    setResults({
      totalSales: totalSales.toFixed(2),
      investment: investmentNum.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      margin: margin,
      orderCount: data.length
    });
    setLoading(false);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Profit Calculator</h1>
        <button onClick={() => navigate('/admin')} className="bg-blue-500 text-white px-4 py-2 rounded">Back to Admin</button>
      </div>

      <div className="bg-white p-6 rounded shadow mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Investment Amount (₱)</label>
          <input 
            type="number" 
            value={investment} 
            onChange={(e) => setInvestment(e.target.value)} 
            placeholder="Enter total investment/cost"
            className="w-full border px-3 py-2 rounded" 
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select Date Range</label>
          <div className="flex gap-2 mb-2">
            <button onClick={setToday} className="bg-gray-200 px-3 py-1 rounded text-sm">Today</button>
            <button onClick={setYesterday} className="bg-gray-200 px-3 py-1 rounded text-sm">Yesterday</button>
          </div>
          <div className="flex gap-2">
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="flex-1 border px-3 py-2 rounded" />
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="flex-1 border px-3 py-2 rounded" />
          </div>
        </div>

        <button onClick={calculateProfit} disabled={loading} className="w-full bg-green-600 text-white px-4 py-2 rounded font-medium">
          {loading ? 'Calculating...' : 'Calculate Profit'}
        </button>
      </div>

      {results && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Results</h2>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-600">Total Sales ({results.orderCount} orders)</span>
              <span className="font-bold text-lg">₱{results.totalSales}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-600">Investment/Cost</span>
              <span className="font-bold text-lg">₱{results.investment}</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 rounded border-2 border-blue-200">
              <span className="text-gray-800 font-medium">Gross Profit</span>
              <span className={`font-bold text-xl ${parseFloat(results.grossProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>₱{results.grossProfit}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-600">Profit Margin</span>
              <span className="font-bold text-lg">{results.margin}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitCalculator;
