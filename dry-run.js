"use strict";

// Dry-run never clicks rows, so an already-counted unread row keeps matching.
// Tag counted rows and exclude them so the count stops at the real end of the list.
const SEEN_ATTR = "data-gv-seen";

function unreadSelector(base, dryRun) {
  return dryRun ? `${base}:not([${SEEN_ATTR}])` : base;
}

function markSeen(rowHandle) {
  return rowHandle.evaluate((el, attr) => el.setAttribute(attr, "1"), SEEN_ATTR);
}

module.exports = { SEEN_ATTR, unreadSelector, markSeen };
