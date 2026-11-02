# Folio 文档

- 当前应用版本以 [package.json](../package.json) 为准；目前为 `1.0.0-beta.9`。
- [开发与打包说明](../README.md)：启动、测试、构建和项目结构。
- [本地安装包目录说明](../releases/README.md)：各平台文件、内测 ZIP 和校验清单，打包工作区中可用。
- [PDF 选择与重排方案](reading-reflow-plan.md)：beta.9 相关实现计划。
- [历史文档](history/README.md)：旧版验收记录与升级方案。

## 常用开发入口

| 任务 | 入口 |
| --- | --- |
| 启动网页 / 桌面版 | `npm start` / `npm run desktop` |
| 源码检查 / 自动测试 | `npm run check` / `npm test` |
| 构建 Windows 程序 / 安装器 | `npm run package:win` / `npm run installer:win` |
| 打包 Windows 内测 ZIP | `python scripts/package-windows-test-zip.py` |
| macOS / Linux 打包 | `.github/workflows/unix-release.yml`，在对应平台构建 |
| 当前 PDF 选择与拖入检查 | `scripts/test-reading-beta9.cjs` |
| 导入权限与取消/恢复检查 | `scripts/test-import-permission.cjs` |
| 当前 Windows 包内容检查 | `scripts/check-packaged-beta9.cjs` |

运行命令时以 `study-desk/` 为当前目录。真实模型评估脚本会调用配置的 API；离线自动测试不需要密钥。保留现有脚本位置，避免影响工作流和既有调用。
