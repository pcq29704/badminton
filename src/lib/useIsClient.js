import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during the server render and hydration, true after. Use it for output that depends on the
// viewer's time zone or screen, which the server cannot know.
export function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
