(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const STORAGE_KEY = "tel-downloader-dedupe-v1";

  const digestBlob = async (blob) => {
    const cryptoApi =
      typeof unsafeWindow !== "undefined" ? unsafeWindow.crypto : globalThis.crypto;
    if (!cryptoApi?.subtle) return null;
    const buffer = await blob.arrayBuffer();
    const digest = await cryptoApi.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  };

  const createDedupeRegistry = ({ storage } = {}) => {
    const backend = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    let entries = new Map();
    try {
      entries = new Map(Object.entries(JSON.parse(backend?.getItem(STORAGE_KEY) || "{}")));
    } catch (_error) {
      entries = new Map();
    }

    const persist = () => {
      try {
        backend?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
      } catch (_error) {
        // Dedupe remains active for current page when storage is unavailable.
      }
    };

    return {
      hasUrl: (url) => entries.has(`url:${url}`),
      hasSha: (sha) => Boolean(sha) && entries.has(`sha:${sha}`),
      remember: (url, sha) => {
        if (url) entries.set(`url:${url}`, sha || "known");
        if (sha) entries.set(`sha:${sha}`, url || "known");
        persist();
      },
      clear: () => {
        entries.clear();
        persist();
      },
    };
  };

  return { digestBlob, createDedupeRegistry };
});
