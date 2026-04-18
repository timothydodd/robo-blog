// Module-level dirty-state coordinator. An editing component calls setDirty
// while it has unsaved changes; anywhere that performs navigation
// (sidebar links, Back buttons, window unload) calls confirmDiscard() first.
//
// Kept outside React state on purpose — it has to be readable from a
// synchronous beforeunload handler, and a NavLink onClick before React
// Router has a chance to navigate.

let _dirty = false;

export function setDirty(value: boolean) {
  _dirty = value;
}

export function isDirty() {
  return _dirty;
}

export function confirmDiscard(message = "You have unsaved changes. Leave anyway?") {
  if (!_dirty) return true;
  return window.confirm(message);
}
