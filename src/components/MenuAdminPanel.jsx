import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

export default function MenuAdminPanel() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
    sort_order: 0,
    is_available: true,
  });

  const fetchMenuItems = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const { data, error } = await supabase
      .from('menu_item')
      .select(
        'id, name, description, price, category, image_url, is_available, sort_order'
      )
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleNewItemChange = (field, value) => {
    setNewItem((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    setError('');
    setMessage('');

    if (!newItem.name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!newItem.price) {
      setError('Price is required.');
      return;
    }

    setCreating(true);

    const { error } = await supabase.from('menu_item').insert([
      {
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        price: Number(newItem.price),
        category: newItem.category.trim(),
        image_url: newItem.image_url.trim(),
        sort_order: Number(newItem.sort_order) || 0,
        is_available: newItem.is_available,
      },
    ]);

    if (error) {
      setError(error.message);
    } else {
      setMessage('New menu item added.');
      setNewItem({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
        sort_order: 0,
        is_available: true,
      });
      await fetchMenuItems();
    }

    setCreating(false);
  };

  const handleSave = async (item) => {
    setSavingId(item.id);
    setError('');
    setMessage('');

    const { error } = await supabase
      .from('menu_item')
      .update({
        name: item.name,
        description: item.description || '',
        price: Number(item.price),
        category: item.category,
        image_url: item.image_url,
        sort_order: Number(item.sort_order) || 0,
        is_available: item.is_available,
      })
      .eq('id', item.id);

    if (error) {
      setError(`Item ${item.id}: ${error.message}`);
    } else {
      setMessage(`Item ${item.id} saved successfully.`);
      await fetchMenuItems();
    }

    setSavingId(null);
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Delete this menu item?');
    if (!confirmed) return;

    setDeletingId(id);
    setError('');
    setMessage('');

    const { error } = await supabase
      .from('menu_item')
      .delete()
      .eq('id', id);

    if (error) {
      setError(`Item ${id}: ${error.message}`);
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMessage(`Item ${id} deleted successfully.`);
    }

    setDeletingId(null);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      return;
    }

    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Menu Admin Panel</h1>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100"
            >
              Storefront
            </Link>
            <Link
              to="/admin"
              className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100"
            >
              Orders
            </Link>
            <Link
              to="/admin/menu"
              className="rounded-md bg-gray-900 px-4 py-2 text-white"
            >
              Menu
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Add Menu Item</h2>
            <p className="text-sm text-gray-500">Lower sort order shows first.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <input
              type="text"
              placeholder="Name"
              value={newItem.name}
              onChange={(e) => handleNewItemChange('name', e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />

            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={newItem.price}
              onChange={(e) => handleNewItemChange('price', e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />

            <input
              type="text"
              placeholder="Category"
              value={newItem.category}
              onChange={(e) => handleNewItemChange('category', e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />

            <input
              type="text"
              placeholder="Image URL"
              value={newItem.image_url}
              onChange={(e) => handleNewItemChange('image_url', e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />

            <input
              type="number"
              placeholder="Sort Order"
              value={newItem.sort_order}
              onChange={(e) => handleNewItemChange('sort_order', e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />

            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              {creating ? 'Adding...' : 'Add Item'}
            </button>
          </div>

          <textarea
            placeholder="Description"
            value={newItem.description}
            onChange={(e) => handleNewItemChange('description', e.target.value)}
            className="mt-4 min-h-[96px] w-full rounded-md border border-gray-300 px-3 py-2"
          />

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={newItem.is_available}
              onChange={(e) => handleNewItemChange('is_available', e.target.checked)}
              className="h-4 w-4"
            />
            Available
          </label>

          {newItem.image_url ? (
            <div className="mt-4">
              <p className="mb-2 text-sm text-gray-600">Preview</p>
              <img
                src={newItem.image_url}
                alt={newItem.name || 'New menu item'}
                className="h-24 w-24 rounded-lg border border-gray-200 object-cover"
              />
            </div>
          ) : null}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg border border-green-300 bg-green-100 px-4 py-3 text-green-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg bg-white p-6 shadow">Loading menu items...</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl bg-white shadow lg:block">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Image URL</th>
                    <th className="px-4 py-3 text-center">Preview</th>
                    <th className="px-4 py-3 text-center">Sort Order</th>
                    <th className="px-4 py-3 text-center">Available</th>
                    <th className="px-4 py-3 text-center">Save</th>
                    <th className="px-4 py-3 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="px-4 py-3">{item.id}</td>

                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.name || ''}
                          onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <textarea
                          value={item.description || ''}
                          onChange={(e) => handleChange(item.id, 'description', e.target.value)}
                          className="min-h-[96px] w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.price ?? ''}
                          onChange={(e) => handleChange(item.id, 'price', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.category || ''}
                          onChange={(e) => handleChange(item.id, 'category', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.image_url || ''}
                          onChange={(e) => handleChange(item.id, 'image_url', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </td>

                      <td className="px-4 py-3 text-center">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="mx-auto h-14 w-14 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="text-gray-400">No image</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={item.sort_order ?? 0}
                          onChange={(e) => handleChange(item.id, 'sort_order', e.target.value)}
                          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-center"
                        />
                      </td>

                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!item.is_available}
                          onChange={(e) =>
                            handleChange(item.id, 'is_available', e.target.checked)
                          }
                          className="h-4 w-4"
                        />
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSave(item)}
                          disabled={savingId === item.id}
                          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {savingId === item.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 lg:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl bg-white p-4 shadow">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Item #{item.id}
                      </p>
                      <p className="text-sm text-gray-500">Mobile edit view</p>
                    </div>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={item.name || ''}
                      onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.price ?? ''}
                      onChange={(e) => handleChange(item.id, 'price', e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Price"
                    />
                    <input
                      type="text"
                      value={item.category || ''}
                      onChange={(e) => handleChange(item.id, 'category', e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Category"
                    />
                    <input
                      type="number"
                      value={item.sort_order ?? 0}
                      onChange={(e) => handleChange(item.id, 'sort_order', e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Sort Order"
                    />
                    <input
                      type="text"
                      value={item.image_url || ''}
                      onChange={(e) => handleChange(item.id, 'image_url', e.target.value)}
                      className="sm:col-span-2 rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Image URL"
                    />
                    <textarea
                      value={item.description || ''}
                      onChange={(e) => handleChange(item.id, 'description', e.target.value)}
                      className="sm:col-span-2 min-h-[96px] rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Description"
                    />
                  </div>

                  <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!item.is_available}
                      onChange={(e) => handleChange(item.id, 'is_available', e.target.checked)}
                      className="h-4 w-4"
                    />
                    Available
                  </label>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => handleSave(item)}
                      disabled={savingId === item.id}
                      className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {savingId === item.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="w-full rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-gray-400"
                    >
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
