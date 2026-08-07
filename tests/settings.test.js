const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeConcurrency,
  normalizeSettings,
  sanitizeFileName,
} = require("../src/modules/settings.js");

test("normalizes concurrency to supported range", () => {
  assert.equal(normalizeConcurrency(0), 1);
  assert.equal(normalizeConcurrency(99), 8);
  assert.equal(normalizeConcurrency("invalid"), 3);
});

test("keeps safe settings defaults", () => {
  assert.deepEqual(normalizeSettings({}), {
    concurrency: 3,
    fallbackToBrowserDownload: true,
    dedupeEnabled: true,
  });
  assert.equal(normalizeSettings({ fallbackToBrowserDownload: false }).fallbackToBrowserDownload, false);
});

test("sanitizes path separators and control characters", () => {
  assert.equal(sanitizeFileName("../video:one?.mp4"), ".._video_one_.mp4");
  assert.equal(sanitizeFileName("..."), "telegram-media");
});
