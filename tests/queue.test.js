const test = require("node:test");
const assert = require("node:assert/strict");
const { DownloadQueue } = require("../src/modules/queue.js");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("limits active downloads to configured concurrency", async () => {
  let active = 0;
  let peak = 0;
  const queue = new DownloadQueue({
    concurrency: 2,
    transport: async (_task, progress) => {
      active += 1;
      peak = Math.max(peak, active);
      progress(50);
      await wait(10);
      active -= 1;
    },
  });

  queue.enqueue(["a", "b", "c", "d"].map((id) => ({ id })));
  await wait(50);

  assert.equal(peak, 2);
  assert.deepEqual(queue.getTasks().map((task) => task.status), [
    "completed",
    "completed",
    "completed",
    "completed",
  ]);
});

test("isolates failures and supports retry", async () => {
  let attempts = 0;
  const queue = new DownloadQueue({
    concurrency: 1,
    transport: async (task) => {
      attempts += 1;
      if (task.id === "bad" && attempts === 1) throw new Error("network");
    },
  });

  queue.enqueue([{ id: "bad" }, { id: "good" }]);
  await wait(20);
  assert.equal(queue.getTasks()[0].status, "failed");
  assert.equal(queue.getTasks()[1].status, "completed");
  assert.equal(queue.retry("bad"), true);
  await wait(20);
  assert.equal(queue.getTasks()[0].status, "completed");
});

test("cancels queued tasks without starting transport", async () => {
  let started = 0;
  const queue = new DownloadQueue({
    concurrency: 1,
    transport: async () => {
      started += 1;
      await wait(20);
    },
  });

  queue.enqueue([{ id: "first" }, { id: "second" }]);
  queue.cancel("second");
  await wait(30);

  assert.equal(started, 1);
  assert.equal(queue.getTasks()[1].status, "cancelled");
});
