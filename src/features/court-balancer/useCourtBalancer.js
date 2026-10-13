"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { createCourtBalancer } from "./controller";
import { initialState } from "./state";

export function useCourtBalancer() {
  const [state, setState] = useState(() => initialState(hasSupabaseConfig));
  const controller = useRef(null);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    try {
      const instance = createCourtBalancer(getSupabaseClient(), setState);
      controller.current = instance;
      void instance.start();
      return () => {
        instance.dispose();
        controller.current = null;
      };
    } catch (error) {
      setState((current) => ({ ...current, phase: "error", errorMsg: error.message }));
    }
  }, []);

  return { state, actions: controller.current?.actions };
}
