# 电商上新助手（Ecom Listing Agent）

**把商品资料录入一次，由程序自动填写电商后台中复杂、重复的上新表单。**

商家准备商品标题、属性、颜色尺码、价格库存和图片，程序打开商家授权的浏览器，将这些资料填写到平台商品编辑页并逐项核对。商家处理验证码、检查结果并亲自点击发布。

```text
商品资料和图片 → 本地工作台 → 自动填写平台表单 → 自动回读核对 → 商家审核发布
```

## 它能解决什么问题

手工发布一款服装时，通常需要反复填写属性、生成颜色尺码组合、逐行录入价格库存、上传图片和检查遗漏。本项目把这些步骤整理成可复用的商品资料和确定性的浏览器操作，减少重复录入以及由复制粘贴造成的错误。

目前真正可用的第一个 App 是 **拼多多女装 T 恤上新助手**，支持：

- 图形化录入，普通用户不需要编辑 JSON。
- 商品标题、品牌和已验证的女装 T 恤属性。
- 多颜色、多尺码，自动生成颜色尺码组合及商家 SKU 编码。
- 逐规格价格和库存，也可以从 Excel/WPS 整表粘贴。
- 成衣尺寸表、身高体重选码建议及多个可保存模板。
- 主图、颜色规格图、详情图、发货设置和现有运费模板。
- 自动填写拼多多商品编辑页、逐步骤回读、保存草稿及差异提示。
- 复制上一款或套用模板，只修改新款发生变化的内容。

> 当前范围是：拼多多中国站 → 女装/女士精品 → T 恤 → 单款商品。程序不会自动点击最终发布。批量上新、AI 识图、多平台和其他类目仍在后续规划中。

## 普通用户：5 步开始使用

普通用户无需自行安装 Node.js，也不用下载整个源码仓库。Windows 包已内置运行环境，完整解压后启动不需要联网下载依赖；登录拼多多和使用商家页面仍需要网络。请在项目的 **Releases** 页面选择“拼多多女装 T 恤上新助手”，再按电脑系统下载对应的独立压缩包：

| 电脑 | 下载文件 | 启动文件 |
|---|---|---|
| Windows 10/11 64 位 | `pdd-womenswear-tshirt-v0.1.2-windows-x64.zip` | `Start-PDD-Assistant.cmd` |
| Apple Silicon 或 Intel Mac | `pdd-womenswear-tshirt-v0.1.2-macos-universal.zip` | `Start-PDD-Assistant.command` |

1. **完整解压 ZIP** 到普通文件夹，不要在压缩包预览窗口中直接运行。
2. 双击启动文件。程序会打开本机工作台网页 `http://127.0.0.1:5173/`。
3. 第一次不知道怎么填时，点击 **“载入完整初始示例”**，照着示例换成自己的商品资料和图片。
4. 点击 **“打开商家浏览器”**，登录拼多多商家后台并进入“女装/女士精品 → T 恤 → T 恤”的新商品编辑页。
5. 回到工作台，依次点击 **“检查资料并载入”** 和 **“填写并核对”**。核对平台页面后，由商家手动发布。

验证码和滑块由用户本人完成。启动窗口需要保持打开；关闭窗口会停止助手。个人商品、图片副本、模板、任务报告和浏览器登录状态保存在解压目录的 `data` 文件夹，**使用后的 `data` 文件夹不要分享给别人**。

完整操作步骤、模板复用、Excel 粘贴和排错方法见 [拼多多单款填表助手使用说明](使用说明.md)。所有可下载 App 见 [用户 App 目录](APPS.md)。

## 社区与获得帮助

- 使用方法和排错问题：在 GitHub **Discussions → Q&A** 提问。
- 新平台、新类目和较大的功能想法：在 **Discussions → Ideas** 讨论。
- 能够稳定复现的错误：使用 GitHub **Issues** 中对应的结构化表单。
- 准备贡献代码：先阅读 [贡献指南](CONTRIBUTING.md)，再认领 Issue 或提交方案。
- 敏感安全问题：按照 [SECURITY.md](SECURITY.md) 使用私密报告。

完整分流规则、建议的讨论分类和交流群原则见 [社区与交流](COMMUNITY.md)，使用支持范围见 [SUPPORT.md](SUPPORT.md)。所有社区参与者需遵守 [行为准则](CODE_OF_CONDUCT.md)。

仓库管理员首次发布时按 [GitHub 社区启用清单](docs/57-github-community-setup.md) 开启 Discussions、标签、安全报告和分支规则。

## 开发者：运行源码

需要 Node.js 24.15 或以上版本和 Google Chrome；Windows 也支持 Microsoft Edge。

```sh
npm install
npm run build
npm run workbench:start
```

然后打开 <http://127.0.0.1:5173/>。macOS 开发环境也可以双击 `启动工作台.command`。

常用检查：

```sh
npm test
npm run test:mvp
npm run test:adapter-manifests
npm run build
```

生成当前 App 的两个独立发行包：

```sh
npm run build:app:pdd-tshirt:windows
npm run build:app:pdd-tshirt:macos
```

生成结果位于 `release/`。模拟测试通过只说明代码契约成立；真实商家页会变化，发布前仍需执行对应平台的实页验证。

## 为什么这是一个项目合集

不同平台、类目和表单之间的字段与页面结构不同，因此每个可用工具作为独立 App 发布，普通用户只下载自己需要的包；源码仓库则共同维护商品数据结构、运行时、测试工具和扩展规范。

```text
录入 / Excel / ERP / 可选 AI
              ↓
      ProductPackage 核心商品资料
              ↓
 平台 Adapter + 类目 Profile
              ↓
       确定性填写计划
              ↓
 浏览器 / 官方 API → 回读核对 → 人工审核
```

Adapter 负责一个明确的平台、站点、接入方式和类目。新增平台或表单不需要复制整套项目，而是增加自己的 Adapter、类目规则和最终用户 App。

- [开放生态架构](docs/54-open-source-ecosystem.md)
- [Adapter 贡献规范](docs/55-adapter-contribution-spec.md)
- [Adapter 目录](ADAPTERS.md)
- [统一商品数据与校验](docs/03-data-contract.md)
- [贡献指南](CONTRIBUTING.md)

Adapter 使用以下成熟度：

| 状态 | 含义 |
|---|---|
| `proposal` | 只有需求或设计 |
| `experimental` | 有代码和模拟测试，缺少完整实页证据 |
| `beta` | 在明确站点、类目和日期范围完成真实草稿验证 |
| `stable` | 有维护者、回归夹具、兼容记录及多轮验证 |
| `deprecated` | 页面变化或无人维护，不再可靠 |

当前拼多多实现仍位于根目录 `scripts/pdd-*`，作为迁移期参考 Adapter 保持运行。新实现应进入 `adapters/<id>/`，并在 `apps/<app-id>/` 创建面向最终用户的独立 App。

## 安全与隐私

- 不要提交 Cookie、token、二维码、账号、店铺身份、订单或真实用户图片。
- 工作台只监听本机 `127.0.0.1`。
- 图片上传、草稿保存或平台结果不明确时，程序停止并要求人工核对。
- 第三方 Adapter 是可执行代码；使用前应检查来源和权限。
- 安全问题报告方式见 [SECURITY.md](SECURITY.md)。

## 路线图

1. 稳定拼多多女装 T 恤 MVP，并完成 Windows 实机验证。
2. 抽取 Adapter SDK、通用任务运行时和 UI 注册机制。
3. 用第二个平台或类目验证核心 Schema 的扩展能力。
4. 增加 Excel/ERP 导入、批量队列和可恢复任务。
5. 增加可选的视觉识别、文案、图片和视频能力。
6. 在具备明确授权、幂等和结果核对后，再讨论自动发布。

当前边界见 [MVP 交接说明](docs/52-mvp-handoff.md)，首次公开前检查见 [开源发布清单](docs/56-open-source-release-checklist.md)，历史开发过程见 [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。贡献者提交并被接收的代码按该许可证提供；第三方依赖仍遵循各自许可证。
