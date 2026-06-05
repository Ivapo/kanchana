// Controls auto-hide behaviour.
//
// @capability: controls-autohide
// @verifies: VER-07
//
// Why a tiny module instead of inline JS: this is the one piece of pointer
// logic with state (idle timer) — isolating it makes the main app file read
// cleanly, and a future agent can grep "controls-autohide" to find it.

export function createAutoHider(panel, { idleMs = 3000 } = {}) {
  let timer = null;
  let visible = true;

  function show() {
    panel.classList.remove("is-hidden");
    visible = true;
    resetTimer();
  }
  function hide() {
    panel.classList.add("is-hidden");
    visible = false;
    clearTimeout(timer);
    timer = null;
  }
  function resetTimer() {
    clearTimeout(timer);
    timer = setTimeout(hide, idleMs);
  }

  // Any pointer activity inside the panel keeps it open; a tap on the bare
  // surface toggles. This matches the "tap-to-reveal" pattern in the brief.
  function onSurfaceTap(e) {
    // If the tap originated inside the panel, let panel handlers deal with it.
    if (panel.contains(e.target)) return;
    visible ? hide() : show();
  }

  return {
    attach(surface) {
      panel.addEventListener("pointerdown", resetTimer);
      panel.addEventListener("input", resetTimer);
      surface.addEventListener("pointerdown", onSurfaceTap);
      resetTimer();
    },
    show,
    hide,
    get visible() { return visible; },
  };
}
