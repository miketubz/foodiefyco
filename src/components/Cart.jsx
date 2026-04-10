import gcashQr from '../../pix/gcashqr.png';
import gotymeQr from '../../pix/GOtyme.jpg';
import unionbankQr from '../../pix/unionbankqr.jpg';

const paymentQrMap = {
  GCASH: gcashQr,
  GOtyme: gotymeQr,
  UnionBank: unionbankQr,
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
  promoCode,
  setPromoCode,
  promoError = '',
  promoSummary = null,
  isSubmitting = false,
}) {
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );
  const discountAmount = Number(promoSummary?.discountAmount || 0);
  const total = Math.max(subtotal - discountAmount, 0);
  const qrImage = paymentQrMap[paymentMethod] || null;

  const isFormValid =
    cartItems.length > 0 &&
    customerName.trim() &&
    phoneNumber.trim() &&
    deliveryAddress.trim() &&
    paymentMethod;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-orange-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Your Cart</h2>
            <p className="text-sm text-gray-500">Complete the details to place the order.</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Customer Details
            </h3>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                  placeholder="Optional notes for your order"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows="3"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Payment Method
            </h3>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['COD', 'GCASH', 'GOtyme', 'UnionBank'].map((method) => {
                const selected = paymentMethod === method;

                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    disabled={isSubmitting}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                      selected
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>

            {qrImage && (
              <div className="mt-4 rounded-2xl border border-orange-100 bg-white p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Scan to pay with {paymentMethod}
                </p>
                <img
                  src={qrImage}
                  alt={`${paymentMethod} QR`}
                  className="mx-auto h-56 w-56 rounded-2xl object-contain"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Promo Code
            </h3>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Enter promo code"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={isSubmitting}
              />
            </div>

            {promoSummary?.isValid && (
              <p className="mt-3 text-sm font-medium text-green-600">
                Promo applied: {promoSummary.label}
              </p>
            )}

            {promoError && (
              <p className="mt-3 text-sm font-medium text-red-600">{promoError}</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Order Items
            </h3>

            {cartItems.length === 0 ? (
              <p className="text-center text-gray-400">Your cart is empty</p>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-3"
                  >
                    <div className="pr-3">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        x{item.quantity} — ₱{(Number(item.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(item)}
                      disabled={isSubmitting}
                      className="rounded-full px-3 py-2 text-lg font-bold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 bg-white px-5 py-4">
          <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>₱{subtotal.toFixed(2)}</span>
          </div>

          {discountAmount > 0 && (
            <div className="mb-1 flex items-center justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-₱{discountAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>₱{total.toFixed(2)}</span>
          </div>

          <button
            onClick={onPlaceOrder}
            disabled={!isFormValid || isSubmitting}
            className="w-full rounded-2xl bg-orange-500 py-3.5 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Cart;
