"use strict";

// Next consecutive-stuck count after a scroll attempt. The mouse-wheel
// fallback can't measure scroll position, so it is treated as no confirmed
// progress; otherwise the scan loop would never terminate.
function nextStuckCount(scrollResult, stuck) {
  if (scrollResult.method === "element" && scrollResult.after !== scrollResult.before) {
    return 0;
  }
  return stuck + 1;
}

module.exports = { nextStuckCount };
