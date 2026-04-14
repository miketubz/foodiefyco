import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export function useMenuItems(options = {}) {
  const { externalView = false } = options;
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchMenuItems = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message || 'Failed to load menu items.');
        setMenuItems([]);
        setLoading(false);
        return;
      }

      const normalizedItems = (data || [])
        .filter((item) => (externalView ? true : !item.external_only))
        .map((item) => {
          const regularPrice = Number(item.price || 0);
          const sellerPrice = item.seller_price === null || item.seller_price === undefined || item.seller_price === ''
            ? null
            : Number(item.seller_price);

          return {
            ...item,
            regular_price: regularPrice,
            seller_price: sellerPrice,
            price: externalView && sellerPrice !== null ? sellerPrice : regularPrice,
          };
        });

      setMenuItems(normalizedItems);
      setLoading(false);
    };

    fetchMenuItems();

    return () => {
      isMounted = false;
    };
  }, [externalView]);

  return {
    menuItems,
    loading,
    error,
  };
}
