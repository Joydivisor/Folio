# Folio

一个以本地文献为中心的交互学习台。左侧阅读，右侧解释、图示与交互实验。

## 下载与运行

- 下载页：https://getfolio.pages.dev/
- Windows 发布：https://github.com/Joydivisor/Folio-downloads/releases
- 当前版本：**1.0.0-beta.9**。

下载 Windows x64 安装程序 `Folio-Setup-1.0.0-beta.9-win-x64.exe`，选择中英文、安装位置及是否创建桌面快捷方式。安装包自带完整程序，不需要 Node.js 或另行下载运行环境。默认安装到当前用户的 `AppData\Local\Programs\Folio`，也可以选择其他空文件夹。

安装后可从开始菜单启动。更新时先关闭 Folio，再将新版安装到原位置。可从 Windows「已安装的应用」或开始菜单卸载；卸载保留个人文献、批注、笔记和设置。安装程序仅移除清单中的程序文件，不递归删除整个安装文件夹。旧 ZIP 版用户可直接安装新版，应用数据仍使用原来的独立目录。

这是尚未签名的测试版，可检查更新并明确下载，暂不自动安装更新。提供 Windows x64、macOS Apple Silicon / Intel，以及 Ubuntu/Debian x64 测试包。macOS 测试版未经过 Developer ID 签名和 Apple 公证。

## 主要功能

- 本地 PDF、TXT、Markdown 文献库：连接文件夹、导入、搜索、收藏、最近阅读和网格/列表视图。
- 文献阅读：页码、缩放、阅读位置；五色高亮、下划线、便笺和来源定位；持久全文索引、PDF 目录、搜索与公式/图表区域引用。
- AI 画布：拖入选文，结合书中上下文解释；解释、对比表、分步推导、过程、概念图，以及可交互的置换、导出列、立方体/正四面体/正八面体 3D 旋转。
- 交互作品：版本历史、手动编辑、追问修改、撤销/重做和命名快照；保存后可恢复实验进度与视角。
- 笔记：保存解释与实验，按文献和问题回看，导出 Markdown。对话相互隔离，自动整理对话为笔记默认关闭。
- 中文/英文、日间/夜间外观、统一设置和顶部菜单。阅读标签支持 ×、右键关闭。

AI 需要用户自行配置模型服务和密钥；模型费用由服务商收取。可视化只支持应用已实现的图形与实验类型，不保证任意原文都能生成准确的交互实验。计算支持的群论操作由本地程序验证，概念关系和解释仍需结合原文检查。

## 数据与隐私

文献、批注、笔记与阅读位置保存在设备上。桌面版与浏览器版使用不同的数据目录；删除安装文件夹不会清除系统应用数据。连接文件夹时读取本地文献；导入会复制文件，避免覆盖同名原件。

密钥默认只在当前运行中使用。用户开启“在本机加密保存”后，桌面主进程通过系统加密保存；网页不读取已托管密钥。桌面托管密钥仅可发送到 DeepSeek 官方地址。原始密钥文件不属于仓库或下载包。全新启动时文献库为空，不预置演示文档、笔记、文件夹连接或密钥。

启用 AI 后，提问、对话上下文和用于解释的原文片段会发送给所选模型服务；本地保存不意味着 AI 请求离线。应用不自动上传整个文献库。自动整理笔记为本地可选功能。

支持本地中英文印刷体 OCR（需人工校正公式）、Zotero RDF 单向导入及缺失附件定位；不支持 EPUB、Zotero 双向同步、PDF 批注写回或任意 3D 场景生成。批注保存在应用数据中，可导出 Markdown。可从文件菜单备份工作区，默认不包含原始文献；勾选后可包含最多 250 MB 的文献副本。密钥不进入备份。

## 本地开发

需要 Node.js 24 和 npm。

```powershell
npm ci
npm start
# 浏览器打开 http://127.0.0.1:4173
npm run desktop
```

桌面版在本机 4174 端口启动服务；开发网页使用 4173。服务只监听回环地址。

```powershell
npm run check
npm test
npm run package:win
npm run installer:win
```

程序产物位于 `dist/v1.0.0-beta.9/Folio-win32-x64/`；安装程序位于 `releases/Folio-Setup-1.0.0-beta.9-win-x64.exe`。打包按白名单只包含 `public/`、`desktop/`、`build/`、生产依赖、`server.mjs` 和 `package.json`。不包含测试数据、截图、凭据或开发缓存。

`releases/` 只保留当前版本各平台安装包、内测 ZIP、发布说明和校验清单；验证报告位于 `releases/verification/`。内测 ZIP 可用 `python scripts/package-windows-test-zip.py` 生成：先核对清单中的 EXE 校验值，已有 ZIP 不会被覆盖。生成目录与测试报告不提交源码仓库。

安装器使用 [NSIS 3.13](https://nsis.sourceforge.io/Download) 的 Modern UI 2。将官方便携编译器解压到 `.installer-cache/nsis-3.13/`，或用环境变量 `NSIS_EXE` 指向 `makensis.exe`，再执行上面的构建命令。版本信息与精确卸载清单由构建脚本生成。手动集成测试：`powershell -ExecutionPolicy Bypass -File scripts/test-installer.ps1`，会在临时测试目录执行安装、更新和卸载；检测到现有安装或同名快捷方式时会停止。

真实模型测试为手动步骤，会消耗模型额度；CI 只运行离线测试。将 `FOLIO_API_KEY_FILE` 环境变量指向设备上的密钥文件，再运行 `scripts/evaluate-ai.mjs` 等评估脚本；不要将密钥写入代码或命令参数。评估结果写入已忽略的 `tests/reports/`。

## 项目结构

- `public/`：阅读、文献库、批注、笔记、AI 画布与交互实验。
- `desktop/`：Electron 窗口、菜单、受限 IPC 与密钥托管。
- `server.mjs`：本地静态资源与模型代理。
- `scripts/`：桌面打包、品牌图标生成和手动评估。
- `tests/`：数学、来源验证、模型代理与交互状态测试。
- `build/`：应用图标。
- `docs/`：文档索引；`docs/history/` 保存旧版验收记录与历史升级计划。

应用源码仓库为私有。下载站源码另存于私有仓库 `Joydivisor/Folio.github.io`；公开安装包与校验文件放在 `Joydivisor/Folio-downloads`，访客下载无需登录。桌面程序分发其运行所需的客户端代码，私有仓库不等同于客户端代码不可提取。

第三方依赖的许可随软件包分发；应用自身未授予开源许可。

## 跨平台发布

私有仓库的 `Build macOS and Linux` 工作流在对应系统上运行测试、打包和启动检查。Mac 下载 DMG 后将 Folio 拖入 Applications；Linux 使用系统软件安装器安装 `.deb`，首轮验证平台为 Ubuntu 22.04 x64。未公证 Mac 测试包可能被 Gatekeeper 拦截，当前未承诺普通用户无提示安装。Windows 继续提供安装向导。

历史升级计划与当时记录的 ChatGPT OAuth 接入条件见 [UPGRADE_PLAN.md](docs/history/UPGRADE_PLAN.md)。文档导航见 [docs/README.md](docs/README.md)。
