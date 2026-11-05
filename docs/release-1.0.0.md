# V1.0.0 · 2026-11-05

本版包含 beta.10 r3 的连续阅读、画布、Anatomy、3D 扩展和界面统一改动，并修复重新打开程序后需要手动刷新文献库的问题。之前文档中的“本地测试版”描述是当时状态，以本次正式发布和根目录 README 为准。

## 文献目录恢复

旧版只将文件夹句柄写入 IndexedDB，没有持久化扫描结果。Electron 在进程退出后将外部文件夹权限恢复为 `prompt`；启动代码只在 `queryPermission()` 为 `granted` 时扫描，导致下次打开列表为空。

桌面启动时针对 Folio 精确本地 origin 的已有文件句柄执行只读恢复。扫描结束后退出临时权限检查，回到 Chromium 原生的用户操作授权，保留显式导入写权限。目录快照绑定真实文件夹身份，避免同名目录混用；不可用的磁盘不会清空已保存目录。浏览器版直接恢复目录快照，打开文献时再申请访问权限。

`node scripts/test-library-restart.cjs` 使用真实磁盘上的合成文件、Chromium 文件拖入产生的原生句柄、持久 IndexedDB 和独立 Electron 进程，覆盖旧记录迁移、连续两次进程重启、新增文件扫描、浏览器权限恢复、离线目录保留与显式写入。不读取用户资料库。

## 发布验证

执行 `npm run check`、`npm test`、目录重启回归及最终安装包的资源一致性检查。原有的 `scripts/test-beta10.cjs` 和 `scripts/test-controls.cjs` 覆盖连续阅读、混合画布、Anatomy，以及中英文、深浅主题、不同窗口尺寸下的控件交互。真实 API 评估与离线固定响应测试分别记录。

macOS / Linux 工作流在原生 runner 上构建、启动并检查安装产物。Windows 安装包、源码和各平台产物均使用相同的正式版本号。Release 附带 SHA-256 清单；构建结果与本地详细报告不进入源代码仓库。

## 开源

自有代码采用 GPL-3.0-only；Anatomy 等第三方组件保留原始许可证和来源说明。安装包包含 GPL 正文和第三方声明。源代码、构建脚本及安装包集中发布到 `Joydivisor/Folio`。首发时使用的 `Folio-downloads` 兼容镜像在 [1.0.1](release-1.0.1.md) 中退役，旧版需从官网手动下载一次以迁移更新入口。

Windows 包未签名，macOS 包未经过 Apple 公证。几何与模型输出能力边界见根目录 README。
