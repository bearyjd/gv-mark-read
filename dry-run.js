"use strict";

// A row that is not clicked (dry-run count, or a failed click that is being
// skipped) keeps matching the unread selector. Tag it and exclude tagged rows
// so the loop moves past it and stops at the real end of the list.
const SEEN_ATTR = "data-gv-seen";

function unreadSelector(base) {
  return `${base}:not([${SEEN_ATTR}])`;
}

function markSeen(rowHandle) {
  return rowHandle.evaluate((el, attr) => el.setAttribute(attr, "1"), SEEN_ATTR);
}

// Failure-path variant: the row may have detached or its context been destroyed,
// in which case evaluate rejects. Log and carry on rather than killing the run.
async function tryMarkSeen(rowHandle) {
  try {
    await markSeen(rowHandle);
  } catch (err) {
    console.warn("Could not tag failed row, continuing:", err.message);
  }
}

module.exports = { SEEN_ATTR, unreadSelector, markSeen, tryMarkSeen };
