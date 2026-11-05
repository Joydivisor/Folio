# Folio V1.0.2

V1.0.2 为 Windows 安装版加入应用内更新。启动后会检查稳定版，长时间运行时每六小时再检查一次；帮助菜单也可以手动检查。用户点击“下载更新”后可继续阅读，完成后点击“重启并更新”安装。下载失败和校验失败可重试，普通退出不会自动安装。

本版作为自动更新的起点，不处理 1.0.1 及更早安装器的迁移。后续版本保持应用 ID `local.folio.reading`、产品名 `Folio`、用户数据目录和本地页面来源不变。文献、笔记、设置和工作区数据库位于用户数据目录，更新只替换程序。存在未关闭的编辑窗口或正在执行的 AI 请求时，不开始重启安装。

macOS 和 Linux 本版仍使用手动下载入口。macOS 的标准自动更新需要正式签名与公证配置；当前构建仍为 ad-hoc 签名。

## 构建与发布

```powershell
npm ci
npm run check
npm test
npm run package:win
npm run installer:win
node scripts/test-update-install.mjs
```

Windows 程序仍由 `@electron/packager` 生成并审计运行文件，安装器改由 `electron-builder` 的 NSIS 目标生成。`scripts/installer-config.mjs` 统一固定的公开 GitHub 更新源；预打包模式显式生成 `resources/app-update.yml`，运行时不接受网页传入的更新源或安装路径。

`releases/v1.0.2/` 中需要一起发布的文件：

- `Folio-Setup-1.0.2-win-x64.exe`：首次安装和完整更新包。
- `Folio-Setup-1.0.2-win-x64.exe.blockmap`：差分更新信息，减少适用场景下的下载量。
- `latest.yml`：版本、资源地址、大小及 SHA-512 校验值。
- `SHA256SUMS.txt`：分发文件的 SHA-256 清单。

这些文件进入同一个公开 GitHub Release，仓库为 `Joydivisor/Folio`。每次更新必须递增 `package.json` 和锁文件中的版本号；不要用相同版本号覆盖已经发布的安装包。V1.0.2 Windows 更新器按版本号比较，不使用旧的 `folioRevision` 发布机制。

更新器从打包配置读取固定的 HTTPS 发布源，并在下载后校验 SHA-512。Windows 包仍未配置发布者代码签名，本版不声称提供发布者证书验证；后续加入代码签名时应一起验证更新链。

使用 `scripts/upload-release.mjs` 上传到现有草稿；脚本仍拒绝修改已公开版本。发布安装包和清单后，再切换官网入口。单独修改官网 `release.json` 不会发布自动更新。

## 验证

`tests/updates.test.mjs` 覆盖显式下载和重启、重复请求合并、下载中检查、校验失败重试、离线恢复、禁用预发布与降级，以及未安装或不支持的平台。

`scripts/test-update-install.mjs` 从当前运行包构建两个只用于测试的安装器，使用独立应用 ID、进程名、安装目录、用户数据目录和本地更新源。它从 1.0.2 实际下载、重启并升级到测试版 1.0.3，再检查文献 Blob、笔记、设置和工作区 IndexedDB。测试版不会进入正式发布目录，也不会修改本机 Folio 的安装。结果位于 `tests/reports/update-install.json`，截图保存在报告指定目录。

本地 V1.0.2 验证结果：137 项自动测试通过，依赖审计无已知漏洞，包内代码与源码一致性、运行资源和文献目录重启检查通过。独立安装测试完成 1.0.2 → 测试用 1.0.3 的真实下载、安装与重启，四类资料保留检查全部通过。本机现有 Folio 占用 4174 端口，常规启动检查未在该端口重复运行；真实升级测试已使用独立 4196 端口验证窗口加载。macOS Apple Silicon、macOS Intel 与 Linux x64 使用相同源码版本，通过原生平台构建与启动检查后发布。
