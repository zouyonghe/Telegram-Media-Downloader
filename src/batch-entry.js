(function () {
  const api = globalThis.TelDownloader;
  if (!api || !api.DownloadQueue || !api.createMediaSelector || !api.createDownloadPanel) return;

  const loadSettings = () => {
    try {
      return api.normalizeSettings(JSON.parse(localStorage.getItem("tel-downloader-settings") || "{}"));
    } catch (_error) {
      return api.normalizeSettings();
    }
  };

  const saveSettings = (settings) => {
    try {
      localStorage.setItem("tel-downloader-settings", JSON.stringify(api.normalizeSettings(settings)));
    } catch (_error) {
      // Settings remain available for the current page session.
    }
  };

  const settings = loadSettings();
  const dedupeRegistry = api.createDedupeRegistry();
  const directoryStore = api.createDirectoryStorage();
  const directoryStorage = {
    get: async () => {
      try {
        return await directoryStore.get();
      } catch (_error) {
        return null;
      }
    },
    ensurePermission: api.ensureDirectoryPermission,
  };
  const browserDownload = (url, fileName) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };
  const transport = api.createTransport({
    directoryStorage,
    browserDownload,
    sanitizeFileName: api.sanitizeFileName,
    dedupeRegistry,
    dedupeEnabled: settings.dedupeEnabled,
    digestBlob: api.digestBlob,
    confirmDuplicate: (task, sha) =>
      globalThis.confirm?.(
        sha
          ? `检测到相同 SHA-256 文件，仍要下载 ${task.fileName} 吗？`
          : `文件可能已经下载过，仍要下载 ${task.fileName} 吗？`
      ) ?? false,
  });
  const queue = new api.DownloadQueue({ transport, concurrency: settings.concurrency });
  let selector;
  const panel = api.createDownloadPanel({
    initialSettings: settings,
    onStart: () => {
      const selected = selector.getSelected();
      queue.enqueue(selected.map(({ id, url, type, fileName }) => ({ id, url, type, fileName })));
      selector.selectAll(false);
    },
    onRetry: (id) => queue.retry(id),
    onCancel: (id) => queue.cancel(id),
    onClear: () => queue.clearCompleted(),
    onChooseDirectory: async () => {
      try {
        await directoryStore.choose();
        return true;
      } catch (_error) {
        return false;
      }
    },
    onSettingsChange: (change) => {
      Object.assign(settings, api.normalizeSettings({ ...settings, ...change }));
      queue.setConcurrency(settings.concurrency);
      saveSettings(settings);
    },
  });
  selector = api.createMediaSelector({
    onChange: (items) => panel.updateItems(items, (selected) => selector.selectAll(selected)),
  });
  queue.subscribe((tasks) => panel.updateTasks(tasks));
})();
