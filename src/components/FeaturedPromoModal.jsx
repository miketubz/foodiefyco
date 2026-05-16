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

      {/* Floating modal — centered on all screen sizes */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100 md:max-w-md lg:max-w-lg"
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
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M12 2.5l2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.39 2.84 1.03-6-4.37-4.25 6.04-.88L12 2.5z" />
            </svg>
            Featured
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-orange-500">
            {item.category || 'Promo'}
          </div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900 leading-snug">
              {item.name}
            </h3>
            <span className="whitespace-nowrap text-base font-bold text-orange-600">
              ₱{Number(item.price).toFixed(2)}
            </span>
          </div>

          {item.description?.trim() && (
            <p className="mb-3 text-sm text-gray-500 leading-relaxed">
              {item.description.trim()}
            </p>
          )}

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
