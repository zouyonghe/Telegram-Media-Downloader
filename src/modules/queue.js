(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  class DownloadQueue {
    constructor({ transport, concurrency = 3 } = {}) {
      if (typeof transport !== "function") {
        throw new TypeError("DownloadQueue requires transport function");
      }
      this.transport = transport;
      this.concurrency = Math.min(8, Math.max(1, Number(concurrency) || 3));
      this.tasks = new Map();
      this.listeners = new Set();
      this.active = 0;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    emit() {
      const snapshot = this.getTasks();
      this.listeners.forEach((listener) => listener(snapshot));
    }

    getTasks() {
      return Array.from(this.tasks.values()).map((task) => ({ ...task }));
    }

    setConcurrency(value) {
      this.concurrency = Math.min(8, Math.max(1, Number(value) || 1));
      this.schedule();
    }

    enqueue(items) {
      const added = [];
      items.forEach((item, index) => {
        const id = item.id || `${Date.now()}-${index}-${Math.random()}`;
        if (this.tasks.has(id)) return;
        const controller = new AbortController();
        const task = {
          ...item,
          id,
          status: "queued",
          progress: 0,
          error: null,
          controller,
        };
        this.tasks.set(id, task);
        added.push({ ...task });
      });
      this.emit();
      this.schedule();
      return added;
    }

    retry(id) {
      const task = this.tasks.get(id);
      if (!task || task.status !== "failed") return false;
      task.status = "queued";
      task.progress = 0;
      task.error = null;
      task.controller = new AbortController();
      this.emit();
      this.schedule();
      return true;
    }

    cancel(id) {
      const task = this.tasks.get(id);
      if (!task || ["completed", "failed", "cancelled"].includes(task.status)) {
        return false;
      }
      task.controller.abort();
      if (task.status === "queued") task.status = "cancelled";
      this.emit();
      this.schedule();
      return true;
    }

    clearCompleted() {
      this.tasks.forEach((task, id) => {
        if (["completed", "cancelled"].includes(task.status)) {
          this.tasks.delete(id);
        }
      });
      this.emit();
    }

    schedule() {
      while (this.active < this.concurrency) {
        const task = Array.from(this.tasks.values()).find(
          (candidate) => candidate.status === "queued"
        );
        if (!task) return;
        this.run(task);
      }
    }

    async run(task) {
      this.active += 1;
      task.status = "downloading";
      this.emit();
      try {
        await this.transport(task, (progress) => {
          task.progress = Math.max(0, Math.min(100, Number(progress) || 0));
          this.emit();
        }, task.controller.signal);
        task.progress = 100;
        task.status = "completed";
      } catch (error) {
        task.status = task.controller.signal.aborted ? "cancelled" : "failed";
        task.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.active -= 1;
        this.emit();
        this.schedule();
      }
    }
  }

  return { DownloadQueue };
});
