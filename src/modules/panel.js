(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const style = `
    #tel-batch-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:330px;background:#fff;color:#222;border:1px solid #d9dee5;border-radius:8px;box-shadow:0 8px 28px #0003;font:14px system-ui,sans-serif;overflow:hidden}
    #tel-batch-panel button{border:0;border-radius:4px;padding:7px 10px;cursor:pointer;background:#2aabee;color:#fff}
    #tel-batch-panel button.secondary{background:#eef2f5;color:#25313c}
    #tel-batch-panel button.danger{background:#d9534f}
    #tel-batch-panel .tel-batch-toolbar{display:flex;gap:6px;align-items:center;padding:10px;border-bottom:1px solid #e7ebef}
    #tel-batch-panel .tel-batch-drag-handle{cursor:move;user-select:none;padding:4px;color:#607080;font-weight:700}
    #tel-batch-panel .tel-batch-count{margin-left:auto;color:#607080}
    #tel-batch-panel .tel-batch-body{display:none;max-height:280px;overflow:auto;padding:8px}
    #tel-batch-panel.open .tel-batch-body{display:block}
    #tel-batch-panel .tel-batch-task{display:grid;grid-template-columns:1fr auto;gap:4px;padding:7px 2px;border-bottom:1px solid #edf0f2}
    #tel-batch-panel .tel-batch-task small{color:#697887;grid-column:1/-1}
    #tel-batch-panel .tel-batch-settings{display:none;padding:8px;border-top:1px solid #e7ebef}
    #tel-batch-panel.settings-open .tel-batch-settings{display:block}
    #tel-batch-panel label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0}
    #tel-batch-panel input[type=number]{width:54px}
  `;

  const createDownloadPanel = ({
    documentRef = document,
    initialSettings = { concurrency: 3 },
    onStart,
    onRetry,
    onCancel,
    onClear,
    onChooseDirectory,
    onSettingsChange,
  } = {}) => {
    const styleNode = documentRef.createElement("style");
    styleNode.textContent = style;
    documentRef.head.appendChild(styleNode);

    const panel = documentRef.createElement("section");
    panel.id = "tel-batch-panel";
    panel.setAttribute("aria-label", "Telegram batch downloader");
    panel.innerHTML = `
      <div class="tel-batch-toolbar">
        <span class="tel-batch-drag-handle" title="拖动面板">::</span>
        <button class="secondary tel-batch-select">全选</button>
        <button class="tel-batch-start">批量下载</button>
        <button class="secondary tel-batch-toggle" aria-expanded="false">队列</button>
        <span class="tel-batch-count">0/0</span>
      </div>
      <div class="tel-batch-body">
        <div class="tel-batch-tasks"></div>
        <button class="secondary tel-batch-clear">清理完成</button>
      </div>
      <div class="tel-batch-settings">
        <label>并发数 <input class="tel-batch-concurrency" type="number" min="1" max="8" value="${initialSettings.concurrency}"></label>
        <label>SHA 去重 <input class="tel-batch-dedupe" type="checkbox" ${initialSettings.dedupeEnabled !== false ? "checked" : ""}></label>
        <button class="secondary tel-batch-directory">选择下载目录</button>
        <span class="tel-batch-directory-status">未设置目录</span>
      </div>
      <button class="secondary tel-batch-settings-toggle" style="margin:8px">设置</button>
    `;
    documentRef.body.appendChild(panel);

    const count = panel.querySelector(".tel-batch-count");
    const tasksNode = panel.querySelector(".tel-batch-tasks");
    const selectedButton = panel.querySelector(".tel-batch-select");
    const dragHandle = panel.querySelector(".tel-batch-drag-handle");
    let dragState = null;

    const onPointerMove = (event) => {
      if (!dragState) return;
      panel.style.left = `${Math.max(0, dragState.left + event.clientX - dragState.x)}px`;
      panel.style.top = `${Math.max(0, dragState.top + event.clientY - dragState.y)}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    };
    const onPointerUp = () => {
      dragState = null;
      documentRef.removeEventListener("pointermove", onPointerMove);
      documentRef.removeEventListener("pointerup", onPointerUp);
    };
    dragHandle.onpointerdown = (event) => {
      const rect = panel.getBoundingClientRect();
      dragState = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      dragHandle.setPointerCapture?.(event.pointerId);
      documentRef.addEventListener("pointermove", onPointerMove);
      documentRef.addEventListener("pointerup", onPointerUp);
    };

    panel.querySelector(".tel-batch-toggle").onclick = () => {
      panel.classList.toggle("open");
      panel.querySelector(".tel-batch-toggle").setAttribute("aria-expanded", String(panel.classList.contains("open")));
    };
    panel.querySelector(".tel-batch-settings-toggle").onclick = () => panel.classList.toggle("settings-open");
    panel.querySelector(".tel-batch-start").onclick = () => onStart?.();
    panel.querySelector(".tel-batch-clear").onclick = () => onClear?.();
    panel.querySelector(".tel-batch-directory").onclick = async () => {
      const selected = await onChooseDirectory?.();
      if (selected) panel.querySelector(".tel-batch-directory-status").textContent = "目录已设置";
    };
    panel.querySelector(".tel-batch-concurrency").onchange = (event) =>
      onSettingsChange?.({ concurrency: event.target.value });
    panel.querySelector(".tel-batch-dedupe").onchange = (event) =>
      onSettingsChange?.({ dedupeEnabled: event.target.checked });

    return {
      updateItems(items, selectAll) {
        const selected = items.filter((item) => item.selected).length;
        count.textContent = `${selected}/${items.length}`;
        selectedButton.textContent = selected === items.length && items.length ? "取消全选" : "全选";
        selectedButton.onclick = () => selectAll?.(!(selected === items.length && items.length));
      },
      updateTasks(tasks) {
        tasksNode.replaceChildren();
        tasks.forEach((task) => {
          const row = documentRef.createElement("div");
          row.className = "tel-batch-task";
          const name = documentRef.createElement("span");
          name.textContent = task.fileName || task.id;
          const action = documentRef.createElement("button");
          action.className = "secondary";
          if (task.status === "failed") {
            action.textContent = "重试";
            action.onclick = () => onRetry?.(task.id);
          } else if (["queued", "downloading"].includes(task.status)) {
            action.textContent = "取消";
            action.onclick = () => onCancel?.(task.id);
          } else {
            action.textContent = task.status === "completed" ? "完成" : task.status;
            action.disabled = true;
          }
          const status = documentRef.createElement("small");
          status.textContent = `${task.status} ${Math.round(task.progress || 0)}%${task.error ? `: ${task.error}` : ""}`;
          row.append(name, action, status);
          tasksNode.appendChild(row);
        });
      },
      destroy() {
        onPointerUp();
        styleNode.remove();
        panel.remove();
      },
    };
  };

  return { createDownloadPanel };
});
