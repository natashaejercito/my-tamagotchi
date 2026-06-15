import { STORE_KEY } from "./constants.js";

// Persistent storage helpers (best-effort; the app works without them too).

export async function loadSaved() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(STORE_KEY);
      return r && r.value ? JSON.parse(r.value) : null;
    }
  } catch (e) { /* no saved pet yet, or storage unavailable */ }
  return null;
}

let saveTimer = null;
export function saveThrottled(data) {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      if (typeof window !== "undefined" && window.storage) {
        await window.storage.set(STORE_KEY, JSON.stringify(data));
      }
    } catch (e) { /* best effort */ }
  }, 1500);
}
