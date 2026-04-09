import { useState } from 'react';

function MenuCard({ item, onAddToCart }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {item.image_url && !imageError ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 text-6xl">
            🍽️
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-600 shadow-sm backdrop-blur">
          {item.category || 'Menu Item'}
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-gray-900">
              {item.name}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {item.description?.trim() || 'Freshly prepared and ready for delivery.'}
            </p>
          </div>
          <p className="whitespace-nowrap text-lg font-bold text-orange-600">
            ₱{Number(item.price).toFixed(2)}
          </p>
        </div>

        <button
          onClick={() => onAddToCart(item)}
          className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}

export default MenuCard;
