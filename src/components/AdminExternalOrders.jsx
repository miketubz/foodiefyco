import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const paymentMethods = ['COD', 'GCASH', 'GOtyme', 'UnionBank'];

function AdminExternalOrders() {
  const [menuItems, setMenuItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMenu = async () => {
      const { data, error: fetchError } = await supabase
        .from('menu_item')
        .select('*')
        .eq('available', true)
        .order('sort_order', { ascending: true, nullsFirst: true })
        .order('id', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setMenuItems(data || []);
    };

    fetchMenu();
  }, []);

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.active_price || item.price || 0) * item.quantity,
        0
      ),
    [cartItems]
  );

  const total = Math.max(0, subtotal - Number(discountAmount || 0));

  const addToCart = (item) => {
    const activePrice = Number(item.seller_price ?? item.price ?? 0);

    setCartItems((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }

      return [
        ...prev,
        {
          ...item,
          active_price: activePrice,
          quantity: 1,
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

  const applyPromo = async () => {
    setError('');
    setMessage('');

    const normalized = promoCode.trim().toUpperCase();
    if (!normalized) {
      setDiscountAmount(0);
      setMessage('Promo code cleared.');
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('validate_promo_code', {
      input_code: normalized,
      cart_subtotal: subtotal,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (!data?.valid) {
      setDiscountAmount(0);
      setError(data?.message || 'Promo code is invalid.');
      return;
    }

    setPromoCode(data.normalized_code || normalized);
    setDiscountAmount(Number(data.discount_amount || 0));
    setMessage(data.message || 'Promo code applied.');
  };

  const placeExternalOrder = async () => {
    if (cartItems.length === 0 || isSubmitting) return;

    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const normalizedPromo = promoCode.trim().toUpperCase();
      let appliedDiscount = 0;

      if (normalizedPromo) {
        const { data, error: rpcError } = await supabase.rpc('validate_promo_code', {
          input_code: normalizedPromo,
          cart_subtotal: subtotal,
        });

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        if (!data?.valid) {
          throw new Error(data?.message || 'Promo code is invalid.');
        }

        appliedDiscount = Number(data.discount_amount || 0);
      }

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: customerName.trim() || 'External Order',
            phone_number: phoneNumber.trim() || 'N/A',
            delivery_address: deliveryAddress.trim() || 'N/A',
            special_instructions: specialInstructions.trim() || null,
            payment_method: paymentMethod,
            promo_code: normalizedPromo || null,
            discount_amount: appliedDiscount,
            total_amount: Math.max(0, subtotal - appliedDiscount),
            status: 'pending',
            payment_status: 'unpaid',
            order_source: 'external',
          },
        ])
        .select()
        .single();

      if (orderError) {
        throw new Error(orderError.message);
      }

      const itemsPayload = cartItems.map((item) => ({
        order_id: orderRow.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: Number(item.active_price || item.price || 0),
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsError) {
        throw new Error(itemsError.message);
      }

      setMessage(`External order created. Order ID: ${orderRow.id}`);
      setCartItems([]);
      setCustomerName('');
      setPhoneNumber('');
      setDeliveryAddress('');
      setSpecialInstructions('');
      setPaymentMethod('COD');
      setPromoCode('');
      setDiscountAmount(0);
    } catch (err) {
      setError(err.message || 'Could not create external order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">External Orders</h1>
            <p className="mt-1 text-gray-600">
              Admin-only order entry with seller pricing and promo code support.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-xl border bg-white px-4 py-3 shadow-sm hover:bg-gray-50">
              Orders
            </Link>
            <Link to="/admin/menu" className="rounded-xl border bg-white px-4 py-3 shadow-sm hover:bg-gray-50">
              Menu
            </Link>
            <Link to="/" className="rounded-xl border bg-white px-4 py-3 shadow-sm hover:bg-gray-50">
              Storefront
            </Link>
          </div>
        </div>

        {message ? (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Available Menu</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {menuItems.map((item) => {
                const activePrice = Number(item.seller_price ?? item.price ?? 0);
                return (
                  <div key={item.id} className="rounded-2xl border p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {item.external_only ? (
                        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
                          External only
                        </span>
                      ) : null}
                    </div>
                    <p className="mb-1 text-sm text-gray-500">{item.category || 'Uncategorized'}</p>
                    <p className="mb-3 text-sm text-gray-500 line-clamp-3">
                      {item.description || 'No description.'}
                    </p>
                    <div className="mb-3 space-y-1">
                      <p className="text-sm text-gray-500">
                        Regular: <span className="font-semibold text-gray-900">₱{Number(item.price || 0).toFixed(2)}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        Seller: <span className="font-semibold text-emerald-700">₱{activePrice.toFixed(2)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => addToCart(item)}
                      className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                    >
                      Add to Order
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Create External Order</h2>

            <div className="space-y-4">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer / reseller name"
                className="w-full rounded-xl border px-4 py-3"
              />
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone number"
                className="w-full rounded-xl border px-4 py-3"
              />
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Delivery address"
                className="min-h-[90px] w-full rounded-xl border px-4 py-3"
              />
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Special instructions"
                className="min-h-[90px] w-full rounded-xl border px-4 py-3"
              />

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        paymentMethod === method
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Promo Code</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    className="min-w-0 flex-1 rounded-xl border px-4 py-3 uppercase"
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    className="rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-black"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Cart</h3>
              {cartItems.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-gray-400">
                  No items yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between rounded-xl border px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          x{item.quantity} • ₱{Number(item.active_price || item.price || 0).toFixed(2)} each
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-lg font-bold text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2 border-t pt-4 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-green-600">
                <span>Discount</span>
                <span>-₱{Number(discountAmount).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>₱{total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={placeExternalOrder}
              disabled={cartItems.length === 0 || isSubmitting}
              className="mt-5 w-full rounded-2xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Order...' : 'Create External Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminExternalOrders;
