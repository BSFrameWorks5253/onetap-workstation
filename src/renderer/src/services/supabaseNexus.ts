import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dubscvthmkgkeiqdladp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kYApNvq2_6HAfNwJb8hW1g_7iLMSVyk';

export const supabaseNexus: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export const REALTIME_NEXUS_CHANNEL = 'anyshare_realtime_nexus';
