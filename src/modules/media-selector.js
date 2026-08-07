(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const MEDIA_SELECTOR = [
    ".bubble img.media-photo",
    ".bubble img.thumbnail",
    ".bubble video",
    ".message img.media-photo",
    ".message img.thumbnail",
    ".message video",
    "[data-message-id] img.media-photo",
    "[data-message-id] video",
  ].join(",");

  const getMediaUrl = (node) => node.currentSrc || node.src || node.querySelector?.("source")?.src || "";

  const findMessage = (node) =>
    node.closest?.(".bubble, .message, [data-mid], [data-message-id]") || node.parentElement;

  const findContainer = (node) => node.parentElement || findMessage(node);

  const extractMediaItem = (node, index = 0) => {
    const url = getMediaUrl(node);
    if (!url || /^(blob:|data:)/.test(url)) return null;
    const message = findMessage(node);
    const messageId =
      message?.dataset?.messageId || message?.dataset?.mid || message?.getAttribute?.("data-mid");
    const type = node.tagName?.toLowerCase() === "video" ? "video" : "image";
    const extension = type === "video" ? "mp4" : "jpg";
    const fileName = node.dataset?.filename || `${messageId || `telegram-${index}`}.${extension}`;
    return {
      id: `${messageId || index}:${url}`,
      url,
      type,
      fileName,
      node,
      message,
      container: findContainer(node),
    };
  };

  const createMediaSelector = ({ root = document, onChange } = {}) => {
    const items = new Map();
    let observer = null;

    const notify = () => onChange?.(Array.from(items.values()));

    const setSelected = (item, selected) => {
      item.selected = selected;
      item.checkbox.checked = selected;
      item.checkbox.setAttribute("aria-checked", String(selected));
      notify();
    };

    const attachControl = (item) => {
      if (!item.container || item.container.querySelector?.(".tel-batch-checkbox")) return;
      const checkbox = root.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "tel-batch-checkbox";
      checkbox.title = "Select media for batch download";
      checkbox.setAttribute("aria-label", `Select ${item.fileName}`);
      checkbox.style.cssText =
        "position:absolute;top:6px;right:6px;z-index:20;width:20px;height:20px;accent-color:#2aabee;";
      const position = root.defaultView?.getComputedStyle(item.container).position;
      if (position === "static") item.container.style.position = "relative";
      checkbox.addEventListener("change", () => setSelected(item, checkbox.checked));
      item.container.appendChild(checkbox);
      item.checkbox = checkbox;
      item.selected = false;
    };

    const scan = () => {
      root.querySelectorAll(MEDIA_SELECTOR).forEach((node, index) => {
        const item = extractMediaItem(node, index);
        if (!item || items.has(item.id)) return;
        items.set(item.id, item);
        attachControl(item);
      });
      notify();
      return Array.from(items.values());
    };

    const selectAll = (selected) => {
      items.forEach((item) => {
        if (item.checkbox) {
          item.selected = selected;
          item.checkbox.checked = selected;
        }
      });
      notify();
    };

    const getSelected = () => Array.from(items.values()).filter((item) => item.selected);

    if (root.body && typeof root.defaultView !== "undefined") {
      observer = new MutationObserver(scan);
      observer.observe(root.body, { childList: true, subtree: true });
    }
    scan();

    return {
      scan,
      selectAll,
      getSelected,
      getItems: () => Array.from(items.values()),
      destroy: () => observer?.disconnect(),
    };
  };

  return { MEDIA_SELECTOR, extractMediaItem, createMediaSelector };
});
