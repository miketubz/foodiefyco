import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const normalizeSourceValue = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'website' || source === 'internal') return 'internal';
  if (source === 'external') return 'external';
  return source;
};

const toIsoStart = (date) => new Date(`${date}T00:00:00`).toISOString();
const toIsoNextDay = (date) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

export const useOrdersExport = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrdersForExport = async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('orders').select(`
        id,
        created_at,
        total_amount,
        status,
        payment_status,
        promo_code,
        discount_amount,
        order_source,
        payment_proof_option,
        payment_proof_path,
        customer_name,
        phone_number,
        delivery_address,
        special_instructions,
        payment_method,
        order_items (
          quantity,
          price,
          menu_item:menu_item_id (
            name
          )
        )
      `);

      if (filters.startDate) {
        query = query.gte('created_at', toIsoStart(filters.startDate));
      }

      if (filters.endDate) {
        query = query.lt('created_at', toIsoNextDay(filters.endDate));
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.paymentStatus && filters.paymentStatus !== 'all') {
        query = query.eq('payment_status', filters.paymentStatus);
      }

      if (filters.orderSource && filters.orderSource !== 'all') {
        const source = normalizeSourceValue(filters.orderSource);
        if (source === 'external') {
          query = query.eq('order_source', 'external');
        } else {
          query = query.or('order_source.is.null,order_source.eq.internal,order_source.eq.website');
        }
      }

      const { data, error: fetchError } = await query.order('created_at', {
        ascending: false,
      });

      if (fetchError) throw fetchError;

      const transformedOrders = (data || []).map((order) => {
        const orderItems = (order.order_items || []).map((item) => ({
          name: item.menu_item?.name || 'Unknown Item',
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
          subtotal: Number(item.price || 0) * Number(item.quantity || 0),
        }));

        const paymentProofPath = order.payment_proof_path || '';
        const paymentProofUrl = paymentProofPath
          ? supabase.storage.from('payment-proofs').getPublicUrl(paymentProofPath).data.publicUrl
          : '';

        return {
          orderId: order.id,
          id: order.id,
          createdAt: order.created_at,
          customerName: order.customer_name || 'N/A',
          phoneNumber: order.phone_number || 'N/A',
          deliveryAddress: order.delivery_address || 'N/A',
          specialInstructions: order.special_instructions || '',
          paymentMethod: order.payment_method || 'N/A',
          paymentStatus: String(order.payment_status || 'unpaid').toLowerCase(),
          orderSource: normalizeSourceValue(order.order_source),
          promoCode: order.promo_code || '',
          discountAmount: Number(order.discount_amount || 0),
          paymentProofOption: order.payment_proof_option || '',
          paymentProofPath,
          paymentProofUrl,
          orderDate: order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A',
          totalAmount: Number(order.total_amount || 0),
          itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          itemsSummary: orderItems.length
            ? orderItems.map((item) => `${item.name} x${item.quantity}`).join(', ')
            : 'No items',
          items: orderItems.map((item) => `${item.name} x${item.quantity}`).join(', '),
          orderItems,
          status: String(order.status || 'pending').toLowerCase(),
        };
      });

      setOrders(transformedOrders);
      return transformedOrders;
    } catch (err) {
      setError(err.message || 'Failed to fetch orders');
      setOrders([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { orders, loading, error, fetchOrdersForExport };
};
