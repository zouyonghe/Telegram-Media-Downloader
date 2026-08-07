const test = require("node:test");
const assert = require("node:assert/strict");
const { createDedupeRegistry } = require("../src/modules/dedupe.js");

test("persists URL and SHA duplicate markers", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const first = createDedupeRegistry({ storage });
  first.remember("telegram://one", "abc123");

  const second = createDedupeRegistry({ storage });
  assert.equal(second.hasUrl("telegram://one"), true);
  assert.equal(second.hasSha("abc123"), true);
  assert.equal(second.hasSha("other"), false);
});
