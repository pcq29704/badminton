import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase/client";

function endpoint() {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error("Development Supabase is not configured yet.");
  return `${supabaseUrl}/functions/v1/player-api`;
}

async function result(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export async function postPlayerJson(action, values, signal) {
  return result(await fetch(endpoint(), {
    method: "POST",
    headers: { apikey: supabasePublishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...values }),
    signal,
  }));
}

export async function uploadPlayerImage(username, password, kind, file, signal) {
  const form = new FormData();
  form.append("action", "upload");
  form.append("username", username);
  form.append("password", password);
  form.append("kind", kind);
  form.append("file", file);
  return result(await fetch(endpoint(), {
    method: "POST",
    headers: { apikey: supabasePublishableKey },
    body: form,
    signal,
  }));
}

export function profileImageUrl(path) {
  if (!path || !supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/player-profile-images/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}
