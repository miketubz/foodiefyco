import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const normalizeSourceValue = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'website' || source === 'internal') return 'internal';
  if (source === 'external') return 'external';
  return source;
};

const normalizeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const toIsoStart = (date) => new Date(`${date}T00:00:00`).toISOString();
const toIsoNextDay = (date) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
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
                menu_item:menu_item_id (
                  name
                )
              )
            `
          )
          .order('created_at', { ascending: false });

        if (startDate) {
          query = query.gte('created_at', toIsoStart(startDate));
        }

        if (endDate) {
          query = query.lt('created_at', toIsoNextDay(endDate));
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
        if (fetchError) throw fetchError;

        const normalizedOrders = (data || []).map((order) => {
          const orderItems = (order.order_items || []).map((item) => {
            const quantity = Number(item.quantity || 0);
            const price = Number(item.price || 0);
            return {
              id: item.id,
              name: normalizeText(item?.menu_item?.name, 'Unknown Item'),
              quantity,
              price,
              subtotal: quantity * price,
            };
          });

          const paymentProofPath = normalizeText(order.payment_proof_path, '');
          const paymentProofUrl = paymentProofPath
            ? supabase.storage.from('payment-proofs').getPublicUrl(paymentProofPath).data.publicUrl
            : '';

          return {
            orderId: order.id,
            id: order.id,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            orderDate: order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A',
            customerName: normalizeText(order.customer_name, 'N/A'),
            phoneNumber: normalizeText(order.phone_number, 'N/A'),
            deliveryAddress: normalizeText(order.delivery_address, 'N/A'),
            specialInstructions: normalizeText(order.special_instructions, 'None'),
            paymentMethod: normalizeText(order.payment_method, 'N/A'),
            paymentStatus: normalizeText(order.payment_status, 'unpaid').toLowerCase(),
            paymentProofOption: normalizeText(order.payment_proof_option, ''),
            paymentProofPath,
            paymentProofUrl,
            promoCode: normalizeText(order.promo_code, ''),
            discountAmount: Number(order.discount_amount || 0),
            totalAmount: Number(order.total_amount || 0),
            orderSource: normalizeSourceValue(order.order_source),
            orderItems,
            itemsSummary: orderItems.length
              ? orderItems.map((item) => `${item.name} x${item.quantity}`).join(', ')
              : 'No items',
            itemCount: orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
            status: normalizeText(order.status, 'pending').toLowerCase(),
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
