import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export function useOrdersExport() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrdersForExport = async ({ startDate, endDate, status } = {}) => {
    setLoading(true);
    setError('');

    let query = supabase
      .from('orders')
      .select(`
        id,
        created_at,
        customer_name,
        phone_number,
        delivery_address,
        special_instructions,
        payment_method,
        promo_code,
        discount_amount,
        total_amount,
        status,
        order_items (
          quantity,
          price,
          menu_item:menu_item_id (
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
      setOrders([]);
      setLoading(false);
      return;
    }

    const mappedOrders = (data || []).map((order) => {
      const mappedItems = (order.order_items || []).map((item) => ({
        name: item.menu_item?.name || 'Item',
        quantity: Number(item.quantity || 0),
        subtotal: Number(item.price || 0) * Number(item.quantity || 0),
      }));

      return {
        orderId: order.id,
        orderDate: new Date(order.created_at).toLocaleString(),
        customerName: order.customer_name || 'N/A',
        phoneNumber: order.phone_number || 'N/A',
        deliveryAddress: order.delivery_address || 'N/A',
        specialInstructions: order.special_instructions || '',
        paymentMethod: order.payment_method || 'N/A',
        promoCode: order.promo_code || '',
        discountAmount: Number(order.discount_amount || 0),
        totalAmount: Number(order.total_amount || 0),
        status: order.status || 'pending',
        itemCount: mappedItems.reduce((sum, item) => sum + item.quantity, 0),
        itemsSummary: mappedItems
          .map((item) => `${item.name} x${item.quantity}`)
          .join(', '),
        orderItems: mappedItems,
      };
    });

    setOrders(mappedOrders);
    setLoading(false);
  };

  return {
    orders,
    loading,
    error,
    fetchOrdersForExport,
  };
}
