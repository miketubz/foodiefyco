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
          order_items (
            quantity,
            menu_item:menu_item_id (
              name
            )
          )
        `);

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error: fetchError } = await query.order('created_at', {
        ascending: false,
      });

      if (fetchError) throw fetchError;

      const transformedOrders = (data || []).map((order) => {
        const orderItems = order.order_items || [];

        const items = orderItems
          .map((item) => `${item.menu_item?.name || 'Item'} x${item.quantity}`)
          .join(', ');

        const itemCount = orderItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        );

        return {
          orderId: order.id,
          customerName: order.customer_name || 'N/A',
          phoneNumber: order.phone_number || 'N/A',
          deliveryAddress: order.delivery_address || 'N/A',
          specialInstructions: order.special_instructions?.trim() || 'N/A',
          orderDate: new Date(order.created_at).toLocaleString(),
          totalAmount: order.total_amount || 0,
          itemCount,
          items: items || 'No items',
          status: order.status || 'N/A',
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
