"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { unreadSelector, markSeen, SEEN_ATTR } = require("../dry-run");

const BASE = "div.timestamp:not(.read)";

test("selector excludes rows already counted or skipped", () => {
  assert.strictEqual(unreadSelector(BASE), `${BASE}:not([${SEEN_ATTR}])`);
});

test("markSeen tags the row so it is not counted twice", async () => {
  const attrs = {};
  const el = { setAttribute: (k, v) => (attrs[k] = v) };
  const handle = { evaluate: async (fn, attr) => fn(el, attr) };
  await markSeen(handle);
  assert.ok(SEEN_ATTR in attrs);
});
