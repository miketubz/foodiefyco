import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ieqpalamjvxxwxjupwnv.supabase.co'
const supabaseKey = 'sb_publishable_jV3pL1Ly3vEn7B_WHXwGmg_76SOOQq1'

export const supabase = createClient(supabaseUrl, supabaseKey)