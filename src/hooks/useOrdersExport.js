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

export function useOrdersExport() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrdersForExport = useCallback(
    async ({ startDate, endDate, status, paymentStatus, orderSource } = {}) => {
      setLoading(true);
      setError('');

      try {
        let query = supabase
          .from('orders')
          .select(
            `
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
              order_source,
              order_items (
                id,
                quantity,
                price,
                menu_item:name
              )
            `
          )
          .order('created_at', { ascending: false });

        if (startDate) {
          query = query.gte('created_at', `${startDate}T00:00:00`);
        }

        if (endDate) {
          query = query.lte('created_at', `${endDate}T23:59:59.999`);
        }

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }

        if (paymentStatus && paymentStatus !== 'all') {
          query = query.eq('payment_status', paymentStatus);
        }

        if (orderSource && orderSource !== 'all') {
          const normalizedSource = normalizeSourceValue(orderSource);
          if (normalizedSource === 'external') {
            query = query.eq('order_source', 'external');
          } else {
            query = query.or('order_source.is.null,order_source.eq.internal,order_source.eq.website');
          }
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        const normalizedOrders = (data || []).map((order) => {
          const items = (order.order_items || []).map((item) => ({
            name: normalizeText(item.menu_item, 'Item'),
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
          }));

          return {
            id: order.id,
            customerName: normalizeText(order.customer_name),
            phoneNumber: normalizeText(order.phone_number),
            deliveryAddress: normalizeText(order.delivery_address),
            specialInstructions: normalizeText(order.special_instructions),
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
            items,
          };
        });

        setOrders(normalizedOrders);
        return normalizedOrders;
      } catch (err) {
        const message = err?.message || 'Failed to fetch orders.';
        setError(message);
        setOrders([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    orders,
    loading,
    error,
    fetchOrdersForExport,
  };
}
