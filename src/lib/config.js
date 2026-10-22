import { createClient } from '@supabase/supabase-js';

// 建置時由 build.mjs 帶入（GitHub → Settings → Secrets and variables → Actions → Variables）
const SB_URL = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
const SB_KEY = typeof __SUPABASE_KEY__ !== 'undefined' ? __SUPABASE_KEY__ : '';
const sbClient = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

export { SB_URL, SB_KEY, sbClient };
