"use strict";
const fs = require("fs");
const path = require("path");

// Create `dir` with mode 0700 and tighten any existing contents:
// clear group/other bits on directories and files, keeping the owner's own
// bits (so owner exec is preserved). Symlinks inside the tree are skipped.
function ensureSecureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  tighten(dir);
}

function chmodOwnerOnly(p) {
  try {
    fs.chmodSync(p, fs.lstatSync(p).mode & 0o700);
  } catch (err) {
    if (err.code !== "EPERM") throw err;
    console.warn(`warning: could not tighten permissions on ${p}: ${err.message}`);
  }
}

function tighten(dir) {
  chmodOwnerOnly(dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tighten(full);
    } else if (entry.isFile()) {
      chmodOwnerOnly(full);
    }
  }
}

module.exports = { ensureSecureDir };
