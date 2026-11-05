import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Data from the server render stays fresh for a minute, so the browser does not fetch it again at once.
      queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false },
    },
  });
}

let browserClient;

// A new client for each server request; one shared client in the browser.
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
