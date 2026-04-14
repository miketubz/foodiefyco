import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const initialMenuForm = {
  name: '',
  description: '',
  price: '',
  seller_price: '',
  category: '',
  image_url: '',
  sort_order: '',
  is_active: true,
  external_only: false,
};

function MenuAdminPanel() {
  const [menuItems, setMenuItems] = useState([]);
  const [newItem, setNewItem] = useState(initialMenuForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMenuItems = async () => {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      setError(`Failed to load menu items: ${error.message}`);
      setMenuItems([]);
      setLoading(false);
      return;
    }

    setMenuItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return menuItems;

    return menuItems.filter((item) => {
      const combined = [
        item.name,
        item.description,
        item.category,
        item.external_only ? 'external only' : 'front store',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return combined.includes(term);
    });
  }, [menuItems, searchTerm]);

  const clearForm = () => {
    setNewItem(initialMenuForm);
    setEditingId(null);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;

    setNewItem((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setSuccessMessage('');
    setError('');
    setNewItem({
      name: item.name || '',
      description: item.description || '',
      price: item.price ?? '',
      seller_price: item.seller_price ?? '',
      category: item.category || '',
      image_url: item.image_url || '',
      sort_order: item.sort_order ?? '',
      is_active: Boolean(item.is_active),
      external_only: Boolean(item.external_only),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMessage('');

    if (!newItem.name.trim()) {
      setError('Menu item name is required.');
      setSaving(false);
      return;
    }

    if (newItem.price === '' || Number.isNaN(Number(newItem.price))) {
      setError('Regular price is required.');
      setSaving(false);
      return;
    }

    const payload = {
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      price: Number(newItem.price),
      seller_price:
        newItem.seller_price === '' || Number.isNaN(Number(newItem.seller_price))
          ? null
          : Number(newItem.seller_price),
      category: newItem.category.trim(),
      image_url: newItem.image_url.trim(),
      sort_order:
        newItem.sort_order === '' || Number.isNaN(Number(newItem.sort_order))
          ? 0
          : Number(newItem.sort_order),
      is_active: Boolean(newItem.is_active),
      external_only: Boolean(newItem.external_only),
    };

    let response;

    if (editingId) {
      response = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', editingId);
    } else {
      response = await supabase.from('menu_items').insert([payload]);
    }

    if (response.error) {
      setError(`Failed to save menu item: ${response.error.message}`);
      setSaving(false);
      return;
    }

    setSuccessMessage(editingId ? 'Menu item updated successfully.' : 'Menu item added successfully.');
    clearForm();
    setSaving(false);
    await fetchMenuItems();
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Delete this menu item?');
    if (!confirmed) return;

    setError('');
    setSuccessMessage('');

    const { error } = await supabase.from('menu_items').delete().eq('id', id);

    if (error) {
      setError(`Failed to delete item: ${error.message}`);
      return;
    }

    setSuccessMessage('Menu item deleted successfully.');
    await fetchMenuItems();
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-500">
              FoodiefyCo Admin
            </p>
            <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
            <p className="mt-2 text-sm text-gray-500">
              Add items for the public store, the external seller page, or both.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => (window.location.href = '/admin')}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Orders
            </button>
            <button
              onClick={() => (window.location.href = '/admin/external')}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
            >
              External Orders
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Front Store
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {editingId ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Name</label>
                <input
                  type="text"
                  name="name"
                  value={newItem.name}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="Chicken Biryani"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={newItem.description}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  rows="3"
                  placeholder="Short item description"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Regular Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="price"
                    value={newItem.price}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Seller Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="seller_price"
                    value={newItem.seller_price}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    placeholder="Optional"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Used on the external order page. Leave blank to use the regular price.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Category</label>
                  <input
                    type="text"
                    name="category"
                    value={newItem.category}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    placeholder="Meals"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="sort_order"
                    value={newItem.sort_order}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Image URL</label>
                <input
                  type="text"
                  name="image_url"
                  value={newItem.image_url}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={Boolean(newItem.is_active)}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500"
                  />
                  <span>
                    <span className="block font-semibold text-gray-900">Active menu item</span>
                    <span className="text-xs text-gray-500">Turn this off to hide the item everywhere.</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="external_only"
                    checked={Boolean(newItem.external_only)}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500"
                  />
                  <span>
                    <span className="block font-semibold text-gray-900">Post on external page only</span>
                    <span className="text-xs text-gray-500">
                      Hides this item from the public front store and shows it only on /admin/external.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
                </button>

                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Menu Items</h2>
                <p className="text-sm text-gray-500">Search and manage your current menu.</p>
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 sm:max-w-sm"
                placeholder="Search name, category, external only..."
              />
            </div>

            {loading ? (
              <p className="text-gray-500">Loading menu items...</p>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center text-gray-500">
                No menu items found.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 p-4 transition hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {item.is_active ? 'Active' : 'Hidden'}
                          </span>

                          {item.external_only && (
                            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                              External only
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                          <span>Regular: ₱{Number(item.price || 0).toFixed(2)}</span>
                          <span>
                            Seller:{' '}
                            {item.seller_price === null || item.seller_price === undefined || item.seller_price === ''
                              ? 'Uses regular price'
                              : `₱${Number(item.seller_price).toFixed(2)}`}
                          </span>
                          {item.category && <span>Category: {item.category}</span>}
                          <span>Sort: {item.sort_order ?? 0}</span>
                        </div>

                        {item.description && (
                          <p className="mt-3 text-sm text-gray-600">{item.description}</p>
                        )}

                        {item.image_url && (
                          <p className="mt-2 truncate text-xs text-gray-400">{item.image_url}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuAdminPanel;
