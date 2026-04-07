import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import MenuCard from '../components/MenuCard'
import Cart from '../components/Cart'

function MenuPage({ setCartCount }) {
  const [menuItems, setMenuItems] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [orderSuccess, setOrderSuccess] = useState(false)

  useEffect(() => {
    fetchMenu()
  }, [])

  const fetchMenu = async () => {
    const { data, error } = await supabase
      .from('menu_item')
      .select('*')
      .eq('is_available', true)
      .order('name')

    if (error) {
      console.error('Error fetching menu:', error)
      return
    }

    setMenuItems(data || [])
  }

  const addToCart = (item) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { ...item, quantity: 1 }]
    })
    setCartCount(cartItems.length + 1)
  }

  const removeFromCart = (item) => {
    setCartItems(prev => prev.filter(i => i.id !== item.id))
    setCartCount(cartItems.length - 1)
  }

  const placeOrder = async () => {
    if (!customerName) return alert('Please enter your name!')
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const { data: order, error } = await supabase
      .from('orders')
      .insert([{ customer_name: customerName, total_amount: total, status: 'pending' }])
      .select()
      .single()

    if (error) {
      alert('Order failed!')
      console.error('Order error:', error)
      return
    }

    const orderItems = cartItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      price: item.price
    }))

    await supabase.from('order_items').insert(orderItems)
    setCartItems([])
    setShowCart(false)
    setOrderSuccess(true)
    setCartCount(0)
    setTimeout(() => setOrderSuccess(false), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {orderSuccess && (
        <div className="bg-green-500 text-white text-center py-3 font-semibold">
          ✅ Order placed successfully!
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Our Menu</h2>
        <div className="mb-6">
          <input
            type="text"
            placeholder="Enter your name to order..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-2 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuItems.map(item => (
            <MenuCard key={item.id} item={item} onAddToCart={addToCart} />
          ))}
        </div>
      </div>
      {showCart && (
        <Cart
          cartItems={cartItems}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onPlaceOrder={placeOrder}
        />
      )}
    </div>
  )
}

export default MenuPage