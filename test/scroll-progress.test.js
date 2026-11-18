"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { nextStuckCount } = require("../scroll-progress");

test("element scroll that moved resets the stuck counter", () => {
  assert.strictEqual(nextStuckCount({ method: "element", before: 0, after: 100 }, 3), 0);
});

test("element scroll that did not move increments the stuck counter", () => {
  assert.strictEqual(nextStuckCount({ method: "element", before: 100, after: 100 }, 3), 4);
});

test("mouse-wheel fallback cannot confirm progress, so it counts toward giving up", () => {
  assert.strictEqual(nextStuckCount({ method: "mouse-wheel-fallback" }, 3), 4);
});

test("repeated mouse-wheel fallback reaches any positive limit", () => {
  let stuck = 0;
  for (let i = 0; i < 5; i++) stuck = nextStuckCount({ method: "mouse-wheel-fallback" }, stuck);
  assert.ok(stuck >= 5);
});
