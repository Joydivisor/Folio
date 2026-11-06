# 工具链与发布流程

## 安全修复

构建依赖固定覆盖 `glob 14.0.2` 和 `minimatch 11.0.1`，分别修复 [取消后继续遍历目录](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) 和 [匹配规则导致资源放大](https://github.com/advisories/GHSA-g3hv-75wg-m249) 的问题。检查时，最新 `@electron/asar 4.3.1` 仍要求较旧主版本，故暂时在根 `package.json` 使用精确 `overrides`，同时提交锁文件。等上游更新后，再验证是否可移除覆盖。

`tests/toolchain.test.mjs` 实际创建、读取 ASAR，覆盖中文与空格文件名、隐藏资源和嵌套内容，也验证打包工具不会混入运行包。完整依赖审计（包括构建依赖）纳入 Windows 与 macOS/Linux CI；中等级别及以上告警阻止该次构建继续。

```sh
npm ci
npm audit --audit-level=moderate
npm run check
npm test
```

## 缓存与包内容

安装 Electron 和实际打包共享 `electron_config_cache`，默认打包缓存目录为 `.electron-cache`。CI 按系统、架构和 Electron 的确切版本缓存下载，工具链锁文件变化不会无故丢失相同 Electron 的缓存。打包使用当前 Electron npm 包随附的官方 `checksums.json` 校验缓存，兼容旧下载地址形成的缓存目录，避免重复下载和额外联网读取校验文件；校验不匹配时停止，不使用该缓存。打包临时目录位于当前检出目录的 `dist/.packager-tmp`，避免并发检出共用系统临时目录。

Windows 包输出必须在当前检出目录内。可在单独检出目录验证，或用 `FOLIO_PACKAGE_OUT` 指向该检出目录内的独立子目录。Windows V1.0.2 起由 electron-builder 构建更新兼容的 NSIS 安装器，工具缓存位于 `.installer-cache/electron-builder/`。旧 `installer/folio.nsi` 仅供历史版本参考。

所有平台打包后都运行 `scripts/audit-package.mjs`：限制顶层目录、拒绝构建依赖混入、检查自有运行代码的凭证模式，并记录版本、文件数和 ASAR SHA-256。`dist/v*/build-timing.json` 记录打包耗时，后续可用实际数据定位瓶颈。

## 上传与恢复

GitHub Actions 的 `release_tag` 留空时仅构建验证、保存 CI 附件。填入时只能指向一个与 `package.json` 版本一致的现有草稿。也可以在本地明确列出安装包：

```sh
node scripts/upload-release.mjs --repo Joydivisor/Folio --tag vNEXT_VERSION releases/Folio-Setup-NEXT_VERSION-win-x64.exe
```

把示例版本替换为 `package.json` 的实际版本。脚本不会新建或公开 Release。加 `--check` 可只检查通道。每次正式上传都会重新检查，无需记忆额外步骤；CI 与本地使用同一入口。

- 上传前读取远端状态，已公开的 Release 立即拒绝。
- 检查全部本地文件、版本与远端冲突后，用实际附件上传端点发送唯一命名的 1 MiB 临时探针，核对大小与 SHA-256 后删除并确认已删除。探针失败或清理不完整时不开始上传安装包；探针不会删除任何正式附件。
- 元数据请求有 25 秒超时，对连接重置等临时错误最多尝试三次。探针每次限 60 秒；正式附件按实测速率设定 2–15 分钟上限，每 10 秒报告文件与已用时间，不再无限等待或长时间无反馈。
- 远端同名文件大小、SHA-256 都相同则跳过；同名但内容不同或不完整时停止，不覆盖、不删除。
- 网络中断后先读取远端结果；已经上传成功则直接确认，仅对尚不存在的文件重试，最多三次。
- 检查写入 `dist/v*/release-preflight.json`，包含通过状态、探针耗时、速率、待传与跳过字节；正式上传结果写入 `release-upload.json`。CI 独立保留两个报告。探针速率包含 API 开销，是通道检查值，不冒充安装包实际传输速度。
- 未完成的草稿资产需要维护者核实后处理；脚本不会为了重试自动删除它。
- Windows ZIP 在 finalize 时以不压缩方式封装同一 EXE，并核对内部安装器哈希。所有平台完成后，根据已核验的远端资产 SHA-256 汇总 `SHA256SUMS.txt`，通过上传脚本显式传入该文件一次；默认上传不抢先发布仅包含 Windows 的清单。

DMG/DEB 已压缩，CI 保存它们时使用 `compression-level: 0`，避免重复压缩。成功传入 Release 草稿的完整包不再额外上传一份 CI 副本；验证报告独立保留。未指定草稿，或草稿上传失败时，仍保留完整 CI 包供检查和恢复。[GitHub 附件压缩说明](https://github.com/actions/upload-artifact#altering-compressions-level-speed-v-size)

## 现有用户与版本切换

工具链修复和验证构建不修改现有标签、发布资产或官网 `release.json`。已安装用户和正在下载的用户继续使用原版本。

需要向用户交付重新构建的二进制时，先更新版本、创建新草稿、完成各平台验证与校验清单，再公开新版本并切换官网。保留旧版下载地址，不用同名文件覆盖一个已发布版本。仅修改构建工具，并不自动要求现有用户重新安装。

包内容审计和构建通过不等于恶意软件扫描或操作系统签名、公证；这些验证的记录应分别保存。

## V1.0.2 应用内更新

Windows 的 EXE、`.exe.blockmap`、`latest.yml` 和校验清单统一输出到 `releases/v<版本>/`。它们必须一起上传到相同版本的 GitHub Release；脚本仅上传到草稿，公开发布前完成 `node scripts/test-update-install.mjs` 的实际升级验证。详情见 [V1.0.2 发布说明](release-1.0.2.md)。
