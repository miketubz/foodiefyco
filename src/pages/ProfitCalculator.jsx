import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const ProfitCalculator = () => {
  const navigate = useNavigate();

  const [investment, setInvestment] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePreset, setActivePreset] = useState('');

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ start: today, end: today });
    setActivePreset('today');
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    setDateRange({ start: dateStr, end: dateStr });
    setActivePreset('yesterday');
  };

  const setLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
    setActivePreset('last7');
  };

  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    });
    setActivePreset('month');
  };

  const updateDate = (field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
    setActivePreset('');
  };

  const fetchSalesSummary = async () => {
    if (!dateRange.start || !dateRange.end) {
      setSalesData(null);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('id, total_amount, discount_amount, status, created_at')
      .eq('status', 'completed')
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error(fetchError);
      setError(fetchError.message || 'Failed to fetch sales data.');
      setSalesData(null);
      setLoading(false);
      return;
    }

    const totalSales = data.reduce((sum, order) => {
      const amount = parseFloat(order.total_amount) || 0;
      const discount = parseFloat(order.discount_amount) || 0;
      return sum + Math.max(0, amount - discount);
    }, 0);

    const grouped = data.reduce((acc, order) => {
      const dayKey = new Date(order.created_at).toISOString().split('T')[0];
      const amount = Math.max(
        0,
        (parseFloat(order.total_amount) || 0) - (parseFloat(order.discount_amount) || 0)
      );

      if (!acc[dayKey]) {
        acc[dayKey] = { date: dayKey, total: 0, orders: 0 };
      }

      acc[dayKey].total += amount;
      acc[dayKey].orders += 1;
      return acc;
    }, {});

    const dailyBreakdown = Object.values(grouped);

    setSalesData({
      totalSales,
      orderCount: data.length,
      averageOrderValue: data.length ? totalSales / data.length : 0,
      dailyBreakdown,
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchSalesSummary();
  }, [dateRange.start, dateRange.end]);

  const investmentNum = useMemo(() => parseFloat(investment) || 0, [investment]);

  const computed = useMemo(() => {
    if (!salesData) {
      return {
        grossProfit: 0,
        margin: 0,
        highestDay: null,
        chartMax: 0,
      };
    }

    const grossProfit = salesData.totalSales - investmentNum;
    const margin =
      salesData.totalSales > 0 ? (grossProfit / salesData.totalSales) * 100 : 0;

    const highestDay = salesData.dailyBreakdown.reduce((max, day) => {
      if (!max || day.total > max.total) return day;
      return max;
    }, null);

    const chartMax = salesData.dailyBreakdown.reduce(
      (max, day) => Math.max(max, day.total),
      0
    );

    return {
      grossProfit,
      margin,
      highestDay,
      chartMax,
    };
  }, [salesData, investmentNum]);

  const canShowResults = Boolean(salesData);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Admin Insights
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Profit Calculator
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Pick a date range to load sales automatically, then enter your cost to see profit.
            </p>
          </div>

          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Back to Admin
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Controls</h2>
            <p className="mt-1 text-sm text-slate-500">
              Date range loads sales instantly. Profit updates as you type your investment.
            </p>

            <div className="mt-5">
              <label className="block text-sm font-semibold text-slate-700">
                Quick ranges
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { key: 'today', label: 'Today', onClick: setToday },
                  { key: 'yesterday', label: 'Yesterday', onClick: setYesterday },
                  { key: 'last7', label: 'Last 7 Days', onClick: setLast7Days },
                  { key: 'month', label: 'This Month', onClick: setThisMonth },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={preset.onClick}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activePreset === preset.key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Start date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => updateDate('start', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  End date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => updateDate('end', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Investment / Cost
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={investment}
                  onChange={(e) => setInvestment(e.target.value)}
                  placeholder="Enter total cost for this range"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Example: ingredients, labor, packaging, delivery, utilities.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total Sales</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {loading ? 'Loading...' : formatCurrency(salesData?.totalSales || 0)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Completed orders only
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Order Count</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {loading ? 'Loading...' : salesData?.orderCount || 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Orders in selected range
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Avg. Order Value</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {loading ? 'Loading...' : formatCurrency(salesData?.averageOrderValue || 0)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Sales divided by orders
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Profit / Loss</p>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    computed.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {loading ? 'Loading...' : formatCurrency(computed.grossProfit)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Sales minus investment
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
              <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Sales Trend
                    </h2>
                    <p className="text-sm text-slate-500">
                      Daily completed sales for the selected range
                    </p>
                  </div>
                  {dateRange.start && dateRange.end && (
                    <p className="text-sm font-medium text-slate-500">
                      {dateRange.start} to {dateRange.end}
                    </p>
                  )}
                </div>

                {!dateRange.start || !dateRange.end ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                    Choose a start and end date to load your dashboard.
                  </div>
                ) : loading ? (
                  <div className="mt-6 rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    Loading sales data...
                  </div>
                ) : !canShowResults || salesData.dailyBreakdown.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                    No completed orders found for this range.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {salesData.dailyBreakdown.map((day) => {
                      const width =
                        computed.chartMax > 0 ? `${(day.total / computed.chartMax) * 100}%` : '0%';

                      return (
                        <div key={day.date}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <div>
                              <p className="font-semibold text-slate-800">{day.date}</p>
                              <p className="text-slate-500">{day.orders} order(s)</p>
                            </div>
                            <p className="font-semibold text-slate-900">
                              {formatCurrency(day.total)}
                            </p>
                          </div>
                          <div className="h-3 w-full rounded-full bg-slate-100">
                            <div
                              className="h-3 rounded-full bg-emerald-500 transition-all"
                              style={{ width }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Profit Summary
                  </h2>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Sales</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(salesData?.totalSales || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Investment</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(investmentNum)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Margin</span>
                      <span
                        className={`font-semibold ${
                          computed.margin >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {computed.margin.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4">
                      <span className="text-sm font-semibold text-slate-700">Net Profit</span>
                      <span
                        className={`text-xl font-bold ${
                          computed.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(computed.grossProfit)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Highlights
                  </h2>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-sm text-slate-500">Best sales day</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {computed.highestDay ? computed.highestDay.date : 'No data yet'}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {computed.highestDay
                          ? `${formatCurrency(computed.highestDay.total)} from ${computed.highestDay.orders} order(s)`
                          : 'Select a date range with completed orders.'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-sm text-slate-500">Range status</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {!dateRange.start || !dateRange.end
                          ? 'Waiting for dates'
                          : loading
                          ? 'Loading data'
                          : salesData?.orderCount
                          ? 'Ready'
                          : 'No orders'}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {!dateRange.start || !dateRange.end
                          ? 'Pick dates to load sales cards and chart.'
                          : 'Your summary updates automatically.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfitCalculator;
