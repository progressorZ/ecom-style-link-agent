# 发货及揽收时效（2026-09-08）

## 本轮交付

新增 `scripts/pdd-shipping-dom.mjs`、`scripts/pdd-shipping-adapter.mjs`、`scripts/pdd-fill-shipping.mjs` 和 4 项测试。限定新建女装 T 恤编辑页，支持显式指定 24 或 48 小时发货及揽收，不推断商家的履约能力。

计划 scope 为 `pdd-tshirt-shipping-v1`，包含 `productCode`、数字 `shipmentHours`。所有额外字段拒绝，避免调用方传入运费模板却被静默忽略。当天发货、截单时间、预售及其他服务承诺尚不支持。

## 真实观察

`service.shipment_limit_second` 区域可见，原生 radio 对应：48 小时发货及揽收、24 小时发货及揽收、当日发货及揽收。24 小时文字旁有“获额外流量扶持”附加标记，识别时仅移除该已观察标记，未知选项文本会停止。

`service.is_default_template_id` 虽在 DOM 中存在，实际位于 `#cost_template_id.template-box` 的 display:none 容器内。隐藏默认模板不作为商家已确认值，不点击或强行显示。报告将其记录为 `hidden_unverified`、verified:false；不保存隐藏默认选项的具体内容。

## 执行保护

- 核对编辑页 URL、精确类目、商品货号；每次读写重新检查。
- 唯一可见时效区域、唯一已选 radio、无重复或未知选项，目标控件必须可用。
- 默认只读预检；应用时仅在目标未选中时点击，重新按语义获取元素。
- 点击后读取实际 checked 状态，再做一次最终回读，不将点击成功等同于设置成功。
- 异常保留 before、changed 和 interactionMayHaveOccurred，停止且不自动重试。

该模块只核验发货时效子集，未证明其他字段没有联动变化。所有结果 fullProductVerified:false。

## 使用

```bash
npm run pdd:fill-shipping -- examples/pdd-shipping-smoke.json
npm run pdd:fill-shipping -- examples/pdd-shipping-smoke.json --apply
npm run test:shipping
```

默认只读；`--apply` 才修改。示例为测试货号 `AUTO-MATRIX-20260908-02`、48 小时。真实商品应由商家明确提供时效。进入唯一的新建 T 恤编辑页、匹配货号后按终端提示继续。默认 profile `.runtime/pdd-inspection-profile`，可用 `PDD_PROFILE_DIR` 覆盖，不与占用同 profile 的其他测试浏览器并行。

## 验证

2026-09-08，测试页由 48 小时改为 24 小时并回读，再恢复到 48 小时并回读，两次 `shipping_subset_verified`。仅改变未发布测试页，不代表真实商品履约承诺已生效。未点击保存草稿或提交并上架。

报告：`output/playwright/real-shipping/dev-2026-09-08/report.json`。现场通过 Playwright CLI 注入同一执行核心完成，不宣称完整人工登录 CLI 已端到端验收。

新增 4 项测试覆盖严格计划校验、只读预检、重复运行不再点击、隐藏模板不误报、禁用/歧义/隐藏/错误身份阻断及页面事件撤销选择。全量 72 项测试及生产构建通过。

## 后续

运费模板隐藏原因和有效配置来源仍需通过页面行为确认。不能直接操作隐藏 radio、把推荐模板当作商家选择或声明整套物流通过。继续补完整商品属性和整表核对，随后验证保存草稿与重开。
