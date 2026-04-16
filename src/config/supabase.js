// src/config/supabase.js

export const SUPABASE_URL = 'https://ieqpalamjvxxwxjupwnv.supabase.co';
export const SUPABASE_PROJECT_REF = 'ieqpalamjvxxwxjupwnv';

export const BUCKET_PAYMENT_PROOFS = 'payment-proofs';

// QR code links for each payment method - replace with your actual QR image URLs
export const QR_LINKS = {
  'GCash': 'https://ieqpalamjvxxwxjupwnv.supabase.co/storage/v1/object/public/assets/gcashqr.png',
  'GoTyme': 'https://ieqpalamjvxxwxjupwnv.supabase.co/storage/v1/object/public/assets/nicogotyme.jpg',
  'Bank Transfer': 'https://ieqpalamjvxxwxjupwnv.supabase.co/storage/v1/object/public/assets/unionbankqr.jpg',
  'Cash': null, // No QR for cash
};

// Helper to get public URL for uploaded payment proof
export function getPaymentProofUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_PAYMENT_PROOFS}/${path}`;
}
//const supabaseAnonKey = 'sb_publishable_jV3pL1Ly3vEn7B_WHXwGmg_76SOOQq1' // The long one from dashboard

