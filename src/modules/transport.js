(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const host = typeof globalThis !== "undefined" ? globalThis : window;
  const RANGE_PATTERN = /^bytes (\d+)-(\d+)\/(\d+)$/;

  const createTransport = ({
    fetchImpl = host.fetch,
    directoryStorage = null,
    browserDownload = null,
    sanitizeFileName = (name) => name,
    preferDirectDownload = true,
    dedupeRegistry = null,
    dedupeEnabled = true,
    digestBlob = null,
    confirmDuplicate = async () => false,
  } = {}) => {
    const directBrowserDownload = (url, fileName) => {
      if (browserDownload) return browserDownload(url, fileName);
      const anchor = host.document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      host.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    };

    const streamResponse = async (response, writable, onChunk) => {
      if (!response.body || typeof response.body.getReader !== "function") {
        const blob = await response.blob();
        onChunk(blob);
        await writable.write(blob);
        return;
      }
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        onChunk(value);
        await writable.write(value);
      }
    };

    const streamToDirectory = async (task, directoryHandle, onProgress, signal) => {
      const fileName = sanitizeFileName(task.fileName || "telegram-media");
      const tempFileName = `.tel-downloader-${Date.now()}-${Math.random().toString(36).slice(2)}.part`;
      const fileHandle = await directoryHandle.getFileHandle(tempFileName, { create: true });
      const writable = await fileHandle.createWritable();
      const chunks = [];
      let received = 0;
      let offset = 0;
      let total = null;
      const collectChunk = (chunk) => {
        chunks.push(chunk);
        received += chunk.size ?? chunk.byteLength ?? 0;
      };

      try {
        while (total === null || offset < total) {
          const response = await fetchImpl(task.url, {
            method: "GET",
            headers: { Range: `bytes=${offset}-` },
            signal,
          });
          if (![200, 206].includes(response.status)) {
            throw new Error(`Download failed with status ${response.status}`);
          }
          const range = response.headers.get("Content-Range");
          if (!range) {
            const length = Number(response.headers.get("Content-Length"));
            await streamResponse(response, writable, collectChunk);
            total = Number.isFinite(length) ? length : received;
            offset = received;
          } else {
            const match = range.match(RANGE_PATTERN);
            if (!match || Number(match[1]) !== offset) {
              throw new Error("Invalid or discontinuous content range");
            }
            total = Number(match[3]);
            await streamResponse(response, writable, collectChunk);
            offset = Number(match[2]) + 1;
          }
          onProgress(total ? (offset * 100) / total : 0);
        }
        await writable.close();
        const blob = new Blob(chunks, { type: task.mimeType || "application/octet-stream" });
        return {
          blob,
          sha: digestBlob ? await digestBlob(blob) : null,
          tempFileName,
        };
      } catch (error) {
        if (typeof writable.abort === "function") await writable.abort();
        throw error;
      }
    };

    return async (task, onProgress, signal) => {
      const fileName = sanitizeFileName(task.fileName || "telegram-media");
      if (dedupeEnabled && dedupeRegistry?.hasUrl(task.url)) {
        if (!(await confirmDuplicate(task))) {
          onProgress(100);
          return "duplicate";
        }
      }
      let directoryHandle = null;
      if (directoryStorage) {
        try {
          directoryHandle = await directoryStorage.get();
        } catch (_error) {
          directoryHandle = null;
        }
      }

      if (preferDirectDownload && !directoryHandle && task.url) {
        await directBrowserDownload(task.url, fileName);
        dedupeRegistry?.remember(task.url, null);
        onProgress(100);
        return "browser-direct";
      }

      if (directoryHandle && directoryStorage) {
        let permission = false;
        try {
          permission = await (directoryStorage.ensurePermission
            ? directoryStorage.ensurePermission(directoryHandle)
            : true);
        } catch (_error) {
          permission = false;
        }
        if (permission) {
          const result = await streamToDirectory(task, directoryHandle, onProgress, signal);
          if (dedupeEnabled && result.sha && dedupeRegistry?.hasSha(result.sha)) {
            if (!(await confirmDuplicate(task, result.sha))) {
              if (typeof directoryHandle.removeEntry === "function") {
                await directoryHandle.removeEntry(result.tempFileName).catch(() => {});
              }
              return "duplicate";
            }
          }
          const finalHandle = await directoryHandle.getFileHandle(fileName, { create: true });
          const finalWritable = await finalHandle.createWritable();
          await finalWritable.write(result.blob);
          await finalWritable.close();
          if (typeof directoryHandle.removeEntry === "function") {
            await directoryHandle.removeEntry(result.tempFileName).catch(() => {});
          }
          dedupeRegistry?.remember(task.url, result.sha);
          return "directory";
        }
      }
      if (task.url) {
        await directBrowserDownload(task.url, fileName);
        onProgress(100);
        return "browser-direct";
      }
      throw new Error("Media URL is missing");
    };
  };

  return { createTransport };
});
