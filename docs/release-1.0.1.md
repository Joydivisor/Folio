# V1.0.1 · 2026-11-05

安装包和软件更新统一使用公开的 `Joydivisor/Folio` GitHub Releases。原 `Folio-downloads` 使用相同的 GitHub 下载服务，没有独立的加速线路，现转为私有历史仓库。

1.0.0 及更早版本的更新校验只接受原仓库链接，不能通过服务端元数据直接迁移。请从 [正式发布页](https://github.com/Joydivisor/Folio/releases/tag/v1.0.1) 手动下载安装一次，安装到原位置即可保留文献、笔记和设置。之后的版本检查使用主仓库。

更新校验新增主仓库的精确版本路径，继续拒绝其他所有者、仿冒仓库、错误版本、HTTP、查询参数和带凭据的 URL。测试覆盖新旧合法路径及这些拒绝场景。

本次提供 Windows x64、macOS Apple Silicon / Intel 和 Linux x64 包；1.0.0 的 Apple Silicon 包也已按原标签补齐。许可证仍为 GPL-3.0-only。
