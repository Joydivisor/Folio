# Folio 文档

- 当前源码：**1.0.5 r2**。源码采用 GPL-3.0-only。
- [V1.0.5 持续聊天与自测](release-1.0.5.md)：文件夹拖入、1M 上下文、原图视觉输入、选择题／填空题。
- [V1.0.4 阅读与交互](release-1.0.4.md)：DOCX、扫描 PDF、紧凑提问框、输出菜单、图示联动与交互笔记。
- [真实扫描 OCR 复测](ocr-validation-1.0.4.md)：3 份文件、7 页，正文字符对照与已知边界。
- [V1.0.2 应用内更新](release-1.0.2.md)：Windows 更新流程、发布文件和实际安装升级验证。
- [开发与打包说明](../README.md)：启动、测试、构建和项目结构。
- [正式版下载与校验](https://github.com/Joydivisor/Folio/releases/tag/v1.0.5)：各平台安装包和 SHA-256 清单。
- [V1.0.1 下载入口迁移](release-1.0.1.md)：统一主仓库与旧版手动升级说明。
- [V1.0.0 发布与重启修复](release-1.0.0.md)：启动恢复、验证方式与开源说明。
- [beta.10 实施与验收](beta10-plan.md)：连续阅读、自然图文、通用 Anatomy 与本地构建。
- [r3 界面一致性验收](ui-consistency-r3.md)：搜索框、统一菜单、滑动切换与全界面检查范围。
- [V1.0.0 beta 输出体验调研](v1.0.0-beta-output-review.md)：Canvas 触发、图示嵌入、当前 3D 边界与 Anatomy 接入方案。
- [PDF 选择与重排方案](reading-reflow-plan.md)：beta.9 相关实现计划。
- [历史文档](history/README.md)：旧版验收记录与升级方案。

## 常用开发入口

| 任务 | 入口 |
| --- | --- |
| 启动网页 / 桌面版 | `npm start` / `npm run desktop` |
| 源码检查 / 自动测试 | `npm run check` / `npm test` |
| 构建 Windows 程序 / 安装器 | `npm run package:win` / `npm run installer:win` |
| 验证 Windows 应用内升级 | `node scripts/test-update-install.mjs` |
| 校验 Windows 发布文件 | `node scripts/finalize-windows-release.mjs` |
| macOS / Linux 打包 | `.github/workflows/unix-release.yml`，在对应平台构建 |
| beta.10 连续阅读与画布检查 | `scripts/test-beta10.cjs` |
| PDF 选择与拖入检查 | `scripts/test-reading-beta9.cjs` |
| 导入权限与取消/恢复检查 | `scripts/test-import-permission.cjs` |
| 当前 Windows 包内容检查 | `scripts/check-packaged-beta10.cjs` |
| 文件夹真实进程重启检查 | `node scripts/test-library-restart.cjs` |

运行命令时以 `study-desk/` 为当前目录。真实模型评估脚本会调用配置的 API；离线自动测试不需要密钥。保留现有脚本位置，避免影响工作流和既有调用。
