# 服务接口、事件与 AI 契约

本文件定义目标应用接口，不是拼多多官方 API 文档。当前仅实现内存 Mock API 的子集；真实 T 恤 Adapter 在本地 Playwright 验证脚本中先行，草稿闭环通过后再接入持久化 `/api/v1` 服务。

## 1. 公共约定

- ID 为系统生成的稳定字符串。客户端不能用外部商品 ID 代替内部 ID。
- 写操作需应用登录态和来源校验；本地单用户也不能向任意网页开放写接口。
- 编辑请求携带 `expectedRevision`；冲突返回 409，不覆盖用户并发修改。
- 创建任务/素材导入携带 `Idempotency-Key`。相同 key+请求 hash 返回原结果，同 key 不同内容返回 409。
- 成功响应 `{data, requestId}`；错误响应 `{error:{code,message,issues,retryable},requestId}`。
- Issue 包含 `code, severity, fieldPath, message, expected?, actual?, suggestedAction?`；severity 为 blocking、confirmation、warning。
- 服务返回的 issue 文案面向商家；DOM 和调试信息通过 evidenceRef 单独提供。
- 202 表示已受理长任务，不能显示“上架成功”。400 格式错误、422 业务不通过、409 冲突、401 应用登录失效、503 worker 不可用。

## 2. 商品、素材和模板接口

| 方法与路径 | 请求 | 结果与行为 |
|---|---|---|
| POST /products | 商品编辑草稿 | 201，productId、revision；允许不完整 |
| GET /products | cursor、limit、status、productCode | 分页列表 |
| GET /products/:id | 无 | 商品、变体、素材关联、尺寸、来源 |
| PATCH /products/:id | patch、expectedRevision | 原子更新、revision+1，使受影响快照/确认失效 |
| POST /products/:id/variants/import | CSV 文本或解析后行、expectedRevision | 预览结果、逐行问题；不立即覆盖 |
| POST /products/:id/variants/commit | importPreviewId、expectedRevision | 提交用户选定的导入结果 |
| POST /assets | multipart 文件 | 导入受控目录，返回 assetId、元数据、检查结果 |
| PUT /products/:id/media | assetId、role、colorKey、order 列表、expectedRevision | 绑定用途与顺序；不等于平台上传 |
| PUT /products/:id/size-charts | 类型、列、行、来源、expectedRevision | 保存结构并校验含义和单位 |
| POST /products/:id/confirmations | fieldPaths、expectedRevision | 由当前用户确认事实，记录 hash；模型不可调用 |
| GET /shops | 无 | 店铺与连接状态，屏蔽会话路径及秘密 |
| PUT /shops/:id/config | 类目绑定、物流默认项、expectedRevision | 保存已选择配置，版本递增 |
| GET /shops/:id/templates | 类目过滤 | 模板列表与验证状态 |

CSV 首版列见 [示例](../examples/variants.csv)。列为 product_code、merchant_sku、color_key、color_label、size_key、size_label、group_price_cny、single_price_cny、stock、enabled、sku_asset_id。UTF-8、标准 CSV 引号规则，价格用十进制字符串解析；空库存为缺失，不转成 0。导入商品货号不匹配时拒绝合并；重复组合报告原行号。

## 3. 刊登、校验与任务接口

| 方法与路径 | 请求 | 结果与行为 |
|---|---|---|
| POST /listings | productId、shopId、categoryBindingKey | 建编辑态刊登，默认阻止重复主刊登 |
| PATCH /listings/:id | 标题、offers、logistics、expectedRevision | 更新本次店铺配置 |
| POST /listings/:id/validate | expectedRevision | Issues、可执行性、规则版本、资料确认要求 |
| POST /listings/:id/prepare | expectedRevision、validationToken | 再验证并冻结快照；202 jobId；目标为填写/草稿，不发布 |
| POST /batches | listingIds 与 revisions | 逐项验证并返回 accepted/rejected；每成功项独立 jobId |
| GET /jobs/:id | 无 | 执行状态、业务阶段、进度、人工处理原因 |
| POST /jobs/:id/pause | reason | 设置 pause_requested，202；到安全点暂停 |
| POST /jobs/:id/resume | expectedSnapshotHash | 校验身份、资料版本、现场后恢复；不盲目重放 |
| POST /jobs/:id/cancel | reason | 停止后续步骤，返回已有外部副作用摘要 |
| POST /jobs/:id/retry | reason、expectedSnapshotHash | 失败任务生成关联新任务，先对账 |
| GET /listings/:id/review | 无 | 预期、观察、差异、快照 hash、证据引用 |
| POST /listings/:id/reviews | decision、snapshotHash、observedHash | 内部审核记录；无最终发布动作 |
| POST /listings/:id/open-review | expectedSnapshotHash | 202，协调店铺锁后打开明确草稿或交互页 |
| POST /listings/:id/check-outcome | 可选人工报告 | 202，排队查询真实发布结果 |
| GET /batches/:id/results.csv | 无 | 所有任务状态与已验证链接 |

v0.1 **不提供 publish 接口**。已有按钮名称中含“保存”但同时含“上线/上架”，也不能作为草稿操作调用。

validationToken 绑定 listing revision、product revision、规则版本和过期时间。prepare 在事务内复查并创建快照、任务；输入改变或规则更新返回 409/422。快照包含完整商品资料、价格库存及已确认依据，确保恢复时可复现。

内部审核通过接口同样检查 snapshotHash、observedHash 与当前版本一致、无 blocking 差异；审核退回保留原因。用户在平台手动修改后，必须重新 observe 并决定将修改纳入新输入快照或恢复原值，程序不能静默选择一方。

## 4. 事件流

`GET /jobs/:id/events` 使用 SSE，支持 Last-Event-ID 重连。事件落库后发送；客户端断线不会导致任务丢失。

```json
{
  "id": "job-demo:17",
  "type": "step.verified",
  "jobId": "job-demo",
  "sequence": 17,
  "occurredAt": "2026-09-06T08:00:00Z",
  "payload": {
    "stepKey": "fill_offers",
    "completed": 3,
    "total": 3,
    "message": "3 个销售规格的价格、库存和图片已核对"
  }
}
```

事件类型：job.queued、job.started、step.started、step.verified、step.retrying、job.waiting_user、job.reconciling、job.succeeded、job.failed、job.cancelled、listing.outcome_observed。进度以已验证步骤或处理项表达；上传耗时不确定时不用虚假线性百分比。

## 5. 标准错误码

| Code | 意义 | 默认处理 |
|---|---|---|
| INPUT_INVALID / REQUIRED_FACT_MISSING | 格式错误或真实资料缺失 | 修改资料 |
| CONFIRMATION_REQUIRED / CONFLICTING_EVIDENCE | 未确认或来源冲突 | 用户确认 |
| INPUT_STALE / RULES_STALE | 输入或规则版本已改变 | 重新验证编译 |
| AUTH_REQUIRED / SHOP_MISMATCH | 平台登录或身份问题 | 暂停店铺队列 |
| LOCATOR_NOT_FOUND / LOCATOR_AMBIGUOUS | 无目标或多个目标 | 有界重观察，AI 诊断可选 |
| PLATFORM_OPTION_UNMAPPED | 属性选项未映射 | 人工选项或维护规则 |
| DYNAMIC_RULE_UNRESOLVED | 动态必填无法收敛 | 维护规则 |
| SKU_SET_MISMATCH / FIELD_READBACK_MISMATCH | 规格全集或值不符 | 阻塞交接，限定修正 |
| ASSET_INVALID / UPLOAD_FAILED / MEDIA_BINDING_UNKNOWN | 素材或绑定问题 | 校验、查询或接管 |
| LOGISTICS_UNAVAILABLE | 模板失效 | 重选已确认配置 |
| PLATFORM_RATE_LIMITED | 页面提示受限 | 暂停按提示处理 |
| DRAFT_SAVE_UNKNOWN / OUTCOME_UNKNOWN | 副作用结果不确定 | reconciling，不直接重做 |
| LEASE_LOST / WORKER_UNAVAILABLE | 执行权或进程不可用 | 停止写入，安全接管 |
| AI_UNAVAILABLE / AI_POLICY_REJECTED | 模型不可用或建议越界 | 转人工，保留正常确定性功能 |

## 6. 浏览器 AI 的调用时机

v0.1 关闭自动 AI 浏览器恢复；v0.1.1 可启用诊断模式。触发：固定定位有界重试失败、未登记弹窗、类目字段语义需要分析。缺少价格、库存、尺寸时直接要求真实数据，调用模型没有意义。

AI 输入仅包含当前任务目的、当前步骤、必要区域的脱敏 DOM/截图、允许的候选控件、业务字段引用、最近错误。禁止包含 Cookie、会话文件、成本或无关店铺页面。页面文字和图片均为不可信内容，不能改变系统权限和任务目的。

模型选型在真实样本上评测：中文字段理解、截图识别、结构化输出稳定性、误操作率、延迟、每款成本；不靠模型自己给出的 confidence 决定执行权限。

## 7. AI 输出及动作门禁

输出严格 JSON，由 Schema 校验；不得执行模型返回的 JavaScript、shell 或任意 XPath。

```json
{
  "decision": "propose_action",
  "reason": "库存字段位于已识别的黑色 M 规格行",
  "pageSnapshotId": "obs-42",
  "action": {
    "tool": "fillBoundField",
    "candidateId": "control-17",
    "bindingPath": "/listing/offers/1/stock"
  },
  "expectedCheck": "exact_bound_value"
}
```

decision 枚举：propose_action、request_user、unsupported。candidateId 由执行器生成并绑定页面观察版本；页面变化后候选失效，必须重新观察。bindingPath 的值由程序从冻结快照取出，模型不能返回自定义交易值。

| 工具 | 允许范围 | 校验 |
|---|---|---|
| inspectRegion | 当前商品编辑相关区域 | 限制输出范围、脱敏 |
| openAllowedSection | 已登记非发布区域入口 | 目标属于本步骤白名单 |
| selectBoundOption | 预编译值对应的候选选项 | 精确匹配绑定值 |
| fillBoundField | 当前步骤目标字段 | 数值来自快照，回读完全一致 |
| uploadBoundAsset | 已验证受控 assetId | 用途、颜色、路径由程序验证 |
| requestHuman | 解释缺失/歧义 | 暂停，不触发任意外部动作 |

不向模型暴露通用 click、任意导航、任意代码执行、删除商品、修改账户设置和最终发布工具。保存草稿由固定流程控制，不能让模型对“保存并上线”自行判断后点击。

策略检查顺序：任务/店铺/页面身份 → snapshot 未过期 → 动作在步骤白名单 → candidate 有效 → binding 正确 → 操作前条件 → 执行 → 回读。AI 建议不能直接修改全局定位器；经维护者复核和回归后才纳入 Adapter。

初始预算：每次异常最多 2 次模型诊断、每任务最多 3 个获准辅助动作、总时限 60 秒；均为可配置限制。达到上限转人工，不能通过模型反复调用形成无限循环。

## 8. 后续识别/文案接口

`POST /products/:id/suggest-attributes`、`POST /listings/:id/suggest-title` 为后续异步能力。输出候选值、证据素材及区域、冲突和未知项，不直接覆盖确认值。确认建议走产品编辑和 confirmation 接口，生成新 revision。

标题只能使用已有证据支持的商品事实；禁止自动补年份、品牌、面料比例等未知信息。图片生成、视频生成也使用独立任务与 Asset 版本，不放进浏览器异常恢复链路。
