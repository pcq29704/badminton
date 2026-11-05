"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "./client";

export default function Providers({ children }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
