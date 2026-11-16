"use strict";
const fs = require("fs");
const path = require("path");

// Create `dir` with mode 0700 and tighten any existing contents:
// directories to 0700, files to 0600. Symlinks are skipped, never followed.
function ensureSecureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  tighten(dir);
}

function tighten(dir) {
  fs.chmodSync(dir, 0o700);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tighten(full);
    } else if (entry.isFile()) {
      fs.chmodSync(full, 0o600);
    }
  }
}

module.exports = { ensureSecureDir };
