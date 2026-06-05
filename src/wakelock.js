// Screen Wake Lock wrapper.
//
// @capability: wake-lock
// @verifies: VER-05
//
// The Wake Lock API was added to iOS Safari in 16.4. On older iPads it will
// simply be unavailable; we no-op rather than throw, and document the limit
// in README. The lock is released by the platform whenever the page becomes
// hidden (tab switch, lock screen) — we re-acquire on visibilitychange so a
// brief glance at notifications doesn't end the lamp session.

export function createWakeLock(logger = () => {}) {
  let sentinel = null;
  let wanted = false;

  const supported =
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof navigator.wakeLock?.request === "function";

  async function acquire() {
    if (!supported || !wanted) return;
    if (sentinel && !sentinel.released) return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener?.("release", () => logger("wake-lock released"));
      logger("wake-lock acquired");
    } catch (err) {
      // Most common cause: page not visible at request time. We'll retry on
      // the next visibilitychange. Surfacing the error in dev helps diagnose.
      logger(`wake-lock acquire failed: ${err?.message ?? err}`);
    }
  }

  function onVisibility() {
    if (document.visibilityState === "visible") acquire();
  }

  return {
    supported,
    async enable() {
      wanted = true;
      document.addEventListener?.("visibilitychange", onVisibility);
      await acquire();
    },
    async disable() {
      wanted = false;
      document.removeEventListener?.("visibilitychange", onVisibility);
      if (sentinel && !sentinel.released) {
        try { await sentinel.release(); } catch { /* ignore */ }
      }
      sentinel = null;
    },
  };
}
