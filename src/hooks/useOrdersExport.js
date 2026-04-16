import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const normalizeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const normalizeSource = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'website' || source === 'internal') return 'internal';
  if (source === 'external') return 'external';
  return source;
};

const normalizePaymentMethod = (value) => {
  const text = normalizeText(value, 'N/A');
  return text;
};

const normalizePaymentStatus = (value) => {
  const text = String(value || 'unpaid').trim().toLowerCase();
  return text === 'paid' ? 'paid' : 'unpaid';
};

const makePublicUrl = (path) => {
  const cleanPath = normalizeText(path);
  if (!cleanPath) return '';
  const { data } = supabase.storage.from('payment-proofs').getPublicUrl(cleanPath);
  return data?.publicUrl || '';
};

export const useOrdersExport = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrdersForExport = useCallback(async (filters = {}) => {
    setLoading(true);
    setError('');

    try {
      let ordersQuery = supabase
        .from('orders')
        .select(
          `
            id,
            created_at,
            updated_at,
            total_amount,
            status,
            payment_status,
            payment_method,
            payment_proof_option,
            payment_proof_path,
            promo_code,
            discount_amount,
            order_source,
            customer_name,
            phone_number,
            delivery_address,
            special_instructions
          `
        )
        .order('created_at', { ascending: false });

      if (filters.startDate) {
        ordersQuery = ordersQuery.gte('created_at', `${filters.startDate}T00:00:00`);
      }

      if (filters.endDate) {
        ordersQuery = ordersQuery.lte('created_at', `${filters.endDate}T23:59:59.999`);
      }

      if (filters.status && filters.status !== 'all') {
        ordersQuery = ordersQuery.eq('status', filters.status);
      }

      if (filters.paymentStatus && filters.paymentStatus !== 'all') {
        ordersQuery = ordersQuery.eq('payment_status', filters.paymentStatus);
      }

      if (filters.orderSource && filters.orderSource !== 'all') {
        const source = normalizeSource(filters.orderSource);
        if (source === 'external') {
          ordersQuery = ordersQuery.eq('order_source', 'external');
        } else {
          ordersQuery = ordersQuery.or('order_source.is.null,order_source.eq.internal,order_source.eq.website');
        }
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      const rawOrders = ordersData || [];
      const orderIds = rawOrders.map((order) => order.id).filter(Boolean);

      let itemsByOrderId = {};
      if (orderIds.length > 0) {
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from('order_items')
          .select('id, order_id, menu_item_id, quantity, price')
          .in('order_id', orderIds)
          .order('id', { ascending: true });

        if (orderItemsError) throw orderItemsError;

        const orderItems = orderItemsData || [];
        const menuItemIds = [...new Set(orderItems.map((item) => item.menu_item_id).filter(Boolean))];

        let menuNameById = {};
        if (menuItemIds.length > 0) {
          const { data: menuItemsData, error: menuItemsError } = await supabase
            .from('menu_item')
            .select('id, name')
            .in('id', menuItemIds);

          if (menuItemsError) throw menuItemsError;

          menuNameById = Object.fromEntries(
            (menuItemsData || []).map((item) => [item.id, normalizeText(item.name, 'Unknown Item')])
          );
        }

        itemsByOrderId = orderItems.reduce((acc, item) => {
          const orderId = item.order_id;
          if (!acc[orderId]) acc[orderId] = [];

          const quantity = Number(item.quantity || 0);
          const price = Number(item.price || 0);
          const subtotal = quantity * price;

          acc[orderId].push({
            id: item.id,
            menuItemId: item.menu_item_id,
            name: menuNameById[item.menu_item_id] || 'Unknown Item',
            quantity,
            price,
            subtotal,
          });

          return acc;
        }, {});
      }

      const transformedOrders = rawOrders.map((order) => {
        const orderItems = itemsByOrderId[order.id] || [];
        const discountAmount = Number(order.discount_amount || 0);
        const totalAmount = Number(order.total_amount || 0);
        const createdAt = order.created_at || '';
        const orderDate = createdAt ? new Date(createdAt).toLocaleString() : 'N/A';
        const paymentProofPath = normalizeText(order.payment_proof_path);
        const paymentProofUrl = makePublicUrl(paymentProofPath);
        const itemCount = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const itemsSummary = orderItems.length
          ? orderItems.map((item) => `${item.name} x${item.quantity}`).join(', ')
          : 'No items';

        return {
          orderId: order.id,
          id: order.id,
          createdAt,
          updatedAt: order.updated_at || '',
          orderDate,
          customerName: normalizeText(order.customer_name, 'N/A'),
          phoneNumber: normalizeText(order.phone_number, 'N/A'),
          deliveryAddress: normalizeText(order.delivery_address, 'N/A'),
          specialInstructions: normalizeText(order.special_instructions, 'None'),
          paymentMethod: normalizePaymentMethod(order.payment_method),
          paymentStatus: normalizePaymentStatus(order.payment_status),
          paymentProofOption: normalizeText(order.payment_proof_option),
          paymentProofPath,
          paymentProofUrl,
          promoCode: normalizeText(order.promo_code),
          discountAmount,
          totalAmount,
          orderSource: normalizeSource(order.order_source),
          items: itemsSummary,
          itemsSummary,
          itemCount,
          orderItems,
          status: normalizeText(order.status, 'pending').toLowerCase(),
        };
      });

      setOrders(transformedOrders);
      return transformedOrders;
    } catch (err) {
      const message = err?.message || 'Failed to fetch orders.';
      setError(message);
      setOrders([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { orders, loading, error, fetchOrdersForExport };
};
