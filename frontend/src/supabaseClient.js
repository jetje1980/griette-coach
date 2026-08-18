import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://osuqtfsxmquwqsbgzlqn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_6T-JJKX10RgLkWGwBwYaxg_gFANhdHS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
