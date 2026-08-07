const test = require("node:test");
const assert = require("node:assert/strict");
const { createTransport } = require("../src/modules/transport.js");

const textOf = async (chunk) =>
  typeof chunk.text === "function"
    ? chunk.text()
    : new TextDecoder().decode(chunk);

test("uses direct browser streaming when no directory is selected", async () => {
  const saved = [];
  const transport = createTransport({
    directoryStorage: { get: async () => null },
    browserDownload: async (url, fileName) => saved.push([url, fileName]),
    sanitizeFileName: (name) => name,
  });

  const progress = [];
  await transport({ url: "telegram://media", fileName: "clip.mp4" }, (value) => progress.push(value), new AbortController().signal);

  assert.deepEqual(saved, [["telegram://media", "clip.mp4"]]);
  assert.equal(progress.at(-1), 100);
});

test("asks before downloading a previously seen URL", async () => {
  let downloads = 0;
  const transport = createTransport({
    directoryStorage: { get: async () => null },
    dedupeRegistry: { hasUrl: () => true, remember: () => {} },
    confirmDuplicate: async () => false,
    browserDownload: async () => {
      downloads += 1;
    },
  });

  const result = await transport({ url: "telegram://duplicate", fileName: "same.jpg" }, () => {}, new AbortController().signal);
  assert.equal(result, "duplicate");
  assert.equal(downloads, 0);
});

test("uses range transport when a directory is selected", async () => {
  const requests = [];
  const responses = [
    new Response("abc", {
      status: 206,
      headers: { "Content-Range": "bytes 0-2/6" },
    }),
    new Response("def", {
      status: 206,
      headers: { "Content-Range": "bytes 3-5/6" },
    }),
  ];
  const writes = [];
  const transport = createTransport({
    fetchImpl: async (_url, options) => {
      requests.push(options.headers.Range);
      return responses.shift();
    },
    directoryStorage: {
      get: async () => ({
        getFileHandle: async () => ({
          createWritable: async () => ({
            write: async (chunk) => writes.push(await textOf(chunk)),
            close: async () => {},
          }),
        }),
      }),
      ensurePermission: async () => true,
    },
  });

  await transport({ url: "telegram://media", fileName: "clip.mp4" }, () => {}, new AbortController().signal);
  assert.deepEqual(requests, ["bytes=0-", "bytes=3-"]);
  assert.deepEqual(writes, ["abc", "def", "abcdef"]);
});

test("writes to selected directory before browser fallback", async () => {
  const writes = [];
  const transport = createTransport({
    fetchImpl: async () => new Response("image", { status: 200 }),
    directoryStorage: {
      get: async () => ({
        getFileHandle: async () => ({
          createWritable: async () => ({
            write: async (chunk) => writes.push(await textOf(chunk)),
            close: async () => {},
          }),
        }),
      }),
      ensurePermission: async () => true,
    },
    browserDownload: () => assert.fail("should not use browser fallback"),
  });

  await transport({ url: "telegram://image", fileName: "image.jpg" }, () => {}, new AbortController().signal);
  assert.deepEqual(writes, ["image", "image"]);
});
