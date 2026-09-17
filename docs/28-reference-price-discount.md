# 参考价与满件折扣

更新：2026-09-09。范围：已测试店铺的新建女装 T 恤编辑页。

## 真实字段与执行顺序

商品参考价是唯一可见输入，placeholder 为“应大于商品最大单买价”。满件折扣输入的 placeholder 为“5.0~9.9”；当前件数以“满2件”静态 span 展示，没有观察到件数编辑控件。因此当前只支持 count=2，其他件数在编译阶段拒绝。库存扣减方式目前观察为“支付成功减库存”只读文本，本模块尚未将它纳入核验。

执行前先核对货号、类目、URL、参考价/折扣的唯一可编辑控件，以及完整 SKU 行键和交易字段。按参考价、折扣的顺序原生 fill 并 Tab；每次写入前重读 SKU，最后同时核对两个输入值和固定件数。SKU 发生变化则停止，不通过改 SKU 来迁就参考价。

输入参考价以整数分表示，必须大于全部规格的单买价，包括停用规格。折扣当前采用 5～9.9 的整数或一位小数子集；不允许字符串、两位小数、空值或任意自动舍入。这是针对当前页面的执行限制，不是其他类目的通用平台规则。

## 输入与命令

`scripts/pdd-pricing.mjs` 提供 `compilePricingPlan`、独立 DOM 回读函数 `resolvePricingDom` 和 `executePricing`。输入含 productCode、referenceAmountMinor、multiItemDiscount，以及预期完整 variants（沿用 SKU 执行契约）。

```bash
npm run pdd:fill-pricing -- examples/pdd-pricing-smoke.json
npm run pdd:fill-pricing -- examples/pdd-pricing-smoke.json --apply
npm run test:pricing
```

默认预检不修改页面。示例是虚构测试资料。`--apply` 要求当前货号与完整 SKU 一致；该 CLI 使用独立 profile，运行前结束占用该 profile 的其他浏览器进程。遇到不一致或部分写入失败时输出检查报告，不自动重试、保存或发布。

统一 ProductPackage 编译已生成 pricing 步骤，位于 matrixAndSku 之后，直接引用 listing.pricing 和已编译的 SKU 预期。保留 `pricing_live_readback_required` 及整表核对等阻断，不能凭编译获得可发布状态。

## 真实验收证据

2026-09-09 在测试货号 `AUTO-MATRIX-20260908-02` 上通过 CLI 注入相同执行核心：

| 项目 | 执行前 | 执行后 |
|---|---|---|
| 参考价 | 1002 元 | 1003 元 |
| 折扣 | 9.5 折 | 9.4 折 |
| 满件数 | 2 | 2 |
| S/M SKU | 固定测试值 | 交易字段全部保持一致 |

报告：`output/playwright/real-pricing/dev-2026-09-09/report.json`，状态 `pricing_subset_verified`。独立交互式 CLI 尚未端到端验收。没有保存草稿或发布，未证明草稿持久化、最终平台校验通过、优惠叠加行为或完整商品正确。

隔离浏览器测试覆盖只读预检、整数分、原生写入、SKU/件数不符和锁定字段写前阻断、页面在失焦后改值的拒绝；统一编译测试覆盖顺序和非法价格/件数阻断。

下一步补其他必填与服务字段、独立整表覆盖报告；完整回读一致后进入草稿保存及重开验收。

本轮全量验证：99 项 Node 测试＋8 项 Vitest 测试，共 107 项通过，TypeScript 检查与生产构建通过。
