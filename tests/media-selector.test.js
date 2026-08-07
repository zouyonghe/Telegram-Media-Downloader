const test = require("node:test");
const assert = require("node:assert/strict");
const { extractMediaItem, selectionSnapshot } = require("../src/modules/media-selector.js");

test("produces stable snapshots for unchanged selections", () => {
  const items = [{ id: "one", selected: false }, { id: "two", selected: true }];
  assert.equal(selectionSnapshot(items), selectionSnapshot(items.map((item) => ({ ...item }))));
});

test("extracts stable metadata from outer media node", () => {
  const message = {
    dataset: { messageId: "42" },
    closest: () => message,
  };
  const container = { parentElement: null };
  container.parentElement = message;
  const node = {
    tagName: "VIDEO",
    currentSrc: "https://telegram.test/media/42",
    dataset: {},
    closest: () => message,
    parentElement: container,
  };

  assert.deepEqual(extractMediaItem(node), {
    id: "42:https://telegram.test/media/42",
    url: "https://telegram.test/media/42",
    type: "video",
    fileName: "42.mp4",
    node,
    message,
    container,
  });
});

test("ignores blob and data URLs", () => {
  assert.equal(extractMediaItem({ src: "blob:test", tagName: "IMG" }), null);
  assert.equal(extractMediaItem({ src: "data:image/png;base64,x", tagName: "IMG" }), null);
});
