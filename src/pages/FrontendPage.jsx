import { useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import MenuCard from '../components/MenuCard';
import Cart from '../components/Cart';
import { useMenuItems } from '../hooks/useMenuItems';
import { supabase } from '../lib/supabaseClient.js';

const PROMO_RULES = {
  SAVE10: { type: 'percent', value: 10 },
  LESS50: { type: 'fixed', value: 50 },
  FOODIE15: { type: 'percent', value: 15 },
};

function FrontendPage() {
  const { menuItems, loading, error } = useMenuItems();
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [promoCode, setPromoCode] = useState('');

  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      ),
    [cartItems]
  );

  const discountAmount = useMemo(() => {
    const normalizedPromo = promoCode.trim().toUpperCase();
    const rule = PROMO_RULES[normalizedPromo];

    if (!rule) return 0;

    if (rule.type === 'percent') {
      return Number((subtotal * (rule.value / 100)).toFixed(2));
    }

    if (rule.type === 'fixed') {
      return Math.min(subtotal, Number(rule.value));
    }

    return 0;
  }, [promoCode, subtotal]);

  const finalTotal = useMemo(
    () => Math.max(0, Number(subtotal) - Number(discountAmount || 0)),
    [subtotal, discountAmount]
  );

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

    const normalizedPromo = promoCode.trim().toUpperCase();
    if (normalizedPromo && !PROMO_RULES[normalizedPromo]) {
      setOrderError('Promo code is invalid.');
      return;
    }

    setIsSubmitting(true);

    const { data: orderData, error: orderErrorResponse } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName.trim(),
          phone_number: phoneNumber.trim(),
          delivery_address: deliveryAddress.trim(),
          special_instructions: specialInstructions.trim(),
          payment_method: paymentMethod,
          promo_code: normalizedPromo || null,
          discount_amount: discountAmount,
          total_amount: finalTotal,
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
      promoCode: normalizedPromo || 'None',
      discountAmount,
      subtotal,
      total: finalTotal,
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
    setPromoCode('');
    setIsSubmitting(false);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-gray-50">
      <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-8 text-white shadow-lg sm:px-10 sm:py-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-100">
            Food delivered to your door
          </p>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Fresh comfort food for every craving.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-orange-50 sm:text-base">
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
          <div className="mb-6 rounded-3xl border border-green-200 bg-green-50 p-5 text-green-900 shadow-sm">
            <h2 className="mb-2 text-xl font-bold">Order Confirmed</h2>
            <p className="mb-1">Order ID: {orderConfirmation.orderId}</p>
            <p className="mb-1">Name: {orderConfirmation.name}</p>
            <p className="mb-1">Phone: {orderConfirmation.phone}</p>
            <p className="mb-1">Address: {orderConfirmation.address}</p>
            <p className="mb-1">Payment Method: {orderConfirmation.paymentMethod}</p>
            <p className="mb-1">Promo Code: {orderConfirmation.promoCode}</p>
            <p className="mb-1">Items: {orderConfirmation.itemCount}</p>
            <p className="mb-1">Special Instructions: {orderConfirmation.specialInstructions || 'None'}</p>

            {orderConfirmation.items && (
              <div className="mb-3 mt-3">
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

            <p className="mb-1">Subtotal: ₱{orderConfirmation.subtotal.toFixed(2)}</p>
            <p className="mb-1 text-green-700">Discount: -₱{orderConfirmation.discountAmount.toFixed(2)}</p>
            <p className="mb-3 font-semibold">Total: ₱{orderConfirmation.total.toFixed(2)}</p>
            <button
              onClick={() => setOrderConfirmation(null)}
              className="rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Close
            </button>
          </div>
        )}

        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Our Menu
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Choose your favorites
            </h2>
          </div>
          {!loading && !error && (
            <p className="text-sm text-gray-500">{menuItems.length} available dishes today</p>
          )}
        </section>

        {loading && <p className="text-gray-600">Loading menu...</p>}

        {error && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          discountAmount={discountAmount}
          subtotal={subtotal}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

export default FrontendPage;
