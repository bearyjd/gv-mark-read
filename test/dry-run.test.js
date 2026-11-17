"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { unreadSelector, markSeen, SEEN_ATTR } = require("../dry-run");

const BASE = "div.timestamp:not(.read)";

test("non-dry-run selector is unchanged", () => {
  assert.strictEqual(unreadSelector(BASE, false), BASE);
});

test("dry-run selector excludes rows already counted", () => {
  assert.strictEqual(unreadSelector(BASE, true), `${BASE}:not([${SEEN_ATTR}])`);
});

test("markSeen tags the row so it is not counted twice", async () => {
  const attrs = {};
  const el = { setAttribute: (k, v) => (attrs[k] = v) };
  const handle = { evaluate: async (fn, attr) => fn(el, attr) };
  await markSeen(handle);
  assert.ok(SEEN_ATTR in attrs);
});
