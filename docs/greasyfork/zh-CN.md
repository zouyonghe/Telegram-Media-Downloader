# Telegram 电报小飞机媒体下载器 / 图片视频下载器

**解锁Telegram：所有内容任你下载。**

本脚本允许你在Telegram网页版下载图片、GIF动图和视频。即使频道禁用了文件下载或限制了文件保存也仍然可以下载。

📢 重要提醒：本插件**完全免费**！！！**完全免费**！！！！

本插件未提供任何付费选项，如果出现任何付费要求，则说明您下载了错误的恶意插件，请不要付费并到[GitHub Issues页面](https://github.com/Neet-Nestor/Telegram-Media-Downloader/issues)或Greasyfork评论区留言开发者。

## 如何安装

安装一个可以运行用户脚本的浏览器插件（如Tamper Monkey)并点击本页面上的“安装”按钮安装本脚本。

**重要提示:** 如果你在使用Chrome内核的浏览器, 请参照[这里的流程](https://jingyan.baidu.com/article/ca2d939dfa5762ab6d31ce10.html)启用开发者模式以使脚本生效.

## 如何使用
这个脚本仅适用于 Telegram 网页版。此脚本将为图片、GIF、视频和语音信息添加下载按钮，一键下载当前播放的媒体文件。

构建版还支持在聊天外层直接勾选已经加载的图片和视频，点击“批量下载”加入下载队列。队列支持并发数设置（1-8，默认 3）、取消、失败重试和清理已完成任务。可在“设置”中选择下载目录；支持的 Chromium 浏览器会记住目录权限，其他浏览器使用浏览器默认下载目录。

默认开启 SHA-256 去重：重复媒体 URL 会在下载前跳过；设置了自定义目录时，还会对文件内容计算 SHA-256，重复内容不会保留。可在设置中关闭。

![图片下载](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2VjNmU2ZDM0YTFlOWY4YTMzZDZmNjVlMDE2ODQ4OGY4N2E3MDFkNSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/lqCVcw0pCd2VA3zqoE/giphy.gif)
![GIF动图下载](https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzYwMzM3ZTMzYmI1MzA4M2EyYmY0NTFlOTg4OWFhNjhjNDk5YTkzYiZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/wnYzW4vwpPdeuo62nQ/giphy.gif)
![视频下载](https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXcxYnJxaXMxcW05YW5rZ2YzZzE0bTU4aTBwYXI1N3pmdnVzbDFrdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EEPbblwmSpteAmwLls/giphy.gif)
![Story下载](https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3Z5Y2VzM2QzbW1xc3ZwNTQ2N3Q0a3lnanpxdW55c2Qzajl5NXZsaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xJFjBGi8isHPR5cuHl/giphy.gif)

开始下载的视频会在页面右下角显示下载进度。图片和音频不会显示下载进度。

### 支持的 Webapp 版本
Telegram 网页版有两个不同的版本：

- https://webk.telegram.org / https://web.telegram.org/k/ （推荐）
- https://webz.telegram.org / https://web.telegram.org/a/

这个脚本主要功能应该适用于这两个版本的网页版，但有些功能只在/k/版本有效（如语音消息下载），因此当有些功能无法使用时建议切换到/k/版本。

### 检查下载进度
如果你想要检查当前的下载进度，你可以查看页面右下角的进度条（如果下载的是视频）或者[打开浏览器的开发者工具 -> 控制台](https://developer.chrome.com/docs/devtools/open/)查看文本输出。

## 汇报问题
如果在使用这个脚本时遇到任何问题，请到我们的 [GitHub页面](https://github.com/Neet-Nestor/Telegram-Media-Downloader) 提出问题。

## 支持作者
如果你喜欢这个脚本，你可以[请我喝一杯咖啡](https://ko-fi.com/neetnestor) :)

<img src="https://i.imgur.com/sSdHdeG.jpg" alt="Donation QR Code" width="400px"/>
