import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client for server code only. It bypasses row-level security, so it must
// never be imported from a client component (the "server-only" import enforces that).
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
