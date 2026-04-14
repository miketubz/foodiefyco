import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

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
        customer_name,
        phone_number,
        delivery_address,
        special_instructions,
        payment_method,
        promo_code,
        discount_amount,
        payment_status,
        payment_proof_url,
        order_source,
        order_items (
          quantity,
          price,
          menu_item:menu_item_id (
            name
          )
        )
      `);

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', `${filters.endDate}T23:59:59`);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
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

        const normalizedSource = (order.order_source || '').toString().trim().toLowerCase();

        return {
          orderId: order.id,
          customerName: order.customer_name || 'N/A',
          customer_name: order.customer_name || 'N/A',
          phoneNumber: order.phone_number || 'N/A',
          phone_number: order.phone_number || 'N/A',
          deliveryAddress: order.delivery_address || 'N/A',
          delivery_address: order.delivery_address || 'N/A',
          specialInstructions: order.special_instructions || '',
          special_instructions: order.special_instructions || '',
          paymentMethod: order.payment_method || 'COD',
          payment_method: order.payment_method || 'COD',
          promoCode: order.promo_code || null,
          promo_code: order.promo_code || null,
          discountAmount: Number(order.discount_amount || 0),
          discount_amount: Number(order.discount_amount || 0),
          paymentStatus: order.payment_status || 'unpaid',
          payment_status: order.payment_status || 'unpaid',
          payment_proof_url: order.payment_proof_url || null,
          order_source: normalizedSource || 'internal',
          orderDate: new Date(order.created_at).toLocaleString(),
          created_at: order.created_at,
          totalAmount: Number(order.total_amount || 0),
          total_amount: Number(order.total_amount || 0),
          itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          itemsSummary: orderItems
            .map((item) => `${item.name} x${item.quantity}`)
            .join(', '),
          items: orderItems
            .map((item) => `${item.name} x${item.quantity}`)
            .join(', '),
          orderItems,
          status: order.status || 'pending',
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
