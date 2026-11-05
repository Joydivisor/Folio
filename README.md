# Folio

**以本地文献为中心的交互学习台。阅读、做笔记，把难懂的内容变成可以探索的图示。**

[下载 V1.0.2](https://github.com/Joydivisor/Folio/releases/tag/v1.0.2) · [官网](https://getfolio.pages.dev/) · [更新记录](CHANGELOG.md) · [反馈问题](https://github.com/Joydivisor/Folio/issues) · [English overview](#english-overview)

Folio 将文献阅读与 AI 解释放在同一工作区。文献、批注、笔记和阅读位置保存在本机；AI 使用你自己选择的模型服务。不配置 AI 也可以阅读和管理文献。

## V1.0.2

Windows 安装版已加入应用内更新：自动检查稳定版，点击下载后可继续阅读，完成后选择“重启并更新”。文献、笔记和设置保留。macOS 与 Linux 暂时保留手动更新。[发布与验证说明](docs/release-1.0.2.md)。

## 安装

| 平台 | 安装包 | 安装方式 |
| --- | --- | --- |
| Windows 10 / 11 · x64 | [EXE](https://github.com/Joydivisor/Folio/releases/download/v1.0.2/Folio-Setup-1.0.2-win-x64.exe) · [ZIP](https://github.com/Joydivisor/Folio/releases/download/v1.0.2/Folio-Setup-1.0.2-win-x64.zip) | 运行安装程序，选择安装位置和桌面快捷方式；ZIP 需先解压。 |
| macOS 13+ · Apple Silicon | [DMG](https://github.com/Joydivisor/Folio/releases/download/v1.0.2/Folio-1.0.2-mac-arm64.dmg) | 打开后将 Folio 拖入 Applications。 |
| macOS 13+ · Intel | [DMG](https://github.com/Joydivisor/Folio/releases/download/v1.0.2/Folio-1.0.2-mac-x64.dmg) | 打开后将 Folio 拖入 Applications。 |
| Ubuntu 22.04 · x64 | [DEB](https://github.com/Joydivisor/Folio/releases/download/v1.0.2/Folio-1.0.2-linux-x64.deb) | 使用系统软件安装器，或运行下面的命令。 |

```sh
sudo apt install ./Folio-1.0.2-linux-x64.deb
```

安装包自带运行环境，无需安装 Node.js。其他 Linux 发行版尚未验证。Windows 包尚未签名，macOS 包采用 ad-hoc 签名，未经过 Apple 公证；系统可能显示发布者或验证提示。请核对下载来源与 [SHA-256 校验清单](https://github.com/Joydivisor/Folio/releases/download/v1.0.2/SHA256SUMS.txt)。

Windows 安装版可在“帮助 → 检查更新”中下载更新，然后选择“重启并更新”。macOS 更新前退出 Folio 再替换应用，Linux 安装新 DEB。已有文献库、笔记和设置会保留。Windows 卸载保留个人应用数据。

## 可以做什么

- **读文献**：PDF、TXT 和 Markdown；默认连续向下滚动，也可切换逐页。保存阅读位置，支持目录、全文搜索和本地中英文 OCR。
- **管理资料**：连接文件夹或导入副本；收藏、标签、阅读状态、多级分类，以及正文、补充材料和版本附件。重启自动恢复文献目录，无需手动刷新。
- **选文与批注**：保持 PDF 原始外观，按栏整理选择顺序；拖动选区、引用公式或图表区域，添加高亮、下划线和便笺。
- **边读边问**：选中或拖入原文，直接获得带来源的解释。回答进入可编辑画布，流程图、完整推导、对照表等按内容嵌入，无需专门的触发词。
- **探索图示**：群论与置换实验、几何体、受约束网格，以及基于 [Anatomy](https://github.com/wheresryan22/anatomy) 的参数化 SVG 部件插图。支持局部修改、版本历史、撤销、重做和命名快照。
- **留下笔记**：笔记按原文和问题组织，可回到来源页，支持 Markdown / LaTeX 预览和导出。自动整理对话为笔记默认关闭。
- **按习惯使用**：中英文、深浅主题、统一菜单、键盘导航与滑动分段切换；按 F1 打开可搜索的功能说明。

3D 输出限于应用实现的几何、网格和数学实验；Anatomy 用于结构示意，并非任意模型生成或医学解剖数据库。Folio 不运行模型提供的任意代码。暂不支持 EPUB、Zotero 双向同步或把批注写回原 PDF。

## 模型与本地数据

在设置中选择服务商、模型并填写自己的 API Key。支持 OpenAI 兼容 Chat Completions 接口，以及 Claude 原生 Messages 接口；DeepSeek、OpenAI 和 Gemini 有对应配置入口。不同模型共用受验证的绘图协议，Anatomy 不依赖 Claude Code。模型需支持相应文本接口；不提供 ChatGPT / Claude 订阅登录或免费推理额度。

调用 AI 时，问题、对话上下文和相关原文片段会发送到所选服务商，费用由服务商收取。应用不会自动上传整个文献库。桌面版密钥默认仅在当前运行中使用；选择保存时使用系统提供的加密存储。系统不提供安全存储时，不使用明文持久保存。

文献、批注、笔记和阅读位置保存在设备上。导入副本不会覆盖同名原件；从文献库移除条目不删除磁盘原文件。文件菜单可备份工作区，文献副本可选包含，密钥不会进入备份。Zotero 支持 RDF 单向导入和缺失附件定位。安装包以空文献库启动，不包含开发者密钥、私人文献或测试资料。

## 从源码运行

需要 Node.js 24 和 npm。

```sh
git clone https://github.com/Joydivisor/Folio.git
cd Folio
npm ci
npm run desktop
```

仅运行网页开发版：

```sh
npm start
# http://127.0.0.1:4173
```

桌面版本地服务使用 `127.0.0.1:4174`。服务只监听回环地址；网页开发版与桌面版使用各自的数据目录。

## 测试与构建

```sh
npm run check
npm test
node scripts/test-library-restart.cjs
```

自动测试使用合成文献和固定模型响应，不调用付费 API。目录重启测试会启动隔离的 Electron 进程，不读取个人资料库。完整 UI 回归入口和历史验收记录见 [开发文档](docs/README.md)。

Windows：

```sh
npm run package:win
npm run installer:win
```

安装器使用 `electron-builder` 的 NSIS 目标，首次构建会下载并校验配套工具，缓存于 `.installer-cache/electron-builder/`。程序输出到 `dist/v1.0.2/Folio-win32-x64/`；安装器、差分文件和更新清单输出到 `releases/v1.0.2/`。运行 `node scripts/test-update-install.mjs` 验证实际升级，再运行 `node scripts/finalize-windows-release.mjs` 生成校验清单。

macOS / Linux 在对应平台执行 `npm run package:unix`。仓库中的 [跨平台工作流](.github/workflows/unix-release.yml) 会构建 DMG / DEB 并执行原生启动检查；它不会生成 Apple Developer ID 签名或公证。

打包仅包含运行代码、图标、生产依赖和许可证文件，不包含测试资料、截图、开发缓存或个人数据。生成目录和测试报告不提交源码仓库。

依赖审计、Electron 缓存、包内容检查与草稿上传方式见 [工具链与发布流程](docs/toolchain.md)。发布脚本拒绝修改已经公开的版本；验证构建不会替换官网现有下载。

## 项目结构与贡献

| 目录 | 内容 |
| --- | --- |
| `public/` | 阅读器、文献库、笔记、模型适配和交互画布 |
| `desktop/` | Electron 窗口、受限 IPC、文件权限和密钥托管 |
| `server.mjs` | 本地资源服务与模型代理 |
| `scripts/`、`tests/` | 构建、离线测试和隔离 UI 回归 |
| `installer/`、`build/` | Windows 安装器和应用图标 |
| `docs/` | 实现说明、能力边界和历史记录 |

欢迎通过 Issue 和 Pull Request 参与。请先阅读 [贡献说明](CONTRIBUTING.md)；安全问题按 [安全报告说明](SECURITY.md) 私下提交。

## 许可证

Copyright © 2026 Joydivisor and Folio contributors.

Folio 自有代码采用 **GNU General Public License v3.0 only**，SPDX 标识为 `GPL-3.0-only`。完整条款见 [LICENSE](LICENSE)。第三方组件保留各自许可，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。

## English overview

Folio is a local-first desktop workspace for reading papers, annotating passages, writing source-linked notes and exploring interactive explanations. It supports continuous PDF reading, local document collections, editable AI canvases, diagrams, bounded 3D experiments and Anatomy-based SVG illustrations.

Download the package for your platform above; Node.js is only needed for development. Bring your own model endpoint and API key for AI features. Reading and notes work without a key. AI requests send the selected context to your chosen provider; local storage does not make inference offline. Windows packages are unsigned and macOS packages are not Apple-notarized.

Source: **GPL-3.0-only**. Contributions and reproducible bug reports are welcome.
