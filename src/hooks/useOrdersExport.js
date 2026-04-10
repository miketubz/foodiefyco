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
      let query = supabase
        .from('orders')
        .select(`
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

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error: fetchError } = await query.order('created_at', {
        ascending: false,
      });

      if (fetchError) throw fetchError;

      const transformedOrders = (data || []).map((order) => {
        const orderItems = (order.order_items || []).map((item) => ({
          name: item.menu_item?.name || 'Menu Item',
          quantity: Number(item.quantity || 0),
          subtotal: Number(item.price || 0) * Number(item.quantity || 0),
        }));

        return {
          orderId: order.id,
          customerName: order.customer_name || 'N/A',
          phoneNumber: order.phone_number || 'N/A',
          deliveryAddress: order.delivery_address || 'N/A',
          specialInstructions: order.special_instructions || '',
          paymentMethod: order.payment_method || '',
          promoCode: order.promo_code || '',
          discountAmount: Number(order.discount_amount || 0),
          orderDate: new Date(order.created_at).toLocaleString(),
          totalAmount: Number(order.total_amount || 0),
          itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          itemsSummary: orderItems.map((item) => `${item.name} x${item.quantity}`).join(', '),
          orderItems,
          status: order.status || 'N/A',
        };
      });

      setOrders(transformedOrders);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  return { orders, loading, error, fetchOrdersForExport };
};
