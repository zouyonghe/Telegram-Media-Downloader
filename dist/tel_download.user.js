// ==UserScript==
// @name         Telegram Media Downloader
// @name:en      Telegram Media Downloader
// @name:zh-CN   Telegram 受限图片视频下载器
// @name:zh-TW   Telegram 受限圖片影片下載器
// @name:ru      Telegram: загрузчик медиафайлов
// @version      1.212
// @namespace    https://github.com/Neet-Nestor/Telegram-Media-Downloader
// @description  Download images, GIFs, videos, and voice messages on the Telegram webapp from private channels that disable downloading and restrict saving content
// @description:en  Download images, GIFs, videos, and voice messages on the Telegram webapp from private channels that disable downloading and restrict saving content
// @description:ru Загружайте изображения, GIF-файлы, видео и голосовые сообщения в веб-приложении Telegram из частных каналов, которые отключили загрузку и ограничили сохранение контента
// @description:zh-CN 从禁止下载的Telegram频道中下载图片、视频及语音消息
// @description:zh-TW 從禁止下載的 Telegram 頻道中下載圖片、影片及語音訊息
// @author       Nestor Qin
// @license      GNU GPLv3
// @website      https://github.com/Neet-Nestor/Telegram-Media-Downloader
// @match        https://web.telegram.org/*
// @match        https://webk.telegram.org/*
// @match        https://webz.telegram.org/*
// @icon         https://img.icons8.com/color/452/telegram-app--v5.png
// ==/UserScript==


(function () {
  const logger = {
    info: (message, fileName = null) => {
      console.log(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
    error: (message, fileName = null) => {
      console.error(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
  };
  // Unicode values for icons (used in /k/ app)
  // https://github.com/morethanwords/tweb/blob/master/src/icons.ts
  const DOWNLOAD_ICON = "\ue979";
  const FORWARD_ICON = "\ue99a";
  const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;
  const REFRESH_DELAY = 500;
  const hashCode = (s) => {
    var h = 0,
      l = s.length,
      i = 0;
    if (l > 0) {
      while (i < l) {
        h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
      }
    }
    return h >>> 0;
  };

  const createProgressBar = (videoId, fileName) => {
    const isDarkMode =
      document.querySelector("html").classList.contains("night") ||
      document.querySelector("html").classList.contains("theme-dark");
    const container = document.getElementById(
      "tel-downloader-progress-bar-container"
    );
    const innerContainer = document.createElement("div");
    innerContainer.id = "tel-downloader-progress-" + videoId;
    innerContainer.style.width = "20rem";
    innerContainer.style.marginTop = "0.4rem";
    innerContainer.style.padding = "0.6rem";
    innerContainer.style.backgroundColor = isDarkMode
      ? "rgba(0,0,0,0.3)"
      : "rgba(0,0,0,0.6)";

    const flexContainer = document.createElement("div");
    flexContainer.style.display = "flex";
    flexContainer.style.justifyContent = "space-between";

    const title = document.createElement("p");
    title.className = "filename";
    title.style.margin = 0;
    title.style.color = "white";
    title.innerText = fileName;

    const closeButton = document.createElement("div");
    closeButton.style.cursor = "pointer";
    closeButton.style.fontSize = "1.2rem";
    closeButton.style.color = isDarkMode ? "#8a8a8a" : "white";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = function () {
      container.removeChild(innerContainer);
    };

    const progressBar = document.createElement("div");
    progressBar.className = "progress";
    progressBar.style.backgroundColor = "#e2e2e2";
    progressBar.style.position = "relative";
    progressBar.style.width = "100%";
    progressBar.style.height = "1.6rem";
    progressBar.style.borderRadius = "2rem";
    progressBar.style.overflow = "hidden";

    const counter = document.createElement("p");
    counter.style.position = "absolute";
    counter.style.zIndex = 5;
    counter.style.left = "50%";
    counter.style.top = "50%";
    counter.style.transform = "translate(-50%, -50%)";
    counter.style.margin = 0;
    counter.style.color = "black";
    const progress = document.createElement("div");
    progress.style.position = "absolute";
    progress.style.height = "100%";
    progress.style.width = "0%";
    progress.style.backgroundColor = "#6093B5";

    progressBar.appendChild(counter);
    progressBar.appendChild(progress);
    flexContainer.appendChild(title);
    flexContainer.appendChild(closeButton);
    innerContainer.appendChild(flexContainer);
    innerContainer.appendChild(progressBar);
    container.appendChild(innerContainer);
  };

  const updateProgress = (videoId, fileName, progress) => {
    const innerContainer = document.getElementById(
      "tel-downloader-progress-" + videoId
    );
    innerContainer.querySelector("p.filename").innerText = fileName;
    const progressBar = innerContainer.querySelector("div.progress");
    progressBar.querySelector("p").innerText = progress + "%";
    progressBar.querySelector("div").style.width = progress + "%";
  };

  const completeProgress = (videoId) => {
    const progressBar = document
      .getElementById("tel-downloader-progress-" + videoId)
      .querySelector("div.progress");
    progressBar.querySelector("p").innerText = "Completed";
    progressBar.querySelector("div").style.backgroundColor = "#B6C649";
    progressBar.querySelector("div").style.width = "100%";
  };

  const AbortProgress = (videoId) => {
    const progressBar = document
      .getElementById("tel-downloader-progress-" + videoId)
      .querySelector("div.progress");
    progressBar.querySelector("p").innerText = "Aborted";
    progressBar.querySelector("div").style.backgroundColor = "#D16666";
    progressBar.querySelector("div").style.width = "100%";
  };

  const tel_download_video = (url) => {
    let _blobs = [];
    let _next_offset = 0;
    let _total_size = null;
    let _file_extension = "mp4";

    const videoId =
      (Math.random() + 1).toString(36).substring(2, 10) +
      "_" +
      Date.now().toString();
    let fileName = hashCode(url).toString(36) + "." + _file_extension;

    // Some video src is in format:
    // 'stream/{"dcId":5,"location":{...},"size":...,"mimeType":"video/mp4","fileName":"xxxx.MP4"}'
    try {
      const metadata = JSON.parse(
        decodeURIComponent(url.split("/")[url.split("/").length - 1])
      );
      if (metadata.fileName) {
        fileName = metadata.fileName;
      }
    } catch (e) {
      // Invalid JSON string, pass extracting fileName
    }
    logger.info(`URL: ${url}`, fileName);

    const fetchNextPart = (_writable) => {
      fetch(url, {
        method: "GET",
        headers: {
          Range: `bytes=${_next_offset}-`,
        },
        "User-Agent":
          "User-Agent Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0",
      })
        .then((res) => {
          if (![200, 206].includes(res.status)) {
            throw new Error("Non 200/206 response was received: " + res.status);
          }
          const mime = res.headers.get("Content-Type").split(";")[0];
          if (!mime.startsWith("video/")) {
            throw new Error("Get non video response with MIME type " + mime);
          }
          _file_extension = mime.split("/")[1];
          fileName =
            fileName.substring(0, fileName.indexOf(".") + 1) + _file_extension;

          const match = res.headers
            .get("Content-Range")
            .match(contentRangeRegex);

          const startOffset = parseInt(match[1]);
          const endOffset = parseInt(match[2]);
          const totalSize = parseInt(match[3]);

          if (startOffset !== _next_offset) {
            logger.error("Gap detected between responses.", fileName);
            logger.info("Last offset: " + _next_offset, fileName);
            logger.info("New start offset " + match[1], fileName);
            throw "Gap detected between responses.";
          }
          if (_total_size && totalSize !== _total_size) {
            logger.error("Total size differs", fileName);
            throw "Total size differs";
          }

          _next_offset = endOffset + 1;
          _total_size = totalSize;

          logger.info(
            `Get response: ${res.headers.get(
              "Content-Length"
            )} bytes data from ${res.headers.get("Content-Range")}`,
            fileName
          );
          logger.info(
            `Progress: ${((_next_offset * 100) / _total_size).toFixed(0)}%`,
            fileName
          );
          updateProgress(
            videoId,
            fileName,
            ((_next_offset * 100) / _total_size).toFixed(0)
          );
          return res.blob();
        })
        .then((resBlob) => {
          if (_writable !== null) {
            _writable.write(resBlob).then(() => {});
          } else {
            _blobs.push(resBlob);
          }
        })
        .then(() => {
          if (!_total_size) {
            throw new Error("_total_size is NULL");
          }

          if (_next_offset < _total_size) {
            fetchNextPart(_writable);
          } else {
            if (_writable !== null) {
              _writable.close().then(() => {
                logger.info("Download finished", fileName);
              });
            } else {
              save();
            }
            completeProgress(videoId);
          }
        })
        .catch((reason) => {
          logger.error(reason, fileName);
          AbortProgress(videoId);
        });
    };

    const save = () => {
      logger.info("Finish downloading blobs", fileName);
      logger.info("Concatenating blobs and downloading...", fileName);

      const blob = new Blob(_blobs, { type: "video/mp4" });
      const blobUrl = window.URL.createObjectURL(blob);

      logger.info("Final blob size: " + blob.size + " bytes", fileName);

      const a = document.createElement("a");
      document.body.appendChild(a);
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      logger.info("Download triggered", fileName);
    };

    const supportsFileSystemAccess =
      "showSaveFilePicker" in unsafeWindow &&
      (() => {
        try {
          return unsafeWindow.self === unsafeWindow.top;
        } catch {
          return false;
        }
      })();
    if (supportsFileSystemAccess) {
      unsafeWindow
        .showSaveFilePicker({
          suggestedName: fileName,
        })
        .then((handle) => {
          handle
            .createWritable()
            .then((writable) => {
              fetchNextPart(writable);
              createProgressBar(videoId);
            })
            .catch((err) => {
              console.error(err.name, err.message);
            });
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error(err.name, err.message);
          }
        });
    } else {
      fetchNextPart(null);
      createProgressBar(videoId);
    }
  };

  const tel_download_audio = (url) => {
    let _blobs = [];
    let _next_offset = 0;
    let _total_size = null;
    const fileName = hashCode(url).toString(36) + ".ogg";

    const fetchNextPart = (_writable) => {
      fetch(url, {
        method: "GET",
        headers: {
          Range: `bytes=${_next_offset}-`,
        },
      })
        .then((res) => {
          if (res.status !== 206 && res.status !== 200) {
            logger.error(
              "Non 200/206 response was received: " + res.status,
              fileName
            );
            return;
          }

          const mime = res.headers.get("Content-Type").split(";")[0];
          if (!mime.startsWith("audio/")) {
            logger.error(
              "Get non audio response with MIME type " + mime,
              fileName
            );
            throw "Get non audio response with MIME type " + mime;
          }

          try {
            const match = res.headers
              .get("Content-Range")
              .match(contentRangeRegex);

            const startOffset = parseInt(match[1]);
            const endOffset = parseInt(match[2]);
            const totalSize = parseInt(match[3]);

            if (startOffset !== _next_offset) {
              logger.error("Gap detected between responses.");
              logger.info("Last offset: " + _next_offset);
              logger.info("New start offset " + match[1]);
              throw "Gap detected between responses.";
            }
            if (_total_size && totalSize !== _total_size) {
              logger.error("Total size differs");
              throw "Total size differs";
            }

            _next_offset = endOffset + 1;
            _total_size = totalSize;
          } finally {
            logger.info(
              `Get response: ${res.headers.get(
                "Content-Length"
              )} bytes data from ${res.headers.get("Content-Range")}`
            );
            return res.blob();
          }
        })
        .then((resBlob) => {
          if (_writable !== null) {
            _writable.write(resBlob).then(() => {});
          } else {
            _blobs.push(resBlob);
          }
        })
        .then(() => {
          if (_next_offset < _total_size) {
            fetchNextPart(_writable);
          } else {
            if (_writable !== null) {
              _writable.close().then(() => {
                logger.info("Download finished", fileName);
              });
            } else {
              save();
            }
          }
        })
        .catch((reason) => {
          logger.error(reason, fileName);
        });
    };

    const save = () => {
      logger.info(
        "Finish downloading blobs. Concatenating blobs and downloading...",
        fileName
      );

      let blob = new Blob(_blobs, { type: "audio/ogg" });
      const blobUrl = window.URL.createObjectURL(blob);

      logger.info("Final blob size in bytes: " + blob.size, fileName);

      blob = 0;

      const a = document.createElement("a");
      document.body.appendChild(a);
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      logger.info("Download triggered", fileName);
    };

    const supportsFileSystemAccess =
      "showSaveFilePicker" in unsafeWindow &&
      (() => {
        try {
          return unsafeWindow.self === unsafeWindow.top;
        } catch {
          return false;
        }
      })();
    if (supportsFileSystemAccess) {
      unsafeWindow
        .showSaveFilePicker({
          suggestedName: fileName,
        })
        .then((handle) => {
          handle
            .createWritable()
            .then((writable) => {
              fetchNextPart(writable);
            })
            .catch((err) => {
              console.error(err.name, err.message);
            });
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error(err.name, err.message);
          }
        });
    } else {
      fetchNextPart(null);
    }
  };

  const tel_download_image = (imageUrl) => {
    const fileName =
      (Math.random() + 1).toString(36).substring(2, 10) + ".jpeg"; // assume jpeg

    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = imageUrl;
    a.download = fileName;
    a.click();
    document.body.removeChild(a);

    logger.info("Download triggered", fileName);
  };

  logger.info("Initialized");

  // For webz /a/ webapp
  setInterval(() => {
    // Stories
    const storiesContainer = document.getElementById("StoryViewer");
    if (storiesContainer) {
      console.log("storiesContainer");
      const createDownloadButton = () => {
        console.log("createDownloadButton");
        const downloadIcon = document.createElement("i");
        downloadIcon.className = "icon icon-download";
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "Button TkphaPyQ tiny translucent-white round tel-download";
        downloadButton.appendChild(downloadIcon);
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => {
          // 1. Story with video
          const video = storiesContainer.querySelector("video");
          const videoSrc =
            video?.src ||
            video?.currentSrc ||
            video?.querySelector("source")?.src;
          if (videoSrc) {
            tel_download_video(videoSrc);
          } else {
            // 2. Story with image
            const images = storiesContainer.querySelectorAll("img.PVZ8TOWS");
            if (images.length > 0) {
              const imageSrc = images[images.length - 1]?.src;
              if (imageSrc) tel_download_image(imageSrc);
            }
          }
        };
        return downloadButton;
      };

      const storyHeader =
        storiesContainer.querySelector(".GrsJNw3y") ||
        storiesContainer.querySelector(".DropdownMenu").parentNode;
      if (storyHeader && !storyHeader.querySelector(".tel-download")) {
        console.log("storyHeader");
        storyHeader.insertBefore(
          createDownloadButton(),
          storyHeader.querySelector("button")
        );
      }
    }

    // All media opened are located in .media-viewer-movers > .media-viewer-aspecter
    const mediaContainer = document.querySelector(
      "#MediaViewer .MediaViewerSlide--active"
    );
    const mediaViewerActions = document.querySelector(
      "#MediaViewer .MediaViewerActions"
    );
    if (!mediaContainer || !mediaViewerActions) return;

    // Videos in channels
    const videoPlayer = mediaContainer.querySelector(
      ".MediaViewerContent > .VideoPlayer"
    );
    const img = mediaContainer.querySelector(".MediaViewerContent > div > img");
    // 1. Video player detected - Video or GIF
    // container > .MediaViewerSlides > .MediaViewerSlide > .MediaViewerContent > .VideoPlayer > video[src]
    const downloadIcon = document.createElement("i");
    downloadIcon.className = "icon icon-download";
    const downloadButton = document.createElement("button");
    downloadButton.className =
      "Button smaller translucent-white round tel-download";
    downloadButton.setAttribute("type", "button");
    downloadButton.setAttribute("title", "Download");
    downloadButton.setAttribute("aria-label", "Download");
    if (videoPlayer) {
      const videoUrl = videoPlayer.querySelector("video").currentSrc;
      downloadButton.setAttribute("data-tel-download-url", videoUrl);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        tel_download_video(videoPlayer.querySelector("video").currentSrc);
      };

      // Add download button to video controls
      const controls = videoPlayer.querySelector(".VideoPlayerControls");
      if (controls) {
        const buttons = controls.querySelector(".buttons");
        if (!buttons.querySelector("button.tel-download")) {
          const spacer = buttons.querySelector(".spacer");
          spacer.after(downloadButton);
        }
      }

      // Add/Update/Remove download button to topbar
      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          // There's existing download button, remove ours
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== videoUrl
        ) {
          // Update existing button
          telDownloadButton.onclick = () => {
            tel_download_video(videoPlayer.querySelector("video").currentSrc);
          };
          telDownloadButton.setAttribute("data-tel-download-url", videoUrl);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        // Add the button if there's no download button at all
        mediaViewerActions.prepend(downloadButton);
      }
    } else if (img && img.src) {
      downloadButton.setAttribute("data-tel-download-url", img.src);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        tel_download_image(img.src);
      };

      // Add/Update/Remove download button to topbar
      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          // There's existing download button, remove ours
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== img.src
        ) {
          // Update existing button
          telDownloadButton.onclick = () => {
            tel_download_image(img.src);
          };
          telDownloadButton.setAttribute("data-tel-download-url", img.src);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        // Add the button if there's no download button at all
        mediaViewerActions.prepend(downloadButton);
      }
    }
  }, REFRESH_DELAY);

  // For webk /k/ webapp
  setInterval(() => {
    /* Voice Message or Circle Video */
    const pinnedAudio = document.body.querySelector(".pinned-audio");
    let dataMid;
    let downloadButtonPinnedAudio =
      document.body.querySelector("._tel_download_button_pinned_container") ||
      document.createElement("button");
    if (pinnedAudio) {
      dataMid = pinnedAudio.getAttribute("data-mid");
      downloadButtonPinnedAudio.className =
        "btn-icon tgico-download _tel_download_button_pinned_container";
      downloadButtonPinnedAudio.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
    }
    const audioElements = document.body.querySelectorAll("audio-element");
    audioElements.forEach((audioElement) => {
      const bubble = audioElement.closest(".bubble");
      if (
        !bubble ||
        bubble.querySelector("._tel_download_button_pinned_container")
      ) {
        return; /* Skip if there's already a download button */
      }
      if (
        dataMid &&
        downloadButtonPinnedAudio.getAttribute("data-mid") !== dataMid &&
        audioElement.getAttribute("data-mid") === dataMid
      ) {
        downloadButtonPinnedAudio.onclick = (e) => {
          e.stopPropagation();
          if (isAudio) {
              tel_download_audio(link);
          } else {
              tel_download_video(link);
          }
        };
        downloadButtonPinnedAudio.setAttribute("data-mid", dataMid);
        const link = audioElement.audio && audioElement.audio.getAttribute("src");
        const isAudio = audioElement.audio && audioElement.audio instanceof HTMLAudioElement
        if (link) {
          pinnedAudio
            .querySelector(".pinned-container-wrapper-utils")
            .appendChild(downloadButtonPinnedAudio);
        }
      }
    });

    // Stories
    const storiesContainer = document.getElementById("stories-viewer");
    if (storiesContainer) {
      const createDownloadButton = () => {
        const downloadButton = document.createElement("button");
        downloadButton.className = "btn-icon rp tel-download";
        downloadButton.innerHTML = `<span class="tgico">${DOWNLOAD_ICON}</span><div class="c-ripple"></div>`;
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => {
          // 1. Story with video
          const video = storiesContainer.querySelector("video.media-video");
          const videoSrc =
            video?.src ||
            video?.currentSrc ||
            video?.querySelector("source")?.src;
          if (videoSrc) {
            tel_download_video(videoSrc);
          } else {
            // 2. Story with image
            const imageSrc =
              storiesContainer.querySelector("img.media-photo")?.src;
            if (imageSrc) tel_download_image(imageSrc);
          }
        };
        return downloadButton;
      };

      const storyHeader = storiesContainer.querySelector(
        "[class^='_ViewerStoryHeaderRight']"
      );
      if (storyHeader && !storyHeader.querySelector(".tel-download")) {
        storyHeader.prepend(createDownloadButton());
      }

      const storyFooter = storiesContainer.querySelector(
        "[class^='_ViewerStoryFooterRight']"
      );
      if (storyFooter && !storyFooter.querySelector(".tel-download")) {
        storyFooter.prepend(createDownloadButton());
      }
    }

    // All media opened are located in .media-viewer-movers > .media-viewer-aspecter
    const mediaContainer = document.querySelector(".media-viewer-whole");
    if (!mediaContainer) return;
    const mediaAspecter = mediaContainer.querySelector(
      ".media-viewer-movers .media-viewer-aspecter"
    );
    const mediaButtons = mediaContainer.querySelector(
      ".media-viewer-topbar .media-viewer-buttons"
    );
    if (!mediaAspecter || !mediaButtons) return;

    // Query hidden buttons and unhide them
    const hiddenButtons = mediaButtons.querySelectorAll("button.btn-icon.hide");
    let onDownload = null;
    for (const btn of hiddenButtons) {
      btn.classList.remove("hide");
      if (btn.textContent === FORWARD_ICON) {
        btn.classList.add("tgico-forward");
      }
      if (btn.textContent === DOWNLOAD_ICON) {
        btn.classList.add("tgico-download");
        // Use official download buttons
        onDownload = () => {
          btn.click();
        };
        logger.info("onDownload", onDownload);
      }
    }

    if (mediaAspecter.querySelector(".ckin__player")) {
      // 1. Video player detected - Video and it has finished initial loading
      // container > .ckin__player > video[src]

      // add download button to videos
      const controls = mediaAspecter.querySelector(
        ".default__controls.ckin__controls"
      );
      if (controls && !controls.querySelector(".tel-download")) {
        const brControls = controls.querySelector(
          ".bottom-controls .right-controls"
        );
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "btn-icon default__button tgico-download tel-download";
        downloadButton.innerHTML = `<span class="tgico">${DOWNLOAD_ICON}</span>`;
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        if (onDownload) {
          downloadButton.onclick = onDownload;
        } else {
          downloadButton.onclick = () => {
            tel_download_video(mediaAspecter.querySelector("video").src);
          };
        }
        brControls.prepend(downloadButton);
      }
    } else if (
      mediaAspecter.querySelector("video") &&
      mediaAspecter.querySelector("video") &&
      !mediaButtons.querySelector("button.btn-icon.tgico-download")
    ) {
      // 2. Video HTML element detected, could be either GIF or unloaded video
      // container > video[src]
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      if (onDownload) {
        downloadButton.onclick = onDownload;
      } else {
        downloadButton.onclick = () => {
          tel_download_video(mediaAspecter.querySelector("video").src);
        };
      }
      mediaButtons.prepend(downloadButton);
    } else if (!mediaButtons.querySelector("button.btn-icon.tgico-download")) {
      // 3. Image without download button detected
      // container > img.thumbnail
      if (
        !mediaAspecter.querySelector("img.thumbnail") ||
        !mediaAspecter.querySelector("img.thumbnail").src
      ) {
        return;
      }
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      if (onDownload) {
        downloadButton.onclick = onDownload;
      } else {
        downloadButton.onclick = () => {
          tel_download_image(mediaAspecter.querySelector("img.thumbnail").src);
        };
      }
      mediaButtons.prepend(downloadButton);
    }
  }, REFRESH_DELAY);

  // Progress bar container setup
  (function setupProgressBar() {
    const body = document.querySelector("body");
    const container = document.createElement("div");
    container.id = "tel-downloader-progress-bar-container";
    container.style.position = "fixed";
    container.style.bottom = 0;
    container.style.right = 0;
    if (location.pathname.startsWith("/k/")) {
      container.style.zIndex = 4;
    } else {
      container.style.zIndex = 1600;
    }
    body.appendChild(container);
  })();

  logger.info("Completed script setup.");
})();


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


(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TelDownloader = root.TelDownloader || {};
    Object.assign(root.TelDownloader, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const RANGE_PATTERN = /^bytes (\d+)-(\d+)\/(\d+)$/;

  const createTransport = ({
    fetchImpl = globalThis.fetch,
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
      const anchor = globalThis.document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      globalThis.document.body.appendChild(anchor);
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
        styleNode.remove();
        panel.remove();
      },
    };
  };

  return { createDownloadPanel };
});


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
