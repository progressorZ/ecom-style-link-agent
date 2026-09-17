# 商用工具与公开源码借鉴清单

调研日期：2026-09-06。检索了厂商官网、帮助中心、GitHub 项目和部分源码；没有登录试用商用服务、安装运行这些项目或验证拼多多实店。厂商功能描述与作者自述不等于本项目的验收结果。

## 1. 结论

市场已有拼多多上货、商品管理和素材加工工具；公开源码也有相近的其他平台发布流程，以及可复用浏览器组件。本轮未找到能够凭公开证据确认“实物服装照片→可信商品资料→拼多多女装完整刊登→批量真实链接”的成熟开源成品。该结论限于本轮检索，不表示市场绝不存在。

本清单不改变 2026-09-07 的最新主线：先验证自建 T 恤真实 Adapter、草稿和重开。商用工具作为 R4 前的买建比较项；没有实际试用和受支持集成方式前，不替换当前浏览器验证链路。

## 2. 商用功能对照

| 工具 | 已有公开证据 | 对本项目的价值 | 待试用确认 |
|---|---|---|---|
| [拼多多妙手](https://pdd.91miaoshou.com/) | 官网列出商品价格/库存/属性编辑、批量修改、白底图生成上传、主图视频上传等 | 直接对照商品管理与素材能力 | 从自有本地图片新建女装、缺码 SKU、尺码表、草稿审核、数据导入/开放集成 |
| [甩手拼多多上货助理](https://www.shuaishou.com/services/ServiceList.aspx) | 官方服务目录说明将其他平台商品转换、编辑并上传到拼多多 | 学习上货任务、字段转换与批量编辑 | 没有来源商品链接时的原创商品创建能力；女装字段覆盖 |
| [店小秘](https://help.dianxiaomi.com/faq/orderFAQ/1355) | 官方教程包含采集、搬家、创建产品等刊登入口，列举跨境平台 | 学习资料暂存、认领、编辑、平台刊登的操作结构 | 不能把支持 Temu 或采集拼多多商品视为支持国内拼多多新建刊登 |

妙手官网明确列出团购价、单买价、市场价的批量编辑，再次说明内部 sale 不能未经确认映射全部平台价格。此证据来自软件描述，不足以推断当前目标类目的具体必填价格。

甩手服务目录在搜索中取得官方内容，直接打开出现抓取错误；购买前核对当前服务页。没有核查具体价格和套餐，不据第三方教程给出收费承诺。

## 3. 最接近的公开代码案例

[SaturdayGo/ecommerce-ops-automation](https://github.com/SaturdayGo/ecommerce-ops-automation) 面向速卖通，使用 TypeScript、Playwright 和 YAML。README 覆盖属性、SKU、图片、物流及人工降级，并明确一些模块需人工处理；页面显示 ISC 许可证。本轮阅读 README、许可证页面和以下两个源码文件，未运行项目。

- [execution-plan.ts](https://github.com/SaturdayGo/ecommerce-ops-automation/blob/main/src/execution-plan.ts)：模块选择、smoke/full 模式、执行序列。
- [runtime-supervision.ts](https://github.com/SaturdayGo/ecommerce-ops-automation/blob/main/src/runtime-supervision.ts)：每模块 outcome、运行快照、证据引用与人工介入结构。

工程判断：适合按功能阅读学习，不能直接替换拼多多 Adapter。源码中的单文件状态写入也不能替代我们设计的持久任务、店铺锁及恢复对账。作者标记稳定不等于我们验证稳定，不整仓照搬平台选择器、环境路径或其开发指令。

## 4. 浏览器 AI 候选

| 项目 | 官方公开能力 | 与本项目的匹配与限制 |
|---|---|---|
| [Stagehand](https://github.com/browserbase/stagehand) | act/observe/extract，自然语言与确定性浏览器动作，TypeScript SDK；MIT | 优先评估按步骤识别控件/提取状态；不是拼多多业务 Adapter。当前实现有自己的驱动抽象，接入时验证与既有 Playwright 会话协作，不能假定所有版本可直接替换 Page |
| [Browser Use](https://github.com/browser-use/browser-use) | Python 浏览器 Agent、填表、结构化提取、自定义工具；MIT | 适合验证通用 Agent 动作循环；会增加 Python 接入边界，不承担交易事实判断 |
| [Skyvern](https://github.com/Skyvern-AI/skyvern) | 视觉浏览器工作流、Playwright-compatible SDK、工作流界面；核心仓库 AGPL-3.0 | 可借鉴工作流与执行观测；范围比首版薄封装更大。若决定复用，按选定版本审查许可证和部署条件 |

上述工具都需业务规则、价格库存绑定、发布门禁和结果校验。没有本轮实测证据证明它们能够稳定填写拼多多女装全表；不采用厂商“自愈”宣传作为成功率承诺。

## 5. 商品数据与素材模块

- [Medusa Product Module](https://docs.medusajs.com/resources/commerce-modules/product)：商品选项、变体、类目及工作流设计可供参考；[变体管理界面](https://docs.medusajs.com/user-guide/products/variants) 展示价格、库存批量编辑。工程建议是先借鉴领域划分和表格交互，首版无需为上新助手引入完整商城后端。它不提供本轮已核实的拼多多发布适配。
- [rembg](https://github.com/danielgatis/rembg)：可用于去背景，解决素材加工的一小段；不是商品理解或上新系统。
- [FASHN VTON v1.5](https://github.com/fashn-AI/fashn-vton-1.5)：公开虚拟试穿项目，可在后续素材阶段评测。试穿效果与衣服实物一致性仍需验证，不能生成可信实测尺寸。

素材项目接入时分别核对代码、模型权重及依赖的许可证与计算需求；本轮未做完整依赖审计。ComfyUI、视频生成等不增加到首版依赖，继续遵循已有路线。

## 6. 建议借鉴顺序

1. 先完成 R1～R3 的 T 恤定位、填写、回读和草稿验证。
2. 在 R4 前用同一测试商品试用妙手或甩手，比较字段覆盖、人工时间、费用和可集成性。
3. 草稿闭环成立后，再借鉴速卖通案例的 StepPlan / Job / Review 进入 R5 持久任务设计。
4. 正常流程继续 Playwright；有真实异常集后再评估 Stagehand、Browser Use 或 Skyvern。
5. 素材阶段再单独接入 rembg、试穿服务或模型。

## 7. 商用工具未来试用题

条件具备后，用同一款商品测试，而不是只看上货演示：

- 无来源链接，仅本地图片、货号、真实成分和 SKU，能否创建新商品？
- 黑色 S/M、米白 M 三组合是否准确保留，能否区分缺码与零库存？
- 尺码表能否录入成衣实测值，图片能否按颜色正确关联？
- 能否保存草稿、人工审核、批量返回真实状态和链接？
- 数据能否通过受支持的文件格式/API 导入导出，是否需要额外授权？
- 本款人工操作时间、返工、套餐费用与限制是多少？

如果现成工具能满足本店的大部分流程，应比较“自建资料识别 + 现有上货工具”与全部自建的成本。只有在其有可用集成方式时才能形成产品级组合，不能假定闭源工具一定提供外部 API。
