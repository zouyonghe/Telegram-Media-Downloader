import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const modules = [
  "src/modules/settings.js",
  "src/modules/storage.js",
  "src/modules/dedupe.js",
  "src/modules/transport.js",
  "src/modules/queue.js",
  "src/modules/media-selector.js",
  "src/modules/panel.js",
  "src/batch-entry.js",
];

await mkdir(new URL("dist/", root), { recursive: true });
const output = [await read("src/tel_download.js"), ...(await Promise.all(modules.map(read)))].join("\n\n");
await writeFile(new URL("dist/tel_download.user.js", root), output);
console.log("Built dist/tel_download.user.js");
