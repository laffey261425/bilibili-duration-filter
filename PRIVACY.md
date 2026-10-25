# 隐私政策 / Privacy Policy

**B站视频时长分类与过滤**（Bilibili Duration Filter）
最后更新：2026-10-25

## 一句话

这个扩展不收集、不上传、不分享任何数据。它连网络请求都不发。

## 具体说明

### 我们收集什么

不收集。没有账号系统，没有统计埋点，没有崩溃上报，没有广告，没有第三方 SDK。

### 数据存在哪里

所有设置都存放在你本机浏览器的扩展本地存储（`chrome.storage.local`）里，包括：

- 过滤开关、分类阈值、单位偏好
- 你上传的自定义遮挡图片（以 dataURL 形式压缩后保存）
- 页面右下角挂件的拖动位置

这些数据只存在于你这台电脑的这个浏览器配置里。它不会离开本机，开发者和其他任何第三方都访问不到。卸载扩展时浏览器会一并清除。

### 网络请求

没有。扩展不包含任何远程代码，不加载任何外部脚本、字体、图片或接口，也不会把你的浏览记录、页面内容、视频信息发到任何地方。

### 页面权限

扩展在 `*.bilibili.com` 页面注入脚本，目的是读取页面上已经显示的视频卡片时长文字并添加样式和遮挡层。读取过程全部在本地完成，结果只用于修改当前页面显示。

### 权限说明

| 权限 | 用途 |
|---|---|
| `storage` | 保存你的设置和自定义遮挡图片 |
| `unlimitedStorage` | 遮挡图片存本地，默认配额不够放多张，需要扩容 |

除上述之外没有申请任何权限：没有 `tabs`、没有 `webRequest`、没有 `cookies`、没有 `history`。

### 儿童隐私

不收集任何人的数据，自然也不收集儿童的数据。

### 政策变更

如果将来版本改变了数据处理方式，会更新本文件并在扩展更新说明里写明。

### 联系方式

Issues：本项目的 GitHub 仓库 Issue 区

---

## English

**Bilibili Duration Filter** does not collect, transmit, or share any data. There is no account system, no analytics, no crash reporting, no advertising and no third-party SDK. All settings, custom mask images and widget position are stored locally in `chrome.storage.local` on your own machine and never leave it. The extension makes no network requests and contains no remote code. It runs on `*.bilibili.com` pages only, reads the duration text already rendered on the page, and uses it solely to style or mask cards locally. Permissions: `storage` (save your settings and images) and `unlimitedStorage` (images are stored locally and exceed the default quota). No `tabs`, `webRequest`, `cookies` or `history` access is requested.