// Supabase Configuration
// Replace these values if needed

export const SUPABASE_PROJECT_REF = 'ieqpalamjvxxwxjupwnv';
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

// Storage Buckets
export const BUCKET_PAYMENT_PROOFS = 'payment-proofs';
export const BUCKET_FOOD_IMAGES = 'food-images';

// QR Images from Github
export const QR_LINKS = {
  'GCash': 'https://raw.githubusercontent.com/miketubz/foodiefyco/main/pix/gcashqr.png',
  'Nico': 'https://raw.githubusercontent.com/miketubz/foodiefyco/main/pix/nicogotyme.jpg',
  'UnionBank': 'https://raw.githubusercontent.com/miketubz/foodiefyco/main/pix/unionbankqr.jpg'
};

// Helper to build payment proof URL
export const getPaymentProofUrl = (path) => {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_PAYMENT_PROOFS}/${path}`;
};
