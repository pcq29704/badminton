"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { keys, profileQuery, sessionQuery, signOutEverywhere } from "../queries";
import { postPlayerJson, uploadPlayerImage } from "./api";

function setProfileUrl(username) {
  const url = new URL(window.location.href);
  url.searchParams.set("u", username);
  window.history.replaceState(null, "", url);
}

// initialUsername is ?u= from the server render. onSignedIn(username) runs after an explicit sign-in,
// or when a saved session is restored with no ?u= in the URL.
// Name, username and image changes show at once (optimistic) and roll back if the server rejects them.
export function usePlayerProfile({ initialUsername = "", onSignedIn } = {}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    username: initialUsername, loginUsername: initialUsername, password: "",
    newUsername: null, newName: null, error: "", notice: "",
  });
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const username = form.username;

  const session = useQuery({ ...sessionQuery, enabled: hasSupabaseConfig });
  const sessionUser = session.data?.username || "";
  // Signed in as the player whose profile is open (or no profile is named yet).
  const loggedIn = Boolean(sessionUser) && (!username || username.toLowerCase() === sessionUser.toLowerCase());
  const profile = useQuery({ ...profileQuery(username), enabled: hasSupabaseConfig && Boolean(username) });

  useEffect(() => {
    if (!username && sessionUser && onSignedIn) onSignedIn(sessionUser);
    // onSignedIn changes on every render; only the session matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, sessionUser]);

  // Applies a change to the open profile and returns a function that undoes it.
  async function patchProfile(name, patch) {
    const key = keys.profile(name);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (current) => current && { ...current, ...patch });
    return () => queryClient.setQueryData(key, previous);
  }

  const patchViewer = (patch) => queryClient.setQueryData(keys.viewer, (viewer) => viewer?.role === "player" ? { ...viewer, ...patch } : viewer);
  const refreshClub = () => queryClient.invalidateQueries({ queryKey: keys.club });

  const login = useMutation({
    mutationFn: () => postPlayerJson("login", { username: form.loginUsername, password: form.password }),
    onMutate: () => update({ error: "", notice: "" }),
    onSuccess: (result) => {
      queryClient.setQueryData(keys.session, { ok: true, username: result.username });
      void queryClient.invalidateQueries({ queryKey: keys.viewer });
      update({ username: result.username, loginUsername: result.username, newUsername: null, password: "" });
      if (onSignedIn) { onSignedIn(result.username); return; }
      setProfileUrl(result.username);
    },
    onError: (error) => update({ error: error.message }),
  });

  const saveName = useMutation({
    mutationFn: (newName) => postPlayerJson("update-name", { newName }),
    onMutate: async (newName) => {
      update({ error: "", notice: "", newName: null });
      return { typed: newName, undo: await patchProfile(username, { name: newName.trim() }) };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(keys.profile(username), (current) => current && { ...current, name: result.name });
      patchViewer({ name: result.name });
      update({ notice: "Name updated." });
    },
    onError: (error, _, context) => { context?.undo(); update({ error: error.message, newName: context?.typed ?? null }); },
    onSettled: refreshClub,
  });

  const saveUsername = useMutation({
    mutationFn: (newUsername) => postPlayerJson("update", { newUsername }),
    onMutate: async (newUsername) => {
      const next = newUsername.trim();
      const before = username;
      await queryClient.cancelQueries({ queryKey: keys.profile(before) });
      const previous = queryClient.getQueryData(keys.profile(before));
      const previousSession = queryClient.getQueryData(keys.session);
      // Show the profile under the new name straight away. The session moves too, so the
      // player stays signed in to this profile (and keeps the Settings tab) while it saves.
      queryClient.setQueryData(keys.profile(next), previous && { ...previous, username: next });
      queryClient.setQueryData(keys.session, { ok: true, username: next });
      update({ error: "", notice: "", newUsername: null, username: next, loginUsername: next });
      setProfileUrl(next);
      return { before, next, typed: newUsername, previous, previousSession };
    },
    onSuccess: (result) => {
      const saved = result.username;
      queryClient.setQueryData(keys.profile(saved), (current) => current && { ...current, username: saved });
      queryClient.setQueryData(keys.session, { ok: true, username: saved });
      patchViewer({ username: saved });
      update({ username: saved, loginUsername: saved, notice: "Username updated." });
      setProfileUrl(saved);
    },
    onError: (error, _, context) => {
      if (!context) return;
      if (keys.profile(context.next)[1] !== keys.profile(context.before)[1]) queryClient.removeQueries({ queryKey: keys.profile(context.next) });
      // Restore the old data last: for a change of letter case only, both keys are the same.
      queryClient.setQueryData(keys.profile(context.before), context.previous);
      queryClient.setQueryData(keys.session, context.previousSession);
      update({ username: context.before, loginUsername: context.before, newUsername: context.typed, error: error.message });
      setProfileUrl(context.before);
    },
    onSettled: refreshClub,
  });

  const upload = useMutation({
    mutationFn: ({ kind, file }) => uploadPlayerImage(kind, file),
    onMutate: async ({ kind, file }) => {
      update({ error: "", notice: "" });
      // A local preview of the chosen file shows until the upload finishes.
      const preview = URL.createObjectURL(file);
      const column = kind === "profile" ? "profile_image_path" : "background_image_path";
      return { preview, column, undo: await patchProfile(username, { [column]: preview }) };
    },
    onSuccess: (result, { kind }, { column }) => {
      queryClient.setQueryData(keys.profile(username), (current) => current && { ...current, [column]: result.path });
      update({ notice: kind === "profile" ? "Profile image updated." : "Background image updated." });
    },
    onError: (error, _, context) => { context?.undo(); update({ error: error.message }); },
    onSettled: (_, __, ___, context) => {
      if (context) setTimeout(() => URL.revokeObjectURL(context.preview), 10_000);
      void refreshClub();
    },
  });

  const busy = login.isPending || saveName.isPending || saveUsername.isPending || upload.isPending;
  const state = {
    ...form,
    initialized: true,
    restored: !session.isPending,
    loggedIn,
    busy,
    profile: profile.data ?? null,
    error: form.error || profile.error?.message || "",
  };

  const actions = {
    update,
    login: () => { if (!busy) login.mutate(); },
    saveName: () => { if (loggedIn && !busy && state.profile) saveName.mutate(form.newName ?? state.profile.name ?? ""); },
    saveUsername: () => { if (loggedIn && !busy && state.profile) saveUsername.mutate(form.newUsername ?? state.profile.username); },
    upload: (kind, file) => { if (loggedIn && !busy && file) upload.mutate({ kind, file }); },
    // Signs out at once. Logout errors are ignored: the server clears the cookie.
    signOut: () => {
      if (busy) return;
      update({ password: "", loginUsername: username, newUsername: null, newName: null, notice: "" });
      void signOutEverywhere(queryClient);
    },
  };

  return { state, actions };
}
