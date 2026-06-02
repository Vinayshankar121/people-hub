// Client-side Supabase admin client — uses the service-role key so it can
// call auth.admin.* and bypass RLS.  This key is exposed to the browser,
// which is acceptable for internal / trusted-network HRMS apps but should
// NOT be used for public-facing applications.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[Supabase Admin] Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY — admin operations will fail.",
  );
}
// Mask the service key when logging to avoid leaking secrets.
if (SUPABASE_SERVICE_ROLE_KEY) {
  const key = String(SUPABASE_SERVICE_ROLE_KEY);
  const masked = `${key.slice(0, 4)}...${key.slice(-4)}`;
  console.info(`[Supabase Admin] service role key loaded (masked): ${masked}`);
} else {
  console.info("[Supabase Admin] service role key not present in import.meta.env");
}

export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);



