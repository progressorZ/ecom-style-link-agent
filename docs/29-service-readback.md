# 服务字段独立回读

2026-09-09，已测试店铺的新建女装 T 恤页面。目标是将已有服务配置显式核验，避免把默认值当成确认结果。

## 覆盖字段

| 输入 expected 键 | 当前支持/回读方式 |
|---|---|
| goodsType | 普通商品，读取选中 radio 的原生 checked |
| secondHand | 非二手，同上 |
| customized | 非定制，同上 |
| presale | 非预售，同上 |
| nearbySameDay | 明确 boolean，周边区域当天发货 checkbox |
| sevenDayReturns | true，原生 checkbox checked，允许平台禁用该必选项 |
| authenticityPromise | 明确 boolean，假一赔十 checkbox |
| groupSize | 2，拼单人数区域只读文本 |
| inventoryDeduction | payment_success，对应库存扣减方式“支付成功减库存” |

所有值必须显式提供。其他商品类型、定制、二手、预售和其他拼单人数目前拒绝编译，不假设其依赖字段与普通现货相同。两项可选承诺可以核对 true 或 false，模块不自动开通或取消。

## 实现和命令

`scripts/pdd-services.mjs` 包含输入编译、独立页面回读、差异比较三个函数。`verifyServices` 是只读操作，检查当前 URL、类目和货号，读取全部字段后再次检查页面身份。可见区域、精确标签或控件不唯一时抛错；checkbox 不确定态拒绝；隐藏服务区不会通过核验，需要先展开。

```bash
npm run pdd:check-services -- examples/pdd-services-smoke.json
npm run test:services
```

命令不接受 --apply，不修改商品服务。不同值返回 `services_mismatch` 和逐字段 differences，CLI 退出码为 2；只有字段都一致才返回 `services_subset_verified`。前端没有连接此真实模块。

统一输入新增可选 `listing.services`，结构由 ProductPackage Schema 描述。它包含表中除 inventoryDeduction 以外的八个字段；库存扣减仍取自 `listing.logistics.inventoryDeduction`，不产生第二份业务来源。服务缺失时保留 services_configuration_missing，提供完整输入后生成 services 核验步骤但保留 services_live_readback_required、inventory_deduction_unverified 等阻断。尚未接统一执行，因此编译不能证明当前页面已通过。

可从独立 smoke 的 expected 复制八个服务字段到虚构 ProductPackage 测试输入。真实商品需要商家确认，不能复制 smoke 作为真实履约承诺。

## 证据与边界

真实测试货号 `AUTO-MATRIX-20260908-02`，通过现有 CLI 注入相同回读核心；九项一致，七天退货 disabled=true，额外周边当日承诺与假一赔十均为 false。报告：`output/playwright/real-services/dev-2026-09-09/report.json`。

没有更改服务，没有保存草稿或发布。这证明当前页面九项可读及值一致，不证明店铺身份已验证、所有服务规则覆盖、草稿持久化或完整商品通过。独立交互式 CLI 入口仍需单独验收。

隔离测试覆盖完整输入、只读且无 DOM 修改、额外承诺差异保留、隐藏/歧义/货号不符拒绝，以及统一编译保持阻断。后续将此回读函数纳入独立整表 ObservedForm；服务写入需逐项补相应依赖与页面证据，不能通过勾选强制绕过差异。

该模块落地时全量验证为 104 项 Node＋8 项 Vitest，共112项通过；后续最新结果见当前方案入口。
