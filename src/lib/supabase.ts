// React Native's built-in URL is incomplete — this polyfill patches it so
// supabase-js can parse function URLs etc. Must import before createClient.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// process.env vars prefixed EXPO_PUBLIC_ are inlined at build time. The `!`
// asserts they're defined — if .env is missing we'd rather crash loudly than
// silently send unauthenticated requests.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Persist the logged-in session across app restarts.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No URL bar in RN, so the deep-link session detection doesn't apply.
      detectSessionInUrl: false,
    },
  },
);
