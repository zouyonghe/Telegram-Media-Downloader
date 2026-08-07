(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const DEFAULT_SETTINGS = {
    concurrency: 3,
    fallbackToBrowserDownload: true,
    dedupeEnabled: true,
  };

  const normalizeConcurrency = (value) => {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return DEFAULT_SETTINGS.concurrency;
    return Math.min(8, Math.max(1, number));
  };

  const normalizeSettings = (settings = {}) => ({
    concurrency: normalizeConcurrency(settings.concurrency),
    fallbackToBrowserDownload:
      settings.fallbackToBrowserDownload !== false,
    dedupeEnabled: settings.dedupeEnabled !== false,
  });

  const sanitizeFileName = (fileName, fallback = "telegram-media") => {
    const value = String(fileName || "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+$/, "");
    return (value || fallback).slice(0, 180);
  };

  return {
    DEFAULT_SETTINGS,
    normalizeConcurrency,
    normalizeSettings,
    sanitizeFileName,
  };
});
