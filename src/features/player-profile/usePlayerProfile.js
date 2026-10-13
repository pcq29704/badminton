"use client";

import { useEffect, useRef, useState } from "react";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { postPlayerJson, uploadPlayerImage } from "./api";

export function usePlayerProfile() {
  const [state, setState] = useState({
    initialized: false, username: "", loginUsername: "", password: "",
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

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    const username = new URLSearchParams(window.location.search).get("u") || "";
    update({ initialized: true, username, loginUsername: username });
    if (hasSupabaseConfig && username) void refreshProfile(username, controller.signal);
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
      update({ username: result.username, loginUsername: result.username, loggedIn: true, newUsername: null });
      setProfileUrl(result.username);
      await refreshProfile(result.username, signal);
    });
  }

  function saveUsername() {
    if (!state.loggedIn) return;
    return run(async (signal) => {
      const result = await postPlayerJson("update", { username: state.username, password: state.password, newUsername: state.newUsername ?? state.profile.username }, signal);
      if (signal.aborted) return;
      update({ username: result.username, loginUsername: result.username, newUsername: null, notice: "Username updated." });
      setProfileUrl(result.username);
      await refreshProfile(result.username, signal);
    });
  }

  function upload(kind, file) {
    if (!state.loggedIn || !file) return;
    return run(async (signal) => {
      await uploadPlayerImage(state.username, state.password, kind, file, signal);
      if (signal.aborted) return;
      update({ notice: kind === "profile" ? "Profile image updated." : "Background image updated." });
      await refreshProfile(state.username, signal);
    });
  }

  function signOut() {
    if (busy.current) return;
    update({ loggedIn: false, password: "", loginUsername: state.username, newUsername: null, notice: "" });
  }

  return { state, actions: { update, login, saveUsername, upload, signOut } };
}
