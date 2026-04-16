import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ieqpalamjvxxwxjupwnv.supabase.co'
const supabaseAnonKey = 'sb_publishable_jV3pL1Ly3vEn7B_WHXwGmg_76SOOQq1' // The long one from dashboard

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
