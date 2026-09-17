# 首次开源发布清单

## 发布前必须完成

- [x] 选择并加入 Apache License 2.0。
- [x] 确认项目名称、仓库地址和维护者联系方式：`wzn7423162/ecom-style-link-agent`，安全问题通过 GitHub 私密漏洞报告。
- [x] 对待提交源码扫描已知 Cookie、token、店铺身份、真实商品图片、二维码及本机绝对路径；真实后台截图 07–10 已排除。首次推送前仍需检查最终暂存清单。
- [x] 从 Git 暂存清单导出干净目录，完成 `npm ci`、单元测试、MVP 测试、Manifest 校验、生产构建和 Windows 完整离线包构建；正式建仓后还需让托管 CI 首次运行。
- [x] 确认 `.runtime`、`output`、`release`、`node_modules`、编辑器文件及系统文件被 `.gitignore` 排除。
- [x] 启用 GitHub 私密漏洞报告，并在 SECURITY.md 填写仓库私密报告入口。
- [x] 给当前 Adapter 设置真实维护者 @wzn7423162；仍维持 `beta`，直至 Windows 实机和平台实页验收。
- [x] 创建 `v0.1.2-beta` 预发布及变更说明，明确只有拼多多女装 T 恤 MVP 可运行。
- [x] 已发布 [v0.1.2 Beta 发行页](https://github.com/wzn7423162/ecom-style-link-agent/releases/tag/v0.1.2-beta) 和 [发布说明](58-v0.1.2-release-notes.md)。
- [x] 为当前 App 分别生成 Windows 与 macOS v0.1.2 发行包并校验 ZIP 结构、SHA-256；发行页不要上传“全平台总客户端”。Windows 实机启动仍待确认。

## 建议的首发仓库标签

`ecommerce`、`automation`、`playwright`、`product-listing`、`pinduoduo`、`agent`、`typescript`。

## 首发后

- [ ] 为 Adapter、类目 Profile、Bug 和页面变化设置 Issue 标签。
- [x] 已配置并确认首次 GitHub CI 通过：manifest、单元测试、MVP 测试和 TypeScript 构建。干净目录 `npm ci` 审计为 0 个已知漏洞。
- [ ] 发布贡献者可以复制的最小 Adapter 模板。
- [ ] 根据真实贡献需求再决定 monorepo 与独立包发布，不提前拆出大量空包。
- [ ] 选择第二个平台的最小类目，用它检验核心 Schema 是否隐藏了拼多多假设。
