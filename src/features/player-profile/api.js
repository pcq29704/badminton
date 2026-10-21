import { supabaseUrl } from "@/lib/supabase/client";

// Same-origin Next.js route handler (src/app/api/player/route.ts).
const endpoint = () => "/api/player";

async function result(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export async function postPlayerJson(action, values, signal, headers = {}) {
  return result(await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ action, ...values }),
    signal,
  }));
}

export async function uploadPlayerImage(kind, file, signal) {
  const form = new FormData();
  form.append("action", "upload");
  form.append("kind", kind);
  form.append("file", file);
  return result(await fetch(endpoint(), {
    method: "POST",
    body: form,
    signal,
  }));
}

export function profileImageUrl(path) {
  if (!path || !supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/player-profile-images/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}
