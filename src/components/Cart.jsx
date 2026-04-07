import gcashQr from '../../pix/gcashqr.png';

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
  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  const isFormValid =
    cartItems.length > 0 &&
    customerName.trim() &&
    phoneNumber.trim() &&
    deliveryAddress.trim() &&
    paymentMethod.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="border-b border-orange-100 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-orange-600">Your order</p>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                Checkout
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full p-2 text-2xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto bg-gray-50 px-6 py-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Customer details
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400"
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400"
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400"
                  rows="3"
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
                  placeholder="Leave at gate, less spicy, call on arrival, etc."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400"
                  rows="3"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Payment method
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {['COD', 'GCASH'].map((method) => {
                const active = paymentMethod === method;

                return (
                  <label
                    key={method}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      active
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={active}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={isSubmitting}
                      className="sr-only"
                    />
                    <p className="font-semibold text-gray-900">
                      {method === 'COD' ? 'Cash on Delivery' : 'GCash'}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {method === 'COD'
                        ? 'Pay the rider when your order arrives.'
                        : 'Scan the QR code and pay before checkout.'}
                    </p>
                  </label>
                );
              })}
            </div>

            {paymentMethod === 'GCASH' && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Scan to pay with GCash
                </p>
                <img
                  src={gcashQr}
                  alt="GCash QR Code"
                  className="mx-auto h-64 w-64 rounded-2xl border border-gray-200 bg-white object-contain"
                />
                <p className="mt-3 text-xs text-gray-500">
                  Please complete the payment before placing your order.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Order summary
              </h3>
              <span className="text-sm font-medium text-gray-500">
                {cartItems.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
            </div>

            {cartItems.length === 0 ? (
              <p className="py-8 text-center text-gray-400">Your cart is empty</p>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between rounded-2xl border border-gray-100 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        x{item.quantity} · ₱{(Number(item.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(item)}
                      disabled={isSubmitting}
                      className="rounded-full px-2 py-1 text-lg font-bold text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-gray-200 bg-white px-6 py-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Total amount</span>
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              ₱{total.toFixed(2)}
            </span>
          </div>
          <button
            onClick={onPlaceOrder}
            disabled={!isFormValid || isSubmitting}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {isSubmitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Cart;
