import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

function GalleryPage() {
  const [galleryItems, setGalleryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGalleryItems = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('gallery_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setGalleryItems(data || []);
      setLoading(false);
    };

    fetchGalleryItems();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Gallery
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Food moments and highlights
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-600 sm:text-base">
              Browse our featured photos. Tap any image to open its linked page.
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Back to Frontstore
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-600 shadow-sm">
            Loading gallery...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            Failed to load gallery: {error}
          </div>
        )}

        {!loading && !error && galleryItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">No gallery items yet</h2>
            <p className="mt-2 text-sm text-gray-500">
              Add image links from the admin gallery page and they will appear here.
            </p>
          </div>
        )}

        {!loading && !error && galleryItems.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {galleryItems.map((item) => {
              const card = (
                <div className="overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                    <img
                      src={item.image_url}
                      alt={item.title || 'Gallery image'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="p-5">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {item.title || 'Gallery item'}
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                      {item.target_url ? 'Tap to open linked page' : 'Image only'}
                    </p>
                  </div>
                </div>
              );

              return item.target_url ? (
                <a
                  key={item.id}
                  href={item.target_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  {card}
                </a>
              ) : (
                <div key={item.id}>{card}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default GalleryPage;
