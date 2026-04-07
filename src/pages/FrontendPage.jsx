import { useState } from 'react';
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

    if (!paymentMethod.trim()) {
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

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-gray-50 text-gray-900">
      <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-10 overflow-hidden rounded-[2rem] bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-8 py-10 text-white shadow-xl">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-orange-100">
              Food delivered to your door
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Fresh comfort food for every craving.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-orange-50 sm:text-base">
              Choose from our best-selling dishes, place your order in minutes,
              and enjoy fast local delivery.
            </p>
          </div>
        </section>

        {orderError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
            {orderError}
          </div>
        )}

        {orderConfirmation && (
          <div className="mb-8 rounded-3xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
                  Order confirmed
                </p>
                <h2 className="mt-1 text-2xl font-bold text-green-900">
                  Thanks, {orderConfirmation.name}!
                </h2>
                <p className="mt-2 text-sm text-green-800">
                  Your order has been placed successfully.
                </p>
              </div>
              <button
                onClick={() => setOrderConfirmation(null)}
                className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-green-100">
                <p className="mb-2 text-sm text-gray-500">Order details</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><span className="font-semibold">Order ID:</span> {orderConfirmation.orderId}</p>
                  <p><span className="font-semibold">Phone:</span> {orderConfirmation.phone}</p>
                  <p><span className="font-semibold">Address:</span> {orderConfirmation.address}</p>
                  <p><span className="font-semibold">Payment:</span> {orderConfirmation.paymentMethod}</p>
                  <p><span className="font-semibold">Items:</span> {orderConfirmation.itemCount}</p>
                  {orderConfirmation.specialInstructions && (
                    <p>
                      <span className="font-semibold">Special Instructions:</span>{' '}
                      {orderConfirmation.specialInstructions}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-green-100">
                <p className="mb-2 text-sm text-gray-500">Ordered items</p>
                <div className="space-y-2 text-sm text-gray-700">
                  {orderConfirmation.items.map((item, index) => (
                    <div key={index} className="flex items-start justify-between gap-4 border-b border-gray-100 pb-2">
                      <p>{item.name} × {item.quantity}</p>
                      <p className="font-semibold">₱{item.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-right text-lg font-bold text-green-900">
                  Total: ₱{orderConfirmation.total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">
              Our menu
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Choose your favorites
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            {menuItems.length} available dishes today
          </p>
        </section>

        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <div className="aspect-[4/3] animate-pulse bg-gray-200" />
                <div className="space-y-3 p-5">
                  <div className="h-6 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                  <div className="h-10 animate-pulse rounded-2xl bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
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
