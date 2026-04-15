import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const normalizeSourceValue = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'website' || source === 'internal') return 'internal';
  if (source === 'external') return 'external';
  return source;
};

const normalizeText = (value, fallback = 'N/A') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const formatOrderDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getUtcBoundsForLocalDateRange = (startDate, endDate) => {
  const bounds = {};

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) bounds.startIso = start.toISOString();
  }

  if (endDate) {
    const endExclusive = new Date(`${endDate}T00:00:00`);
    if (!Number.isNaN(endExclusive.getTime())) {
      endExclusive.setDate(endExclusive.getDate() + 1);
      bounds.endIsoExclusive = endExclusive.toISOString();
    }
  }

  return bounds;
};

export function useOrdersExport() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrdersForExport = useCallback(async (filters = {}) => {
    const { startDate, endDate, status, paymentStatus, orderSource } = filters;
    setLoading(true);
    setError('');

    try {
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          phone_number,
          delivery_address,
          special_instructions,
          total_amount,
          status,
          created_at,
          updated_at,
          payment_method,
          payment_status,
          payment_proof_option,
          payment_proof_path,
          promo_code,
          discount_amount,
          order_source
        `)
        .order('created_at', { ascending: false });

      const { startIso, endIsoExclusive } = getUtcBoundsForLocalDateRange(startDate, endDate);

      if (startIso) ordersQuery = ordersQuery.gte('created_at', startIso);
      if (endIsoExclusive) ordersQuery = ordersQuery.lt('created_at', endIsoExclusive);
      if (status && status !== 'all') ordersQuery = ordersQuery.eq('status', status);
      if (paymentStatus && paymentStatus !== 'all') ordersQuery = ordersQuery.eq('payment_status', paymentStatus);

      if (orderSource && orderSource !== 'all') {
        const normalizedSource = normalizeSourceValue(orderSource);
        if (normalizedSource === 'external') {
          ordersQuery = ordersQuery.eq('order_source', 'external');
        } else {
          ordersQuery = ordersQuery.or('order_source.is.null,order_source.eq.internal,order_source.eq.website');
        }
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      const orderRows = ordersData || [];
      const orderIds = orderRows.map((row) => row.id);

      let orderItemsRows = [];
      if (orderIds.length > 0) {
        const { data, error: itemsError } = await supabase
          .from('order_items')
          .select('id, order_id, menu_item_id, quantity, price')
          .in('order_id', orderIds);
        if (itemsError) throw itemsError;
        orderItemsRows = data || [];
      }

      const menuItemIds = [...new Set(orderItemsRows.map((item) => item.menu_item_id).filter(Boolean))];
      let menuNameById = new Map();

      if (menuItemIds.length > 0) {
        const { data, error: menuError } = await supabase
          .from('menu_item')
          .select('id, name')
          .in('id', menuItemIds);
        if (menuError) throw menuError;
        menuNameById = new Map((data || []).map((item) => [String(item.id), item.name]));
      }

      const itemsByOrderId = orderItemsRows.reduce((acc, item) => {
        const orderId = item.order_id;
        if (!acc[orderId]) acc[orderId] = [];

        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        acc[orderId].push({
          id: item.id,
          menu_item_id: item.menu_item_id,
          name: menuNameById.get(String(item.menu_item_id)) || 'Item',
          quantity,
          price,
          subtotal: quantity * price,
        });
        return acc;
      }, {});

      const normalizedOrders = orderRows.map((order) => {
        const orderItems = itemsByOrderId[order.id] || [];
        const itemCount = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const itemsSummary = orderItems.length
          ? orderItems.map((item) => `${item.quantity}x ${item.name}`).join(', ')
          : 'No items';

        return {
          id: order.id,
          orderId: order.id,
          orderDate: formatOrderDateTime(order.created_at),
          customerName: normalizeText(order.customer_name),
          phoneNumber: normalizeText(order.phone_number),
          deliveryAddress: normalizeText(order.delivery_address),
          specialInstructions: normalizeText(order.special_instructions, 'None'),
          totalAmount: Number(order.total_amount || 0),
          status: normalizeText(order.status, 'pending').toLowerCase(),
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          paymentMethod: normalizeText(order.payment_method),
          paymentStatus: normalizeText(order.payment_status, 'unpaid').toLowerCase(),
          paymentProofOption: order.payment_proof_option || '',
          paymentProofPath: order.payment_proof_path || '',
          paymentProofUrl: order.payment_proof_path || '',
          promoCode: order.promo_code || '',
          discountAmount: Number(order.discount_amount || 0),
          orderSource: normalizeSourceValue(order.order_source),
          orderItems,
          itemCount,
          itemsSummary,
        };
      });

      setOrders(normalizedOrders);
      return normalizedOrders;
    } catch (err) {
      setOrders([]);
      setError(err?.message || 'Failed to fetch orders.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { orders, loading, error, fetchOrdersForExport };
}
