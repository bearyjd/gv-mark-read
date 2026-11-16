"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ensureSecureDir } = require("../secure-dir");

const mode = (p) => fs.statSync(p).mode & 0o777;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gv-secure-"));

test("creates a new directory with mode 0700", () => {
  const dir = path.join(tmp(), "profile");
  ensureSecureDir(dir);
  assert.strictEqual(mode(dir), 0o700);
});

test("tightens existing directories and files", () => {
  const dir = path.join(tmp(), "profile");
  fs.mkdirSync(path.join(dir, "Default"), { recursive: true, mode: 0o755 });
  fs.chmodSync(dir, 0o755);
  fs.chmodSync(path.join(dir, "Default"), 0o755);
  const file = path.join(dir, "Default", "Cookies");
  fs.writeFileSync(file, "x", { mode: 0o644 });
  fs.chmodSync(file, 0o644);
  ensureSecureDir(dir);
  assert.strictEqual(mode(dir), 0o700);
  assert.strictEqual(mode(path.join(dir, "Default")), 0o700);
  assert.strictEqual(mode(file), 0o600);
});

test("does not follow symlinks", () => {
  const root = tmp();
  const outside = path.join(root, "outside");
  fs.writeFileSync(outside, "x", { mode: 0o644 });
  fs.chmodSync(outside, 0o644);
  const dir = path.join(root, "profile");
  fs.mkdirSync(dir);
  fs.symlinkSync(outside, path.join(dir, "link"));
  ensureSecureDir(dir);
  assert.strictEqual(mode(outside), 0o644);
});
