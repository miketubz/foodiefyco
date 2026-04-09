import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export const useMenuItems = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('menu_item')
          .select(
            'id, name, description, price, category, image_url, is_available, sort_order'
          )
          .eq('is_available', true)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true });

        if (error) throw error;

        setMenuItems(data || []);
      } catch (err) {
        console.error('Error fetching menu items:', err);
        setError(err.message || 'Failed to load menu items');
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, []);

  return { menuItems, loading, error };
};
