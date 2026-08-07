(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const DB_NAME = "telegram-media-downloader";
  const STORE_NAME = "settings";
  const DIRECTORY_KEY = "download-directory";

  const createDirectoryStorage = ({ indexedDBImpl } = {}) => {
    const pageWindow =
      typeof unsafeWindow !== "undefined" ? unsafeWindow : globalThis;
    const indexedDBApi = indexedDBImpl || pageWindow.indexedDB;

    const open = () =>
      new Promise((resolve, reject) => {
        if (!indexedDBApi) {
          reject(new Error("IndexedDB is unavailable"));
          return;
        }
        const request = indexedDBApi.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("IndexedDB error"));
      });

    const read = async () => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db
          .transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .get(DIRECTORY_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    };

    const write = async (handle) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);
        transaction.oncomplete = () => resolve(handle);
        transaction.onerror = () => reject(transaction.error);
      });
    };

    return {
      isSupported: () =>
        typeof pageWindow.showDirectoryPicker === "function" && !!indexedDBApi,
      get: read,
      set: write,
      clear: async () => {
        const db = await open();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, "readwrite");
          transaction.objectStore(STORE_NAME).delete(DIRECTORY_KEY);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
        });
      },
      choose: async () => {
        if (typeof pageWindow.showDirectoryPicker !== "function") {
          throw new Error("Directory picker is unavailable");
        }
        const handle = await pageWindow.showDirectoryPicker({ mode: "readwrite" });
        await write(handle);
        return handle;
      },
    };
  };

  const ensureDirectoryPermission = async (handle) => {
    if (!handle) return false;
    if (typeof handle.queryPermission !== "function") return true;
    const permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission === "granted") return true;
    if (typeof handle.requestPermission !== "function") return false;
    return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
  };

  return { createDirectoryStorage, ensureDirectoryPermission };
});
