import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useMenuItems } from '../hooks/useMenuItems';

const paymentMethods = ['COD', 'GCASH', 'GOtyme', 'UnionBank'];

function AdminExternalPage() {
  const { menuItems, loading, error } = useMenuItems({ externalView: true });
  const [cartItems, setCartItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cartItems]
  );

  const total = useMemo(
    () => Math.max(0, Number(subtotal) - Number(discountAmount || 0)),
    [subtotal, discountAmount]
  );

  const addToCart = (item) => {
    setCartItems((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);

      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: Number(item.price),
          regular_price: Number(item.regular_price ?? item.price),
          seller_price:
            item.seller_price === null || item.seller_price === undefined
              ? null
              : Number(item.seller_price),
          quantity: 1,
          external_only: Boolean(item.external_only),
        },
      ];
    });
  };

  const removeFromCart = (itemId) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const validatePromoCode = async (normalizedPromo) => {
    if (!normalizedPromo) {
      return { valid: true, discount_amount: 0 };
    }

    const { data, error } = await supabase.rpc('validate_promo_code', {
      input_code: normalizedPromo,
      order_subtotal: subtotal,
    });

    if (error) {
      throw new Error(error.message || 'Promo validation failed.');
    }

    return data;
  };

  const resetForm = () => {
    setCartItems([]);
    setCustomerName('');
    setPhoneNumber('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setPaymentMethod('COD');
    setPromoCode('');
    setDiscountAmount(0);
  };

  const handlePlaceExternalOrder = async () => {
    if (cartItems.length === 0 || isSubmitting) return;

    setFormError('');
    setSuccessMessage('');

    if (!customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    if (!phoneNumber.trim()) {
      setFormError('Phone number is required.');
      return;
    }

    if (!deliveryAddress.trim()) {
      setFormError('Delivery address is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedPromo = promoCode.trim().toUpperCase();
      const promoResult = await validatePromoCode(normalizedPromo);

      if (!promoResult?.valid) {
        setFormError(promoResult?.message || 'Promo code is invalid.');
        setIsSubmitting(false);
        return;
      }

      const appliedDiscount = Number(promoResult?.discount_amount || 0);
      const totalAfterDiscount = Math.max(0, subtotal - appliedDiscount);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: customerName.trim(),
            phone_number: phoneNumber.trim(),
            delivery_address: deliveryAddress.trim(),
            special_instructions: specialInstructions.trim(),
            payment_method: paymentMethod,
            payment_status: 'unpaid',
            promo_code: normalizedPromo || null,
            discount_amount: appliedDiscount,
            total_amount: totalAfterDiscount,
            status: 'pending',
            order_source: 'external',
          },
        ])
        .select()
        .single();

      if (orderError) {
        setFormError(`Failed to create order: ${orderError.message}`);
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
        setFormError(`Order saved, but items failed: ${itemsError.message}`);
        setIsSubmitting(false);
        return;
      }

      setDiscountAmount(appliedDiscount);
      setSuccessMessage(
        `External order created successfully. Order ID: ${orderData.id}`
      );
      resetForm();
    } catch (err) {
      setFormError(err.message || 'Something went wrong while creating the order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-orange-500">
                Admin Only
              </p>
              <h1 className="text-3xl font-bold text-gray-900">External Orders</h1>
              <p className="mt-2 text-sm text-gray-500">
                Create manual orders with the same fields as the public cart. Seller price is used here when available.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => (window.location.href = '/admin')}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Back to Orders
              </button>
              <button
                onClick={() => (window.location.href = '/admin/menu')}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Menu Admin
              </button>
            </div>
          </div>
        </div>

        {formError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Available Items</h2>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                {menuItems.length} items
              </span>
            </div>

            {loading && <p className="text-gray-500">Loading items...</p>}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {menuItems.map((item) => {
                  const usingSellerPrice =
                    item.seller_price !== null && item.seller_price !== undefined;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-gray-200 p-4 transition hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                          {item.category && (
                            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                              {item.category}
                            </p>
                          )}
                        </div>

                        {item.external_only && (
                          <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700">
                            External only
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="mt-3 text-sm text-gray-600">{item.description}</p>
                      )}

                      <div className="mt-4 space-y-1">
                        <p className="text-lg font-bold text-orange-600">
                          ₱{Number(item.price || 0).toFixed(2)}
                        </p>
                        {usingSellerPrice && Number(item.regular_price) !== Number(item.price) && (
                          <p className="text-xs text-gray-500">
                            Regular price: ₱{Number(item.regular_price || 0).toFixed(2)}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                      >
                        Add to external order
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">External Order Cart</h2>
            <p className="mt-1 text-sm text-gray-500">
              These orders go into the same admin order list and totals.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="Customer or seller name"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="09XXXXXXXXX"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Delivery Address</label>
                <textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  rows="3"
                  placeholder="Delivery address"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Special Instructions</label>
                <textarea
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  rows="3"
                  placeholder="Optional notes"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Payment Method</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {paymentMethods.map((method) => {
                    const isSelected = paymentMethod === method;

                    return (
                      <button
                        key={method}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setPaymentMethod(method)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50 text-orange-600'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        } disabled:opacity-60`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Promo Code</label>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 uppercase"
                  placeholder="Optional promo code"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="mt-6 border-t pt-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Order Items
              </h3>

              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-gray-400">
                  No items in cart.
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-gray-200 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            x{item.quantity} · ₱{Number(item.price).toFixed(2)} each
                          </p>
                          {item.seller_price !== null && Number(item.seller_price) !== Number(item.regular_price) && (
                            <p className="text-xs text-gray-400">
                              Seller price active · regular ₱{Number(item.regular_price).toFixed(2)}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          disabled={isSubmitting}
                          className="rounded-lg px-2 py-1 text-sm font-bold text-red-500 hover:bg-red-50 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₱{Number(subtotal).toFixed(2)}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-₱{Number(discountAmount).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>₱{Number(total).toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePlaceExternalOrder}
              disabled={cartItems.length === 0 || isSubmitting}
              className="mt-5 w-full rounded-2xl bg-orange-500 px-4 py-3 text-base font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? 'Creating Order...' : 'Create External Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminExternalPage;
