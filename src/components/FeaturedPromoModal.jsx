import { useState } from 'react';

function FeaturedPromoModal({ item, onAddToCart, onClose }) {
  const [imageError, setImageError] = useState(false);

  if (!item) return null;

  const handleAddToCart = () => {
    onAddToCart(item);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating modal — centered on mobile, bottom-right on desktop */}
      <div
        className="fixed bottom-6 left-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100 sm:bottom-8 sm:left-auto sm:right-8 sm:translate-x-0"
        role="dialog"
        aria-modal="true"
        aria-label={`Featured promo: ${item.name}`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow hover:bg-gray-100"
          aria-label="Close promo"
        >
          ✕
        </button>

        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-t-3xl bg-gray-100">
          {item.image_url && !imageError ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 text-5xl">
              🍽️
            </div>
          )}
          {/* Promo badge */}
          <div className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
            ⭐ Featured
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-orange-500">
            {item.category || 'Promo'}
          </div>
          <div className="mb-3 flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900 leading-snug">
              {item.name}
            </h3>
            <span className="whitespace-nowrap text-base font-bold text-orange-600">
              ₱{Number(item.price).toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddToCart}
              className="flex-1 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 active:scale-95"
            >
              Add to Cart
            </button>
            <button
              onClick={onClose}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-95"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default FeaturedPromoModal;
