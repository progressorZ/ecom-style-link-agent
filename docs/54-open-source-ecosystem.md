# 开放电商刊登自动化生态架构

## 1. 目标

项目是多个独立电商表单 App 的源码集合。每个 App 面向一个明确平台、站点和类目流程，拥有自己的 Windows 包、macOS 包、版本与数据目录。App 之间共享核心与 Adapter SDK，但最终用户只下载需要的 App。

近期目标仍是把拼多多女装 T 恤 MVP 做稳。开放架构用于约束新增代码，不代表其他平台已经实现。

## 2. 分层

```mermaid
flowchart LR
  A[录入/Excel/ERP/未来 AI 识别] --> B[ProductPackage 核心事实]
  B --> C[平台 Adapter]
  C --> D[类目 Profile]
  D --> E[执行计划]
  E --> F[浏览器或官方 API Driver]
  F --> G[逐字段回读与任务凭证]
  G --> H[人工审核]
  H --> I[商家决定保存或发布]
```

### 核心层

负责商品、变体、价格角色、库存、素材、物流意图、确认状态和版本。核心层不知道“拼单价”“平台属性 ID”或页面选择器。

### Adapter 层

一个 Adapter 绑定平台、站点、接入方式和一组类目 Profile。它负责：

- 把 ProductPackage 编译为平台字段和有序步骤。
- 根据平台约束验证标题、属性、规格、价格、库存、素材和物流。
- 执行预检、填写、回读、草稿恢复和结果读取。
- 明确声明不支持、未验证和需要人工完成的内容。

### Driver 层

Driver 负责浏览器或官方 API 的底层交互。浏览器 Driver 不携带业务猜测；官方 API Driver 不改变核心字段语义。二者可以服务同一平台 Adapter，但成熟度与权限分别登记。

### 可选增强层

OCR、视觉识别、标题建议、图片生成和视频生成只产生候选资料，候选值带来源和置信度。影响交易或履约的字段必须由确定性来源或人工确认后进入 ProductPackage。

## 3. 扩展维度

平台、站点、类目和接入方式必须分别建模。例如 `Amazon-US/Apparel/API` 与 `Amazon-JP/Apparel/Browser` 不是同一个执行目标；拼多多 T 恤的颜色枚举不能默认复用于连衣裙或其他平台。

建议身份格式：

```text
<platform>.<access-mode>.<site>.<category-profile>
```

示例：`pdd.browser.cn.womenswear-tshirt`。

## 4. 计划中的目录

```text
packages/
├── core/                  # ProductPackage、校验、版本迁移
├── runtime-browser/       # 浏览器生命周期、任务日志、安全门禁
├── runtime-api/           # 官方 API 的授权、限流、幂等
├── ui-workbench/          # 通用录入、预览和人工审核
├── importer-excel/        # 表格导入
└── adapter-sdk/           # Adapter 类型、测试工具、夹具助手

adapters/
├── pdd-womenswear-tshirt/
├── taobao-.../
└── amazon-.../

apps/
├── pdd-womenswear-tshirt/ # 一个最终用户 App
├── taobao-.../             # 另一个独立 App
└── amazon-.../
```

现阶段不立即搬迁所有代码。先建立 manifest 和测试，再依次抽取核心、运行时、UI，保证当前 MVP 每一步都能回归。

## 5. 用户发行包

源码仓库可以包含多个 App，发行物必须按 App 和操作系统拆分：

```text
<app-id>-v<version>-windows-x64.zip
<app-id>-v<version>-macos-universal.zip
```

每个发行包只包含该 App 的界面、所引用 Adapter、共享运行时、许可证和空白数据目录。Windows 与 macOS 不混在一个压缩包中；macOS 单包内部可以同时携带 Apple Silicon 与 Intel 运行时并在启动时选择。

每个 App 的 `dataNamespace` 全局唯一。不同 App 不共享浏览器登录 profile、商品草稿、图片、任务记录或设置。跨 App 复用商品事实应通过未来的显式导入导出完成，不能直接读取另一个 App 的 data。

## 6. Adapter 生命周期

1. 发现：登记页面与字段，不写入。
2. 编译：核心数据转换为不可变平台计划。
3. 预检：核对店铺、页面、类目、空白/已有状态和可选值。
4. 执行：按安全边界逐步填写，任何歧义立即停止。
5. 回读：从独立 DOM/API 读取器比较业务值。
6. 恢复：记录可能已产生的副作用，不盲目重试上传、保存或发布。
7. 审核：展示已匹配、差异、未覆盖及证据。
8. 发布：当前由用户在平台完成；未来若支持，也必须是独立授权能力。

## 7. 生态治理

- Adapter 有明确维护者、成熟度、最后验证日期和兼容范围。
- 无维护者或连续页面失配的 Adapter 降级为 `deprecated`。
- 平台徽标、名称和页面内容归各平台所有；贡献者只提交必要的脱敏测试资料。
- 第三方 AI/API 凭据由用户本地配置，不提交到仓库。
- 目录是技术能力索引，不为 Adapter 的商业效果、平台授权或合规状态背书。

## 8. 分阶段迁移

### 阶段 A：可贡献入口

建立 manifest Schema、当前参考 manifest、贡献指南和 Issue/PR 模板。现有运行路径保持不变。

### 阶段 B：抽取 Adapter SDK

定义 `compile`、`preflight`、`execute`、`readback`、`recover` 接口，把通用任务记录、浏览器身份和错误结构移入 SDK。

### 阶段 C：迁移拼多多参考实现

按基础资料、属性、规格、价格库存、尺码表、素材、物流、服务拆分模块；用现有测试证明迁移前后行为一致。

### 阶段 D：第二平台验证架构

选择一个字段明显不同的平台实现最小 Adapter。只有第二平台成功接入后，才能确认核心抽象没有暗含拼多多模型。

### 阶段 E：目录与发布机制

工作台读取 Adapter catalog，展示安装状态、成熟度、维护者和支持范围。Adapter 包独立版本化并校验来源；在具备签名与供应链方案前，不自动下载并执行第三方代码。
