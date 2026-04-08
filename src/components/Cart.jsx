import { useMemo } from 'react';

const qrMap = {
  GCASH: new URL('../../pix/gcashqr.png', import.meta.url).href,
  GOtyme: new URL('../../pix/nicogotyme.jpg', import.meta.url).href,
  UnionBank: new URL('../../pix/unionbankqr.jpg', import.meta.url).href,
};

function Cart({
  cartItems,
  onClose,
  onRemove,
  onPlaceOrder,
  customerName,
  setCustomerName,
  phoneNumber,
  setPhoneNumber,
  deliveryAddress,
  setDeliveryAddress,
  specialInstructions,
  setSpecialInstructions,
  paymentMethod,
  setPaymentMethod,
  isSubmitting = false,
}) {
  const total = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cartItems]
  );

  const isFormValid =
    cartItems.length > 0 &&
    customerName.trim() &&
    phoneNumber.trim() &&
    deliveryAddress.trim() &&
    paymentMethod;

  const selectedQr = qrMap[paymentMethod] || null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-orange-100 bg-orange-500 px-6 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-100">
              Checkout
            </p>
            <h2 className="text-xl font-bold">Your Cart</h2>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-3xl leading-none hover:text-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Customer Details
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Delivery Address
                </label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House no., street, barangay, city"
                  rows="3"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Special Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Less spicy, no onions, leave at gate, etc."
                  rows="3"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Payment Method
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {['COD', 'GCASH', 'GOtyme', 'UnionBank'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  disabled={isSubmitting}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    paymentMethod === method
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {method}
                </button>
              ))}
            </div>

            {selectedQr && (
              <div className="mt-4 rounded-2xl border border-orange-100 bg-white p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Scan to pay with {paymentMethod}
                </p>
                <img
                  src={selectedQr}
                  alt={`${paymentMethod} QR`}
                  className="mx-auto h-64 w-64 rounded-xl border border-gray-200 object-contain"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Order Items
              </h3>
            </div>

            {cartItems.length === 0 ? (
              <p className="px-4 py-10 text-center text-gray-400">Your cart is empty</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        x{item.quantity} — ₱{(Number(item.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <button
                      onClick={() => onRemove(item)}
                      disabled={isSubmitting}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-6 py-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">₱{total.toFixed(2)}</p>
          </div>

          <button
            onClick={onPlaceOrder}
            disabled={!isFormValid || isSubmitting}
            className="w-full rounded-2xl bg-orange-500 py-3.5 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Cart;
