import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function useMenuItems() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchMenuItems = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('menu_item')
        .select('*')
        .eq('available', true)
        .or('external_only.is.null,external_only.eq.false')
        .order('sort_order', { ascending: true, nullsFirst: true })
        .order('id', { ascending: true });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setMenuItems([]);
      } else {
        setMenuItems(data || []);
      }

      setLoading(false);
    };

    fetchMenuItems();

    return () => {
      active = false;
    };
  }, []);

  return { menuItems, loading, error };
}
