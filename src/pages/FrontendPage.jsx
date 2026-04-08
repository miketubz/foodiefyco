import { useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import MenuCard from '../components/MenuCard';
import Cart from '../components/Cart';
import { useMenuItems } from '../hooks/useMenuItems';
import { supabase } from '../lib/supabaseClient.js';

function FrontendPage() {
  const { menuItems, loading, error } = useMenuItems();
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');

  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddToCart = (item) => {
    setCartItems((prev) => {
      const existingItem = prev.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (itemToRemove) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === itemToRemove.id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || isSubmitting) return;

    setOrderError('');
    setOrderConfirmation(null);

    if (!customerName.trim()) {
      setOrderError('Please enter your name.');
      return;
    }

    if (!phoneNumber.trim()) {
      setOrderError('Please enter your phone number.');
      return;
    }

    if (!deliveryAddress.trim()) {
      setOrderError('Please enter your delivery address.');
      return;
    }

    if (!paymentMethod) {
      setOrderError('Please select a payment method.');
      return;
    }

    setIsSubmitting(true);

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    const { data: orderData, error: orderErrorResponse } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName.trim(),
          phone_number: phoneNumber.trim(),
          delivery_address: deliveryAddress.trim(),
          special_instructions: specialInstructions.trim(),
          payment_method: paymentMethod,
          total_amount: totalAmount,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (orderErrorResponse) {
      setOrderError(`Failed to place order: ${orderErrorResponse.message}`);
      setIsSubmitting(false);
      return;
    }

    const orderItemsPayload = cartItems.map((item) => ({
      order_id: orderData.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      price: Number(item.price),
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      setOrderError(
        `Order was created, but saving items failed: ${itemsError.message}`
      );
      setIsSubmitting(false);
      return;
    }

    setOrderConfirmation({
      orderId: orderData.id,
      name: customerName.trim(),
      phone: phoneNumber.trim(),
      address: deliveryAddress.trim(),
      specialInstructions: specialInstructions.trim(),
      paymentMethod,
      total: totalAmount,
      itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      items: cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        subtotal: Number(item.price) * item.quantity,
      })),
    });

    setCartItems([]);
    setIsCartOpen(false);
    setCustomerName('');
    setPhoneNumber('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setPaymentMethod('COD');
    setIsSubmitting(false);
  };

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />

      <main className="mx-auto max-w-7xl px-6 pb-10 pt-8">
        <section className="mb-8 rounded-[28px] bg-gradient-to-r from-orange-500 to-amber-400 px-8 py-10 text-white shadow-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-orange-100">
            Food delivered to your door
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight">
            Fresh comfort food for every craving.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-orange-50 sm:text-base">
            Choose from our best-selling dishes, place your order in minutes,
            and enjoy fast local delivery.
          </p>
        </section>

        {orderError && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
            {orderError}
          </div>
        )}

        {orderConfirmation && (
          <div className="mb-6 rounded-2xl border border-green-300 bg-green-50 p-5 text-green-900 shadow-sm">
            <h2 className="mb-2 text-xl font-bold">Order Confirmed</h2>
            <p className="mb-1">Order ID: {orderConfirmation.orderId}</p>
            <p className="mb-1">Name: {orderConfirmation.name}</p>
            <p className="mb-1">Phone: {orderConfirmation.phone}</p>
            <p className="mb-1">Address: {orderConfirmation.address}</p>
            <p className="mb-1">Payment Method: {orderConfirmation.paymentMethod}</p>
            <p className="mb-1">
              Special Instructions: {orderConfirmation.specialInstructions || 'None'}
            </p>
            <p className="mb-1">Items: {orderConfirmation.itemCount}</p>

            {orderConfirmation.items?.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 font-semibold">Ordered Items:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {orderConfirmation.items.map((item, index) => (
                    <li key={index}>
                      {item.name} — x{item.quantity} — ₱{item.subtotal.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mb-3 font-semibold">
              Total: ₱{orderConfirmation.total.toFixed(2)}
            </p>
            <button
              onClick={() => setOrderConfirmation(null)}
              className="rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Close
            </button>
          </div>
        )}

        <section className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Our Menu
            </p>
            <h2 className="text-3xl font-bold text-gray-900">Choose your favorites</h2>
          </div>
          {!loading && !error && (
            <p className="text-sm text-gray-500">{menuItems.length} available dishes today</p>
          )}
        </section>

        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                className="overflow-hidden rounded-3xl bg-white shadow-md"
              >
                <div className="h-56 animate-pulse bg-gray-200" />
                <div className="space-y-3 p-5">
                  <div className="h-6 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-5 w-1/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-12 animate-pulse rounded-2xl bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-300 bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>

      {isCartOpen && (
        <Cart
          cartItems={cartItems}
          onClose={() => setIsCartOpen(false)}
          onRemove={handleRemoveFromCart}
          onPlaceOrder={handlePlaceOrder}
          customerName={customerName}
          setCustomerName={setCustomerName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          specialInstructions={specialInstructions}
          setSpecialInstructions={setSpecialInstructions}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

export default FrontendPage;
