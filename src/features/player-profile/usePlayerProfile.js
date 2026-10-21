"use client";

import { useEffect, useRef, useState } from "react";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { postPlayerJson, uploadPlayerImage } from "./api";

// onSignedIn(username) runs after an explicit sign-in, or when a saved session is restored with no ?u= in the URL.
export function usePlayerProfile({ onSignedIn } = {}) {
  const [state, setState] = useState({
    initialized: false, restored: false, username: "", loginUsername: "", password: "",
    newUsername: null, loggedIn: false, busy: false, error: "", notice: "", profile: null,
  });
  const lifecycle = useRef(null);
  const busy = useRef(false);
  const update = (patch) => setState((current) => ({ ...current, ...patch }));

  async function refreshProfile(username, signal) {
    try {
      const profile = await postPlayerJson("profile", { username }, signal);
      if (!signal.aborted) update({ profile, error: "" });
    } catch (error) {
      if (!signal.aborted) update({ profile: null, error: error.message });
    }
  }

  // Restores a signed-in player after refresh. Skips the restore when ?u= names a different player.
  async function restoreSession(username, signal) {
    let restored = null;
    try {
      restored = await postPlayerJson("session", {}, signal);
    } catch {
      restored = null;
    }
    if (signal.aborted) return;
    update({ restored: true });
    const sameOrEmpty = !username || username.toLowerCase() === restored?.username?.toLowerCase();
    if (restored && sameOrEmpty) {
      update({ loggedIn: true, username: restored.username, loginUsername: restored.username });
      if (!username && onSignedIn) { onSignedIn(restored.username); return; }
      setProfileUrl(restored.username);
      await refreshProfile(restored.username, signal);
      return;
    }
    if (hasSupabaseConfig && username) await refreshProfile(username, signal);
  }

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    const username = new URLSearchParams(window.location.search).get("u") || "";
    update({ initialized: true, username, loginUsername: username });
    if (hasSupabaseConfig) void restoreSession(username, controller.signal);
    return () => { controller.abort(); lifecycle.current = null; };
  }, []);

  function setProfileUrl(username) {
    const url = new URL(window.location.href);
    url.searchParams.set("u", username);
    window.history.replaceState(null, "", url);
  }

  async function run(action) {
    const signal = lifecycle.current?.signal;
    if (busy.current || !signal || signal.aborted) return;
    busy.current = true;
    update({ busy: true, error: "", notice: "" });
    try {
      await action(signal);
    } catch (error) {
      if (!signal.aborted) update({ error: error.message });
    } finally {
      if (!signal.aborted) {
        busy.current = false;
        update({ busy: false });
      }
    }
  }

  function login() {
    return run(async (signal) => {
      const result = await postPlayerJson("login", { username: state.loginUsername, password: state.password }, signal);
      if (signal.aborted) return;
      update({ username: result.username, loginUsername: result.username, loggedIn: true, newUsername: null, password: "" });
      if (onSignedIn) { onSignedIn(result.username); return; }
      setProfileUrl(result.username);
      await refreshProfile(result.username, signal);
    });
  }

  function saveUsername() {
    if (!state.loggedIn) return;
    return run(async (signal) => {
      const result = await postPlayerJson("update", { newUsername: state.newUsername ?? state.profile.username }, signal);
      if (signal.aborted) return;
      update({ username: result.username, loginUsername: result.username, newUsername: null, notice: "Username updated." });
      setProfileUrl(result.username);
      await refreshProfile(result.username, signal);
    });
  }

  function upload(kind, file) {
    if (!state.loggedIn || !file) return;
    return run(async (signal) => {
      await uploadPlayerImage(kind, file, signal);
      if (signal.aborted) return;
      update({ notice: kind === "profile" ? "Profile image updated." : "Background image updated." });
      await refreshProfile(state.username, signal);
    });
  }

  function signOut() {
    if (busy.current) return;
    // Logout errors are ignored: the cookie is cleared by the server, and the UI should not wait on it.
    void postPlayerJson("logout", {}, lifecycle.current?.signal).catch(() => {});
    update({ loggedIn: false, password: "", loginUsername: state.username, newUsername: null, notice: "" });
  }

  return { state, actions: { update, login, saveUsername, upload, signOut } };
}
