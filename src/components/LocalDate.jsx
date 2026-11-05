"use client";

import { useIsClient } from "@/lib/useIsClient";

// A date in the viewer's own time zone and locale. Empty in the server render.
export default function LocalDate({ value, options }) {
  const isClient = useIsClient();
  return isClient ? new Date(value).toLocaleString([], options) : null;
}
