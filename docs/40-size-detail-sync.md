# 尺码表详情同步开关

2026-09-09。新增pdd-size-sync.mjs，接统一编译sizeSync步骤与独立综合回读。

## 契约和控件

输入包含scope=pdd-tshirt-size-sync-v1、productCode和明确boolean enabled，不接受字符串或默认推测。ProductPackage取listing.sizeConfiguration.syncChartToDetail。

真实控件位于newSpec中的sizeChart_sizeSpecSyncDetailCheckWrapper区域，原生checkbox隐藏，旁边显示“尺码表同步添加至「商品详情」”。读取checked/disabled/indeterminate；执行点击唯一可见Beast checkbox标签，不能强制点击隐藏input。禁用、歧义、弹窗或货号不符停止。已符合目标时不重复切换。

```bash
npm run pdd:fill-size-sync -- examples/pdd-size-sync-smoke.json
npm run pdd:fill-size-sync -- examples/pdd-size-sync-smoke.json --apply
```

默认只读预检，执行后核对布尔值。detailEffectsVerified=false：此模块不证明自动生成详情内容、图片持久化或下次重开效果。

## 真实结果

货号AUTO-MATRIX-20260908-02。第一次使用原生隐藏input的setChecked超时，未成功点击；修正为可见label后，从true切换false，与原冻结输入一致。测试覆盖隐藏input、可见label模式。

独立综合回读结果28 matched、1 mismatch、2 unverified。详情图片区仍为2张，而预期1张，因此关掉同步没有即时消除当前详情数量差异；不能推断多图全由尺码同步造成。

证据：output/playwright/real-size-sync/dev-2026-09-09/report.json；综合报告output/playwright/real-package-readback/after-sync-2026-09-09/。通过CLI注入相同执行核心，独立交互式入口仍待验收。未保存草稿或发布。

## 验收和后续

独立回读新增listing.sizeConfiguration.syncChartToDetail检查；newSpec区域同时要求尺寸和同步两项读取器存在。保留size_detail_sync_live_readback_required及整单完整性阻断。后续核实两张详情图各自内容和来源，再按预期处理；不能修改输入数量来掩盖差异。

最新全量验证：132项Node测试＋8项Vitest，共140项通过，TypeScript检查及生产构建通过。
