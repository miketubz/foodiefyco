import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function AdminPage() {
  const [password, setPassword] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [menuItems, setMenuItems] = useState([])
  const [editingItem, setEditingItem] = useState(null)

  useEffect(() => {
    if (isLoggedIn) {
      fetchMenu()
    }
  }, [isLoggedIn])

  const fetchMenu = async () => {
    const { data, error } = await supabase
      .from('menu_item')
      .select('*')
      .order('name')
    if (!error) setMenuItems(data)
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === 'admin123') { // Simple password for now
      setIsLoggedIn(true)
    } else {
      alert('Wrong password!')
    }
  }

  const handleUpdate = async (id, updates) => {
    const { error } = await supabase
      .from('menu_item')
      .update(updates)
      .eq('id', id)
    if (!error) {
      setMenuItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
      setEditingItem(null)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      const { error } = await supabase
        .from('menu_item')
        .delete()
        .eq('id', id)
      if (!error) {
        setMenuItems(prev => prev.filter(item => item.id !== id))
      }
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4">Admin Login</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="border border-gray-300 rounded-xl px-4 py-2 w-full mb-4 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            type="submit"
            className="w-full bg-orange-500 text-white py-2 rounded-xl hover:bg-orange-600 transition font-semibold"
          >
            Login
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Admin Panel</h2>
        <div className="grid grid-cols-1 gap-6">
          {menuItems.map(item => (
            <div key={item.id} className="bg-white rounded-xl shadow-md p-4">
              {editingItem?.id === item.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleUpdate(item.id, {
                      name: e.target.name.value,
                      price: parseFloat(e.target.price.value),
                      category: e.target.category.value,
                      is_available: e.target.is_available.checked
                    })
                  }}
                  className="space-y-3"
                >
                  <input
                    name="name"
                    defaultValue={item.name}
                    className="border border-gray-300 rounded-xl px-4 py-2 w-full"
                  />
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    defaultValue={item.price}
                    className="border border-gray-300 rounded-xl px-4 py-2 w-full"
                  />
                  <input
                    name="category"
                    defaultValue={item.category}
                    className="border border-gray-300 rounded-xl px-4 py-2 w-full"
                  />
                  <label className="flex items-center">
                    <input
                      name="is_available"
                      type="checkbox"
                      defaultChecked={item.is_available}
                      className="mr-2"
                    />
                    Available
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      className="bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.category}</p>
                    <p className="text-orange-500 font-bold">₱{item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="bg-blue-500 text-white px-3 py-1 rounded-xl hover:bg-blue-600 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-xl hover:bg-red-600 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminPage
