# Release checks

用户要求：以后每次上传更新前都检查上传通道，发现堵塞先处理。

- 发布附件一律使用 `node scripts/upload-release.mjs --repo Joydivisor/Folio --tag v<version> [files...]`。它强制验证草稿和文件哈希，用同一上传端点传输并清理 1 MiB 临时探针，随后才上传正式包。`--check` 只运行检查。
- 检查失败时先排查 `dist/v*/release-preflight.json`，不要用裸 `gh release upload` 跳过检查。可切换到同样调用此脚本的 GitHub Actions 构建上传。
- 正式附件上传中断后先核验远端大小与 SHA-256，避免重复传输；不覆盖已公开版本。探针清理失败须处理本次探针后再公开。
- 公开更新前完成测试、包审计、实际启动、Windows 更新验证与各平台构建；官网版本、下载资产和更新元数据须一致。仅上传公开文件清单，凭证与本地资料不得进入包或官网。
- 实际扫描 PDF 回归记录样本来源、是否已有文字层、人工核对片段及字符错误率；OCR 置信度不等于准确率。
