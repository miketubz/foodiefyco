import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMenuItems } from '../hooks/useMenuItems';
import { supabase } from '../lib/supabaseClient.js';
import gcashQr from '../../pix/gcashqr.png';
import gotymeQr from '../../pix/nicogotyme.jpg';
import unionbankQr from '../../pix/unionbankqr.jpg';

function AdminExternalPage() {
  const { menuItems, loading, error } = useMenuItems();

  const [cartItems, setCartItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      ),
    [cartItems]
  );

  const finalTotal = useMemo(
    () => Math.max(0, Number(subtotal) - Number(discountAmount || 0)),
    [subtotal, discountAmount]
  );

  const paymentQrMap = {
    GCASH: gcashQr,
    GOtyme: gotymeQr,
    UnionBank: unionbankQr,
  };

  const selectedPaymentQr =
    paymentMethod && paymentMethod !== 'COD'
      ? paymentQrMap[paymentMethod]
      : '';

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        (menuItems || [])
          .map((item) => (item.category || '').trim())
          .filter(Boolean)
      )
    );

    return uniqueCategories.sort((a, b) => a.localeCompare(b));
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (menuItems || []).filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || (item.category || '') === selectedCategory;

      const searchableText = [item.name, item.category, item.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  useEffect(() => {
    setDiscountAmount(0);
    setPromoMessage('');
    setPromoError('');
  }, [promoCode, subtotal]);

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

  const normalizePromoResult = (data) => {
    const raw = Array.isArray(data) ? data[0] : data;

    if (!raw) {
      return {
        valid: false,
        discount_amount: 0,
        message: 'Promo code is invalid.',
      };
    }

    return {
      valid: raw.valid ?? raw.is_valid ?? false,
      discount_amount: Number(raw.discount_amount ?? raw.discount ?? 0),
      message: raw.message ?? '',
    };
  };

  const validatePromoCode = async (normalizedPromo) => {
    if (!normalizedPromo) {
      return { valid: true, discount_amount: 0, message: '' };
    }

    const { data, error } = await supabase.rpc('validate_promo_code', {
      input_code: normalizedPromo,
      order_subtotal: subtotal,
    });

    if (error) {
      throw new Error(error.message);
    }

    return normalizePromoResult(data);
  };

  const handleApplyPromo = async () => {
    const normalizedPromo = promoCode.trim().toUpperCase();

    setPromoMessage('');
    setPromoError('');
    setSubmitError('');

    if (!normalizedPromo) {
      setDiscountAmount(0);
      setPromoError('Enter a promo code first.');
      return;
    }

    setIsApplyingPromo(true);

    try {
      const promoResult = await validatePromoCode(normalizedPromo);

      if (!promoResult.valid) {
        setDiscountAmount(0);
        setPromoError(promoResult.message || 'Promo code is invalid.');
        return;
      }

      setDiscountAmount(Number(promoResult.discount_amount || 0));
      setPromoMessage(
        `Promo code applied. Discount: ₱${Number(
          promoResult.discount_amount || 0
        ).toFixed(2)}`
      );
    } catch (err) {
      setDiscountAmount(0);
      setPromoError(`Promo code validation failed: ${err.message}`);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handlePlaceExternalOrder = async () => {
    if (cartItems.length === 0 || isSubmitting) return;

    setSubmitError('');
    setSuccessMessage('');

    if (!customerName.trim()) {
      setSubmitError('Customer name is required.');
      return;
    }

    if (!paymentMethod) {
      setSubmitError('Please select a payment method.');
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedPromo = promoCode.trim().toUpperCase();
      const promoResult = await validatePromoCode(normalizedPromo);

      if (!promoResult?.valid) {
        setSubmitError(promoResult?.message || 'Promo code is invalid.');
        setIsSubmitting(false);
        return;
      }

      const appliedDiscount = Number(promoResult?.discount_amount || 0);
      const totalAfterDiscount = Math.max(0, subtotal - appliedDiscount);

      const { data: orderData, error: orderErrorResponse } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: customerName.trim(),
            phone_number: phoneNumber.trim() || '',
            delivery_address: deliveryAddress.trim() || '',
            special_instructions: specialInstructions.trim() || '',
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

      if (orderErrorResponse) {
        setSubmitError(`Failed to place external order: ${orderErrorResponse.message}`);
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
        setSubmitError(
          `Order was created, but saving items failed: ${itemsError.message}`
        );
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        `External order created successfully. Order ID: ${orderData.id}`
      );
      setCartItems([]);
      setCustomerName('');
      setPhoneNumber('');
      setDeliveryAddress('');
      setSpecialInstructions('');
      setPaymentMethod('COD');
      setPromoCode('');
      setDiscountAmount(0);
      setPromoMessage('');
      setPromoError('');
      setIsSubmitting(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to place external order.');
      setIsSubmitting(false);
    }
  };

  const isFormValid = cartItems.length > 0 && customerName.trim() && paymentMethod;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Admin External Orders
            </p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Create an external order
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              This page creates orders directly in the admin system using the same menu and promo logic.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">
              Back to Admin
            </Link>
            <Link to="/admin/gallery" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">
              Gallery
            </Link>
          </div>
        </div>

        {(submitError || error) && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
            {submitError || error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-green-300 bg-green-50 p-4 text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Search menu
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by item name, category, or description"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="text-sm text-gray-500 md:text-right">
                  Showing {filteredMenuItems.length} of {menuItems.length} items
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedCategory === 'all'
                      ? 'bg-orange-500 text-white'
                      : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                  }`}
                >
                  All
                </button>

                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedCategory === category
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </section>

            {loading && (
              <div className="rounded-2xl bg-white p-6 text-gray-600 shadow-sm">
                Loading menu...
              </div>
            )}

            {!loading && !error && filteredMenuItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">No menu items found</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Try another search term or choose a different category.
                </p>
              </div>
            )}

            {!loading && !error && filteredMenuItems.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">{item.name}</p>
                        <p className="mt-1 text-sm text-gray-500">{item.category || 'Uncategorized'}</p>
                        {item.description && (
                          <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">
                          ₱{Number(item.price || 0).toFixed(2)}
                        </p>
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                        >
                          Add to Order
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="sticky top-4 rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">External Order</h2>
              <p className="mt-1 text-sm text-gray-500">
                Payment status will default to unpaid.
              </p>

              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Required"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Delivery Address
                  </label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    rows="3"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Special Instructions
                  </label>
                  <textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    rows="3"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['COD', 'GCASH', 'GOtyme', 'UnionBank'].map((method) => {
                      const isSelected = paymentMethod === method;

                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          disabled={isSubmitting}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 text-orange-600'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>

                  {paymentMethod !== 'COD' && selectedPaymentQr && (
                    <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                      <p className="mb-3 text-sm font-semibold text-gray-700">
                        Scan this QR for {paymentMethod}
                      </p>
                      <img
                        src={selectedPaymentQr}
                        alt={`${paymentMethod} QR`}
                        className="mx-auto max-h-72 w-full max-w-xs rounded-xl border border-gray-200 bg-white object-contain p-2"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Promo Code
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Enter promo code"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 uppercase"
                      disabled={isSubmitting || isApplyingPromo}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={isSubmitting || isApplyingPromo || !promoCode.trim()}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {isApplyingPromo ? 'Applying...' : 'Apply'}
                    </button>
                  </div>

                  {promoMessage && (
                    <p className="mt-2 text-sm font-medium text-green-600">{promoMessage}</p>
                  )}

                  {promoError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{promoError}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t pt-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Order Items
                </h3>

                {cartItems.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-gray-400">
                    No items added yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between rounded-xl border border-gray-200 px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            x{item.quantity} — ₱{(
                              Number(item.price) * item.quantity
                            ).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item)}
                          disabled={isSubmitting}
                          className="text-lg font-bold text-red-500 disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t pt-4">
                <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>₱{Number(subtotal).toFixed(2)}</span>
                </div>

                <div className="mb-2 flex items-center justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-₱{Number(discountAmount).toFixed(2)}</span>
                </div>

                <div className="mb-4 flex items-center justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>₱{finalTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handlePlaceExternalOrder}
                  disabled={!isFormValid || isSubmitting || isApplyingPromo}
                  className="w-full rounded-2xl bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Order...' : 'Place External Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminExternalPage;
