# 模拟 API 联调与测试方案

## 目的

Mock API 与模拟页面已经用于完成本地契约联调。2026-09-06 又完成真实 T 恤页面的初始态和联动态采集，因此后续主线转入真实浏览器 Adapter；Mock 继续作为领域、异常和回归测试环境，不再作为推迟真实页面验证的理由。

契约文件为 [mock-api.yaml](../openapi/mock-api.yaml)，服务为 [mock-api.mjs](../scripts/mock-api.mjs)，接口测试为 [mock-api.test.mjs](../scripts/mock-api.test.mjs)。所有模拟响应都带 `environment: mock` 或等效状态，结果接口固定返回 `outcome_unknown`，不产生真实商品链接。

## 启动与联调顺序

```bash
npm run mock:api
npm run test:api
```

默认地址为 `http://127.0.0.1:8787`。接口由内存数据提供，重启服务会清除本次创建的模拟刊登和任务。这是开发期行为，后续 PostgreSQL 实现必须保留 HTTP 响应含义和状态流转。

标准联调流程：

1. `GET /health`，断言 `mode=mock`。
2. `GET /api/v1/shops` 与模板接口，选择模拟店铺和类目模板。
3. `GET /api/v1/products/product-demo-A001`，取得商品及三个实际 SKU。
4. `POST /api/v1/listings`，传入拼单价、单买价、参考价、库存与物流，建立编辑态刊登。
5. `POST /validate`，检查规格集合、双价格、参考价、库存与物流。
6. 无 blocking issue 后 `POST /prepare`，获得异步 `jobId`。
7. 轮询 `GET /jobs/{jobId}` 到 `succeeded/draft_ready`。
8. `GET /review`，断言 `differences=[]`；再写入内部审核决定。
9. `POST /check-outcome`，断言没有商品 ID 或 URL，状态为 `outcome_unknown`。

## 测试矩阵

| 编号 | 场景 | 输入或故障 | 断言 |
|---|---|---|---|
| API-01 | 健康与隔离 | 调用 health、shops、templates | 明确 mock/simulated，不能误报已连接 |
| API-02 | 空刊登 | 无物流、无 offers | `validate.executable=false`，返回字段级错误 |
| API-03 | 完整 SKU 集合 | 三个实际规格、拼单价、单买价、参考价和库存 | 可执行，进入 prepare |
| API-04 | 缺 SKU | 少传一个 variantId | `SKU_SET_MISMATCH`，prepare 返回 422 |
| API-05 | 重复 SKU | 同一 variantId 两次 | `SKU_SET_MISMATCH` |
| API-06 | 非法库存/价格 | 负数、小数库存、非整数分、单买价低于拼单价 | `INPUT_INVALID` |
| API-06B | 非法参考价 | 参考价不高于最大单买价 | `REFERENCE_PRICE_INVALID` |
| API-07 | 异步状态 | prepare 后轮询 job | queued → running → succeeded，且有事件 |
| API-08 | 回读核对 | draft_ready 后读取 review | expected 与 observed 一致，差异为空 |
| API-09 | 审核状态 | approved / returned | 只转 `review_ready/needs_input`，不发布 |
| API-10 | 发布门禁 | check-outcome | 仅 `outcome_unknown`，没有商品链接 |
| UI-01 | 正常填表 | 浏览器打开默认商品 | 草稿模拟完成，审核页显示 3 行 SKU |
| UI-02 | 改坏资料 | 清空物流或移除 SKU 图 | 自动填写按钮禁用，显示阻塞原因 |
| UI-03 | 变更失效 | 草稿后修改任意字段 | 内部审核失效，需重新准备 |
| UI-04 | 本地恢复 | 刷新页面、恢复示例 | localStorage 恢复编辑内容；重置只影响本地 |

已有自动化：`npm test` 覆盖领域校验；`npm run test:api` 覆盖 API-01、02、03、07、08、09、10；`npm run mock:playwright` 覆盖 UI-01 并输出审核截图。UI-02～04 和 API-04～06 将在接入真实界面前继续增加自动化回归。

## 后续替换真实平台能力

不删除 `/api/v1` 的领域接口。新增 `pdd-browser` 或已授权官方 API Adapter，在服务内部实现：

- 模拟 `shop/template` 替换为真实店铺身份、已验证类目绑定和版本化规则。
- 模拟 `prepare` 替换为持久化 Job 和 Playwright 执行器；保留 202 + jobId。
- 真实 `review` 必须读回页面字段并给出 differences，不能直接回显输入。
- 真实 `check-outcome` 只在取得平台状态、商品 ID 和链接证据后返回 live；未知继续返回 outcome_unknown。
- 模拟数据、真实店铺 profile、凭证、外部 ID 分库存储和访问控制，禁止互相复用。

当接口实际定义确认后，先更新 OpenAPI、增加契约兼容测试，再改 Adapter。若平台字段与内部 Product Schema 不同，只改编译映射与平台规则，SKU、价格、任务和审核的领域边界保持不变。
