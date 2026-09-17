# 历史开发与验证记录

> 项目方向：建立一个开放的电商刊登自动化集合。贡献者可以新增平台、类目和确定性的填表步骤，把复杂、重复、容易出错的刊登工作沉淀为可复用 Adapter。

## 项目定位

项目暂定通用名称为 **Ecom Listing Agent**。它把一份统一商品资料编译成目标平台可执行的刊登步骤，完成浏览器填表、图片上传、结果回读和人工审核。核心层不绑定拼多多；每个平台与类目通过独立 Adapter 描述字段、规则、页面操作和验证证据。

当前仓库唯一进入可运行 MVP 的实现是：**拼多多中国站 → 女装/女士精品 → T 恤 → 单款商品 → 浏览器辅助填表**。其他平台、其他类目、批量发布、AI 识图和素材生成属于规划或待贡献能力，不能从项目总目标推断为已经实现。

我们希望收录的贡献包括：

- 新平台 Adapter，例如淘宝、抖店、TikTok Shop、Amazon、Shopee、Lazada、Temu。
- 同一平台的新类目配置、字段映射、规格规则和回读验证。
- 通用商品资料导入器、表格转换器、素材处理器和人工审核组件。
- 页面变化后的定位修复、测试夹具、脱敏证据和失败恢复方案。
- 可选 AI 增强能力；价格、库存、尺寸、身份和发布决定仍须使用确定性数据及人工确认。

架构与演进方案见 [开放生态架构](docs/54-open-source-ecosystem.md)，Adapter 契约见 [Adapter 贡献规范](docs/55-adapter-contribution-spec.md)，已登记能力见 [Adapter 目录](ADAPTERS.md)，参与开发前请阅读 [贡献指南](CONTRIBUTING.md)。

## 能力成熟度

| 标记 | 含义 | 可否用于真实店铺 |
|---|---|---|
| `proposal` | 只有需求或设计 | 不可 |
| `experimental` | 有代码和模拟测试，缺少完整实页证据 | 仅测试账号 |
| `beta` | 已在明确平台、类目和日期范围完成真实草稿验证 | 人工全量核对后使用 |
| `stable` | 有维护者、回归夹具、版本兼容记录及多次真实验证 | 仍保留发布前人工审核 |
| `deprecated` | 平台变化或无人维护，不再可靠 | 不可 |

每项能力分别标记成熟度，不能用一个 Adapter 的总体状态掩盖未验证步骤。当前参考实现登记在 [拼多多女装 T 恤 Adapter 清单](adapters/pdd-womenswear-tshirt/adapter.json)。

日常操作请先阅读 [项目使用说明](使用说明.md)：首次设置、单款录入、自动填写、人工发布与故障处理。普通用户不需要编写 JSON。

**当前交付范围（2026-09-11 调整）：拼多多女装 T 恤单款填表助手。** 自动填表、上传准备好的图片、核对 SKU/价格/库存，最后由人工检查并在平台发布。批量、AI 素材、多平台和通用异常恢复全部延期。真实录入表单、店铺设置、本地选图和配置复用已接入；验收状态与限制见 [MVP 使用与验收](docs/52-mvp-handoff.md)，范围见 [MVP 方案](docs/51-mvp-scope.md)。

## 网页工作台（真实任务入口）

Mac 可双击 [启动工作台.command](启动工作台.command)。本机故障诊断：`npm run workbench:doctor`；一键本地检查：`npm run check:mvp`。实店验收目前按用户要求暂缓，这些本地检查不会操作商家页面。

运行 `npm run workbench:start`（后台常驻），打开 http://127.0.0.1:5173/ 。先确认店铺设置，在表单录入单款资料并选择本地图片，点击“检查资料并载入”，然后打开商家浏览器，选择 T 恤编辑页并“填写并核对”。日常操作不需要 JSON；高级导入保留供调试。首次需登录，工作台不自动发布。停止用 `npm run workbench:stop`，查看进程用 `npm run workbench:status`。详见 [MVP 使用说明](docs/52-mvp-handoff.md)。


## 单款入口（当前可运行）

```sh
npm run pdd:single -- examples/product-package-tshirt-live-test-v2.json .runtime/readback-logistics-context.json
```

终端菜单可填写、独立核对、保存草稿并重开。首次需登录并手动进入T恤编辑页。上述为本机测试输入，不会发布；完整实店统一流程尚未验收。详见 [启动与使用说明](docs/47-single-entry.md)。


本项目帮助商家把服装商品资料转换成拼多多女装发布表单，减少重复录入，后续逐步加入照片识别、素材生成和多平台刊登。

已有本地原型、真实工作台和 T 恤执行器。截至2026-09-10，受控测试商品已完成真实填写、局部修正及保存后重开回读，34项字段匹配、3项素材待人工核实；现有在售商品链接读取也有验证。2026-09-11 已接入简单录入入口、本地选图及配置复用；新入口的限定范围实店验收按用户要求暂缓。不能把上述证据理解为全部女装或自动发布已经完成。当前优先级见 [当前实施方案](docs/00-current-plan.md)。

> 开发进度（2026-09-07）：已实现 React/Vite 原型、领域校验与 JSON Schema（现已接入运行时，见文档37）、内存 Mock API、模拟 Playwright 流程、真实页面只读采集与 T 恤定位契约；下一步实现真实页面只读定位验证和确定性填写回读。

当前已实现：

- 商品基本资料、属性、物流设置与浏览器 localStorage 持久化。
- 实际 SKU 组合、价格库存、商家编码、颜色对应 SKU 图及总库存校验。
- 成衣尺码表覆盖销售尺码校验；明确不把适穿建议混入成衣尺寸。
- 本地模拟任务：冻结商品版本 → 资料校验 → 独立模拟字段存储 → 差异核对 → 人工审核；修改或重置即作废旧任务。
- 阻塞项、待确认项、任务日志和内部审核标记；没有自动发布动作。
- 内存 REST mock：模拟店铺、类目模板、刊登预检、异步任务、审核与结果核查。

## 本地启动

```bash
# 使用 Node.js 24.15 或以上版本（Mock API 直接加载可擦除类型的 TS 模块）
npm install
npm run dev
```

浏览器打开命令输出的本地地址（默认 `http://127.0.0.1:5173`）。资料保存在该浏览器的 localStorage，点击“恢复示例资料”可清除并重置。

```bash
npm test
npm run build
npm run preview
npm run mock:playwright
npm run mock:api
npm run test:api
npm run test:adapter
npm run pdd:inspect -- 'https://mms.pinduoduo.com/'
npm run pdd:analyze
```

`mock:playwright` 需要预览服务已经在 `http://127.0.0.1:4173` 运行，并将审核截图写入 `output/playwright/mock-review.png`。它仅验证本地模拟页面流程。

`mock:api` 在 `http://127.0.0.1:8787` 启动内存 REST 服务；API 契约见 [OpenAPI 文件](openapi/mock-api.yaml)，完整联调步骤见 [模拟 API 测试方案](docs/08-mock-api-test-plan.md)。所有返回均明确标识为 mock，不能用于真实发布或生成商品链接。

`pdd:inspect` 使用独立 Chrome profile 采集已授权真实页面的可见结构，`pdd:analyze` 生成字段覆盖和定位风险报告；两者均不填写、保存或发布。操作步骤见 [真实页面测试手册](docs/09-real-page-testing.md)。

## 已确定的方向

- MVP 聚焦一个拼多多店铺和女装 T 恤叶子类目；连衣裙后置。
- 统一商品数据与平台刊登数据分离；正常浏览器操作使用 Playwright。
- AI 用于识别、文案和异常分析；浏览器 AI 通过受限工具执行，不能决定价格、库存或尺寸。
- 第一版不自动点击最终发布，由商家在平台页面确认；系统负责草稿、校验、恢复与结果回收。
- 草稿可靠性、SKU 正确性和人工节省时间优先于图片、视频生成和多平台。

## 文档导航

| 文档 | 解决的问题 |
|---|---|
| [00 当前实施方案](docs/00-current-plan.md) | 当前范围、真实页面优先级、阶段和最近验收点 |
| [01 产品范围与操作流程](docs/01-product.md) | 服务谁、做哪些功能、用户如何完成一款及一批商品 |
| [02 系统架构与技术决策](docs/02-architecture.md) | 模块边界、部署、任务调度、AI 与 Playwright 如何配合 |
| [03 数据模型与校验](docs/03-data-contract.md) | 商品、SKU、刊登、尺寸、素材、数据库和一致性规则 |
| [04 拼多多执行与恢复](docs/04-browser-workflow.md) | 真实 T 恤页面的定位、联动、上传、草稿、重试和接管 |
| [05 服务接口与 AI 契约](docs/05-api-ai.md) | API、事件、错误码、执行器与模型输入输出 |
| [06 开发计划与验收](docs/06-delivery.md) | 开发任务顺序、里程碑、测试矩阵和指标口径 |
| [07 平台勘察与依据](docs/07-discovery.md) | 未验证事项、真实字段登记表、证据和技术来源 |
| [08 商用工具与公开源码借鉴](docs/08-existing-solutions.md) | 妙手、甩手、速卖通案例、浏览器 AI 和素材组件的覆盖范围 |
| [08 模拟 API 联调与测试](docs/08-mock-api-test-plan.md) | 可启动 REST mock、OpenAPI 契约和自动化联调方案 |
| [09 真实页面测试手册](docs/09-real-page-testing.md) | 只读采集、真实填写、草稿和重开验证顺序 |
| [10 T 恤双状态采集结论](docs/10-real-capture-findings.md) | 初始态与联动态差异、定位策略和当前证据 |
| [12 真实定位跟进](docs/12-real-locator-followup-2026-09-07.md) | 用户测试失败原因、自定义控件修复和现场复测结果 |
| [13 真实基础执行](docs/13-real-basic-execution-2026-09-07.md) | 两字段真实填写命令、SKU 区域证据与边界 |
| [14 真实 SKU 执行](docs/14-real-sku-execution-2026-09-07.md) | SKU 数值填写、启停清零、ProductPackage 桥接与实测结果 |
| [15 自动创建矩阵](docs/15-real-matrix-creation-2026-09-08.md) | 从空白规格区生成标准完整矩阵并接续 SKU 填写 |
| [商品输入 JSON Schema](schemas/product-package.schema.json) | 可机读的最小输入结构；不替代业务和平台校验 |
| [示例商品资料](examples/product-package.json) | 三个实际 SKU、实测尺寸、素材关系和刊登数据示例 |
| [示例库存 CSV](examples/variants.csv) | 面向导入开发的颜色尺码库存格式 |

## 阅读与实施顺序

1. 阅读 01、02，确认范围和执行边界。
2. 阅读 07、10，了解真实 T 恤页面证据和仍未验证的写入行为。
3. 按 03、04 实现真实 Adapter 的定位、填写、回读和草稿闭环。
4. 真实单款和草稿可靠性通过后，再按 06 建设持久任务和批量能力。

官方 API 权限验证继续后置，首版浏览器路线不依赖该权限。当前已有真实页面只读证据，开发顺序调整为先验证 T 恤浏览器 Adapter，再扩大后台与批量投入。模拟通过与实店可用分别验收，不能把模拟结果作为真实商品链接。

示例中的售价、库存、尺寸、颜色均为虚构测试数据；素材为占位路径，没有真实图片。示例不能直接用于发布。运行依赖、模型版本和官方接口覆盖范围应在各自接入阶段锁定并记录。

## 最近验证

2026-09-07：领域测试、Mock API 测试、Adapter 契约测试、前端构建和模拟 Playwright 流程通过；真实页面采集确认初始态 28 个输入、联动态 92 个输入。尚未验证真实写入、草稿保存与重开。

## 文档维护规则

- 设计变更同时更新相关文档、Schema、示例和验收条件。
- 新平台事实必须登记验证店铺范围、叶子类目、日期和证据；截图与日志应去除登录凭证。
- 不能把“提交成功”登记为“已上架”，不能把示意图上的限制写成未经验证的平台常量。
- 进度声明必须区分模拟通过、只读页面观察、真实写入通过、草稿通过和真实发布结果。

基础字段真实烟测：`npm run pdd:fill-basic -- examples/pdd-basic-smoke.json` 默认只预检，加 `--apply` 仅填写测试标题和货号并回读，不保存或发布。具体步骤见文档 13。新增回归命令：`npm run test:execution`。

SKU 预检：`npm run pdd:fill-sku -- examples/pdd-sku-smoke.json`，加 `--apply` 执行现有规格矩阵的数值填写及回读。新回归命令：`npm run test:sku`。不会创建颜色尺码、上传图片、保存或发布。

自动创建完整规格矩阵：`npm run pdd:prepare-skus -- examples/pdd-matrix-smoke.json`，加 `--apply` 创建颜色、尺码并接续 SKU 填写回读。当前支持中国码和完整颜色×尺码组合，稀疏组合及有数据的规格改建会停止。回归命令：`npm run test:matrix`。

尺码表填写：`npm run pdd:fill-size -- examples/pdd-size-smoke.json` 默认预检，`--apply` 填写成衣肩宽、胸围单值并回读。当前真实页四项尺寸验证通过，未保存或发布；完整流程仍待素材、物流与草稿闭环。回归：`npm run test:size`。详见 [16 真实尺码表](docs/16-real-size-chart-2026-09-08.md)。2026-09-08 最新全量验证：49 项测试及构建通过。

轮播图：`npm run pdd:upload-images -- examples/pdd-carousel-smoke.json` 默认只读预检，`--apply` 才顺序上传。空主图区两张测试图真实上传及顺序观察通过，内容核验/草稿仍未完成。详见 [17 真实轮播图上传](docs/17-real-carousel-upload-2026-09-08.md)。最新全量验证：57 项测试及构建通过。

SKU 图片：`npm run pdd:upload-sku-images -- examples/pdd-sku-images-smoke.json` 默认预检，`--apply` 按颜色＋尺码上传空预览图。S/M 两行真实上传回读通过，SKU 数值保持一致。见 [18 真实 SKU 图片](docs/18-real-sku-images-2026-09-08.md)。最新全量验证：63 项测试及构建通过。

详情图：`npm run pdd:upload-detail-images -- examples/pdd-detail-images-smoke.json` 默认预检，`--apply` 在未编辑详情区逐张上传。两张测试图实测顺序和加载状态通过，当前保守输入限制不支持任意长图。见 [19 真实详情图](docs/19-real-detail-images-2026-09-08.md)。最新全量验证：68 项测试及构建通过。

发货时效：`npm run pdd:fill-shipping -- examples/pdd-shipping-smoke.json` 默认预检，`--apply` 填写明确指定的 24/48 小时发货及揽收。真实切换回读通过，隐藏运费模板仍未验证。见 [20 发货时效](docs/20-real-shipping-2026-09-08.md)。最新全量验证：72 项测试及构建通过。

持续开发入口：[21 执行计划](docs/21-development-execution-plan.md)，包含状态审计、阶段依赖、未完成清单及验收标准。

统一编译：`npm run pdd:compile-package -- examples/product-package-tshirt.json output/package-plan/tshirt.json`，生成 7 模块计划和未覆盖项，当前不执行浏览器。见 [22 统一编译](docs/22-unified-package-compiler.md)。最新 78 项测试及构建通过。

独立单选属性已接入统一编译，真实袖长选择和领型回读通过；依赖属性仍待补。见 [23 独立属性](docs/23-independent-attributes.md)。最新 82 项测试及构建通过。

面料联动：`npm run pdd:fill-fabric -- examples/pdd-fabric-smoke.json`，默认预检。见 [24 面料依赖](docs/24-fabric-dependencies.md)。最新 86 项测试及构建通过。

风格联动：`npm run pdd:fill-style -- examples/pdd-style-smoke.json` 默认预检，`--apply` 执行。见 [25 风格依赖](docs/25-style-dependency.md)。最新 91 项测试及构建通过。

流行元素多选：`npm run pdd:fill-elements -- examples/pdd-elements-smoke.json` 默认预检，已接统一编译。见 [26 流行元素](docs/26-fashion-elements.md)。最新 96 项测试及构建通过。

2026-09-09：运费模板选择与完整配送规则回读核心实测通过，已查明隐藏原因为服务区折叠；新增按店铺和物流配置键绑定的统一编译、配置冻结及执行指纹。真实店铺身份、整表核对和草稿仍未通过。见 [27 运费模板与配置绑定](docs/27-freight-template.md)。

本轮全量验证：94 项 Node 测试＋8 项 Vitest 测试，共 102 项通过，TypeScript 检查与生产构建通过。

2026-09-09：参考价与满2件折扣已接统一编译，真实测试页填写及双字段回读通过，SKU 交易字段保持一致。库存扣减方式已观察但尚未接核验，其他服务及整表、草稿仍待完成。见 [28 参考价与折扣](docs/28-reference-price-discount.md)。

本轮全量验证：99 项 Node 测试＋8 项 Vitest 测试，共 107 项通过，TypeScript 检查与生产构建通过。

2026-09-09：新增九项服务字段只读核验及统一输入配置，真实测试页回读一致；可选承诺不自动勾选，差异返回明细。见 [29 服务回读](docs/29-service-readback.md)。整表与草稿仍待完成。

2026-09-09：加绒、平方克重、支数三项接入属性执行及统一编译，真实测试页从空值填写回读通过。见 [30 纺织属性](docs/30-textile-attributes.md)。

最新全量验证：105 项 Node 测试＋8 项 Vitest，共 113 项通过，TypeScript 检查与生产构建通过。

2026-09-09：品牌精确可见选项接统一编译，测试无品牌选择回读通过；未知品牌不自动默认。资质确认为不同的凭证选择器，新增显式未验证阻断。见 [31 品牌与资质](docs/31-brand-and-qualification.md)。

最新全量验证：107 项 Node 测试＋8 项 Vitest，共115项通过，TypeScript 检查与生产构建通过。

2026-09-09：新增独立综合回读入口，真实测试26项一致、4个模块未覆盖，报告仍为 incomplete。见 [32 独立回读](docs/32-independent-readback.md)；整表和草稿未完成。

最新全量验证：109项Node测试＋8项Vitest，共117项通过，TypeScript检查及生产构建通过。

2026-09-09：尺码表接入综合独立回读，真实测试发现S/M肩宽各0.5cm差异，保留现场和预期。三类图片仍未覆盖，整单未通过。见 [33 尺码独立回读](docs/33-size-independent-readback.md)。

最新全量验证：110项Node测试＋8项Vitest，共118项通过，TypeScript检查及生产构建通过。

2026-09-09：三类图片接入独立回读，实测发现M码缺图、详情图数量不符；主图素材身份待核实。当前26项一致、3项差异、1项待核实，整单未通过。见 [34 图片独立回读](docs/34-media-independent-readback.md)。

最新全量验证：113项Node测试＋8项Vitest，共121项通过，TypeScript检查及生产构建通过。

2026-09-09：素材引用核验接入综合报告，核对作用域、当前文件哈希和远程地址；本轮为隔离验证，真实上传记录产生与持久化尚未接通，视觉审核仍保留。见 [35 素材引用](docs/35-media-reference-binding.md)。

最新全量验证：116项Node测试＋8项Vitest，共124项通过，TypeScript检查及生产构建通过。

2026-09-09：三类图片任务接入意图/结果/失败持久记录及receipt生成，重复范围阻断。当前为本地生命周期和已有模块回归，新入口尚未真实端到端验收。见 [36 上传任务记录](docs/36-media-upload-journal.md)。

最新全量验证：119项Node测试＋8项Vitest，共127项通过，TypeScript检查及生产构建通过。

2026-09-09：完整主图任务至引用核验的隔离浏览器集成测试通过，新增只读任务记录检查，未知或失败不允许盲重试。最新121项Node＋8项Vitest共129项测试及构建通过；真实新入口验收仍待完成。

2026-09-09：ProductPackage接入严格运行时JSON Schema，未映射属性进入逐项覆盖和阻断清单，不自动转换或删除输入。见 [37 运行时校验](docs/37-runtime-schema-and-coverage.md)。

最新全量验证：125项Node测试＋8项Vitest，共133项通过，TypeScript检查及生产构建通过。

2026-09-09：页面字段覆盖清单接综合报告，真实停留超时弹窗被识别为阻断；缺字段和未知区域不视为覆盖，尚未完成全页面覆盖验收。见 [38 页面覆盖](docs/38-page-field-coverage.md)。

最新全量验证：128项Node测试＋8项Vitest，共136项通过，TypeScript检查及生产构建通过。

2026-09-09：关闭超时提示后重新采集43个可见表单区域，补服务/尺码/SKU区域与读取器映射，实际输入及未映射缺口已列明；平台报错与M码缺图一致。详情见文档38追加记录。

最新全量验证：129项Node测试＋8项Vitest，共137项通过，TypeScript检查及生产构建通过。

2026-09-09：按原冻结测试输入补M码图片并修正尺寸，SKU及S码图片保持一致；综合回读27项匹配、1项差异、2项待核实，页面缺图错误摘要消除。详情数量与尺码同步仍需处理。见 [39 测试页修复](docs/39-test-page-repair.md)。

2026-09-09：尺码详情同步开关接统一编译、执行和独立回读，真实测试按原输入从true改为false。综合回读28项匹配、1项差异、2项待核实，详情数量仍不符。见 [40 尺码同步](docs/40-size-detail-sync.md)。

最新全量验证：132项Node测试＋8项Vitest，共140项通过，TypeScript检查及生产构建通过。

2026-09-09：核对实际缩略图与原上传记录后，按冻结输入移除多余正面测试详情图，保留背面图地址不变。新增精确完整序列保护的单图修正模块。见 [41 详情图修正](docs/41-detail-image-correction.md)。

再次真实综合回读：28项匹配、0项差异、3项素材待核实；输入/覆盖阻断仍在，非整单通过。最新134项Node＋8项Vitest共142项测试及构建通过。

2026-09-09：单选属性支持有界虚拟列表滚动，真实选择2026年秋季及其余四项普通属性通过；新增修订2虚构测试输入，旧输入保留。见 [42 虚拟下拉与测试v2](docs/42-virtual-options-and-test-v2.md)。

修订2真实综合回读33项匹配、0项差异、3项素材待核实，普通属性缺口消除；其余资质/运费等阻断保留。最新136项Node＋8项Vitest共144项测试及构建通过。

2026-09-10：补充可见页面店铺身份读取和整表回读绑定校验。修复按钮先于二维码就绪造成的空白页后，真实编辑页身份读取及整表前后两次核验通过；统一写入门禁尚未全接入。见 [43 店铺身份核验](docs/43-shop-identity.md)。

店铺核验后真实回读仍为33项字段匹配、0项差异、3项素材待核实；最新143项Node＋8项Vitest共151项测试及构建通过，非完整上架验收。

2026-09-10：店铺绑定纳入执行指纹；统一素材任务apply强制绑定，上传前后核验身份，变化后保留任务与已上传明细。144项Node＋8项Vitest及构建通过；真实组合上传未验收。见 [44 素材店铺门禁](docs/44-media-shop-write-gate.md)。

2026-09-10：运费测试配置接真实整表回读，模板与完整配送规则匹配；报告改为区分6项已证实实时要求与7项保留阻断。34项匹配、0项差异、3项素材待核实；147项Node＋8项Vitest及构建通过。见 [45 物流与阻断证据](docs/45-logistics-and-readback-blockers.md)。

2026-09-10：首次真实测试商品保存草稿成功，新标签页重开后34项字段匹配、0项差异；适配保存后的折扣摘要及运费选择归一化。SKU/详情图URL被平台改写，素材内容仍待核实，未发布。见 [46 真实草稿保存重开](docs/46-real-draft-save-reopen.md)。
