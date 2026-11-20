import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const configured =
  /^https:\/\/.+/.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('INSERISCI') &&
  !!SUPABASE_KEY &&
  !SUPABASE_KEY.includes('INSERISCI');

export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ikh-auth' },
    })
  : null;

export const BUCKET = 'note-images';
