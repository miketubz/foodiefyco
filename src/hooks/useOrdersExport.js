import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const normalizeSource = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'website' || source === 'internal') return 'internal';
  if (source === 'external') return 'external';
  return source;
};

const getDateBounds = (startDate, endDate) => {
  let startIso;
  let endIsoExclusive;

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) startIso = start.toISOString();
  }

  if (endDate) {
    const end = new Date(`${endDate}T00:00:00`);
    if (!Number.isNaN(end.getTime())) {
      end.setDate(end.getDate() + 1);
      endIsoExclusive = end.toISOString();
    }
  }

  return { startIso, endIsoExclusive };
};

export const useOrdersExport = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrdersForExport = async (filters) => {
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

      const { startIso, endIsoExclusive } = getDateBounds(
        filters?.startDate,
        filters?.endDate
      );

      if (startIso) {
        query = query.gte('created_at', startIso);
      }

      if (endIsoExclusive) {
        query = query.lt('created_at', endIsoExclusive);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
        query = query.eq('payment_status', filters.paymentStatus);
      }

      if (filters?.orderSource && filters.orderSource !== 'all') {
        const source = normalizeSource(filters.orderSource);
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
          createdAt: order.created_at,
          customerName: order.customer_name || 'N/A',
          phoneNumber: order.phone_number || '',
          deliveryAddress: order.delivery_address || '',
          specialInstructions:
            order.special_instructions === null || order.special_instructions === undefined || String(order.special_instructions).trim() === ''
              ? 'None'
              : String(order.special_instructions).trim(),
          paymentMethod: order.payment_method || 'COD',
          paymentStatus: String(order.payment_status || 'unpaid').toLowerCase(),
          orderSource: normalizeSource(order.order_source),
          promoCode: order.promo_code || '',
          discountAmount: Number(order.discount_amount || 0),
          paymentProofOption: order.payment_proof_option || '',
          paymentProofPath,
          paymentProofUrl,
          orderDate: new Date(order.created_at).toLocaleString(),
          totalAmount: Number(order.total_amount || 0),
          itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          itemsSummary: orderItems.map((item) => `${item.name} x${item.quantity}`).join(', '),
          items: orderItems.map((item) => `${item.name} x${item.quantity}`).join(', '),
          orderItems,
          status: String(order.status || 'pending').toLowerCase(),
        };
      });

      setOrders(transformedOrders);
    } catch (err) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  return { orders, loading, error, fetchOrdersForExport };
};
