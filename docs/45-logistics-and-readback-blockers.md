# 物流整表回读与阻断证据（2026-09-10）

## 真实验证

以现有虚构商品包 `examples/product-package-tshirt-live-test-v2.json` 和旧的独立运费测试期望为输入，将店铺绑定与运费配置一起传给统一编译、独立整表回读。只读取原测试编辑页，没有改动运费规则、保存或发布。

结果保存在 `output/playwright/real-package-readback/v2-logistics-2026-09-10/`：

- input.json：虚构测试商品输入。
- context.json：本次店铺与运费测试配置。
- report.json：34项匹配、0项差异、0项不可读、3项素材待核实；店铺前后核验匹配；fullProductVerified=false。

新增匹配项 listing.logistics.freight 同时比较 mode、templateName、全部配送分组文本。既包含包邮地区，也包含西藏/新疆的首件及续件运费，以及不配送地区。只有模板同名而分组不符不会通过。

context 中 confirmation.reference 明确标记 test-fixture-only。confirmed=true 仅确认本次测试期望，不表示商家同意这些规则用于正式商品；真实商品的商务确认仍缺失，商品包 unconfirmed_evidence 阻断保留。该 context 不作为正式店铺配置范例推广。

## 回读报告改进

新增 `scripts/pdd-readback-blockers.mjs`：只处理已有独立阅读器能证明的编译期实时阻断。报告输出 unresolved `blockers` 和 `resolvedBlockers` 两组，后者包含所依据的检查ID。

本次实时证据解决六项：

- pricing_live_readback_required → listing.pricing
- freight_live_readback_required → listing.logistics.freight
- services_live_readback_required → 当前服务计划的全部期望字段
- inventory_deduction_unverified → services.inventoryDeduction
- live_shop_identity_unverified → 完全匹配当前冻结店铺绑定的 shopIdentity
- size_detail_sync_live_readback_required → listing.sizeConfiguration.syncChartToDetail

匹配条件要求检查ID唯一、status=matched、expected/observed 均存在且一致。重复、缺失、不可读、数据不一致均不能清除阻断。编译计划本身不变；它没有浏览器证据，仍列出所有实时要求。

此分类只供诊断，不是发布授权门禁；外部提供一份 JSON 报告不能证明真实页面状态。整个回读状态继续 incomplete，保存和发布标志继续 false。

## 仍需完成

报告保留属性必填覆盖、品牌实际选择、商品资质、类目绑定、尺码模板、完整整表能力与真实数据确认等七项编译阻断。另外素材内容仍待核实；页面覆盖尚有商品资质、包装标签图、三类视频未完整接入。不能把“输入字段全部匹配”当作“全部页面字段验证通过”。

下一步需要明确并验证这些页面区域，接入统一执行生命周期，最终验证草稿保存与重新打开后的一致性。

## 测试

147项Node测试、8项Vitest及生产构建通过，共155项。新增测试验证仅消除有证据支持的已知阻断，错店ID、重复或缺失检查不会放行，资质与整表缺口不能被字段匹配数掩盖。
