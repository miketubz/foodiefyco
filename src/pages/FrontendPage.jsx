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

  const [discountAmount, setDiscountAmount] = useState(0);

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

    setIsSubmitting(true);

    const normalizedPromo = promoCode.trim().toUpperCase();

    if (normalizedPromo) {
      const { data: promoResult, error: promoError } = await supabase.rpc(
        'validate_promo_code',
        {
          input_code: normalizedPromo,
          order_subtotal: subtotal,
        }
      );

      if (promoError) {
        setOrderError(`Promo code validation failed: ${promoError.message}`);
        setIsSubmitting(false);
        return;
      }

      if (!promoResult?.valid) {
        setOrderError(promoResult?.message || 'Promo code is invalid.');
        setIsSubmitting(false);
        return;
      }

      setDiscountAmount(Number(promoResult.discount_amount || 0));
    } else {
      setDiscountAmount(0);
    }

    const appliedDiscount = normalizedPromo
      ? Number(
          (
            await supabase.rpc('validate_promo_code', {
              input_code: normalizedPromo,
              order_subtotal: subtotal,
            })
          ).data?.discount_amount || 0
        )
      : 0;

    const totalAfterDiscount = Math.max(0, subtotal - appliedDiscount);

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
          discount_amount: appliedDiscount,
          total_amount: totalAfterDiscount,
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
      discountAmount: appliedDiscount,
      subtotal,
      total: totalAfterDiscount,
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
    setDiscountAmount(0);
    setIsSubmitting(false);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-gray-50">
      <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section
  className="relative mb-8 overflow-hidden rounded-[2rem] px-6 py-10 text-white shadow-lg sm:px-10 sm:py-14"
  style={{
    backgroundImage: "url('/pix/header.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
>
  <div className="absolute inset-0 bg-black/45" />

  <div className="relative z-10 mx-auto max-w-3xl text-center">
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-100">
      Food delivered to your door
    </p>
    <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
      Fresh comfort food for every craving.
    </h1>
    <p className="mt-4 text-sm text-orange-50 sm:text-base">
      Choose from our best-selling dishes, place your order in minutes,
      and enjoy fast local delivery.
    </p>

    <a
      href="https://www.facebook.com/foodiefyco/"
      target="_blank"
      rel="noreferrer"
      className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1877F2] shadow-sm transition hover:bg-orange-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
      >
        <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6h1.7V4.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H8v3h2.4v8h3.1Z" />
      </svg>
      Visit our Facebook page and win a Promo
    </a>
  </div>
</section>

<section className="mb-6 flex flex-col items-center justify-center gap-3 text-center">
  <div>
    <p className="mb-2 text-xl font-bold uppercase tracking-[0.35em] text-orange-500 sm:text-2xl">
      Our Menu
    </p>
    <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
      Choose your favorites
    </h2>
  </div>
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
            <p className="mb-1">
              Special Instructions: {orderConfirmation.specialInstructions || 'None'}
            </p>

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
            <p className="mb-1 text-green-700">
              Discount: -₱{orderConfirmation.discountAmount.toFixed(2)}
            </p>
            <p className="mb-3 font-semibold">Total: ₱{orderConfirmation.total.toFixed(2)}</p>
            <button
              onClick={() => setOrderConfirmation(null)}
              className="rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Close
            </button>
          </div>
        )}

        <section className="mb-6 flex flex-col items-center justify-center gap-3 text-center">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-orange-500 sm:text-base">
              Our Menu
            </p>
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Choose your favorites
            </h2>
          </div>
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