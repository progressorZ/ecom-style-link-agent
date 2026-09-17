# 加绒、平方克重与支数

2026-09-09，当前已测试店铺女装 T 恤编辑页。

真实展开下拉框后确认三个字段均使用现有单选属性组件。新增 supportedAttributeKeys：attributes.fleece、attributes.gramsPerSquareMeter、attributes.yarnCount；支数此前未登记，现补入定位契约。统一 ProductPackage 的 attributes 自动编译这些字段，仍要求精确非空字符串。

| 字段 | 观察到的选项 | 本次虚构测试值 |
|---|---|---|
| 是否加绒 | 加绒、不加绒 | 不加绒 |
| 平方克重 | 160g/m²以下；从160到300每20g/m²一档；300g/m²及以上 | 160g/m²（含）—180g/m²（不含） |
| 支数 | 21S、32S、40S、60S、80S、100S | 32S |

范围适用于此次页面快照，不作为所有类目或未来平台的固定常量。执行仍选择当次页面上精确匹配的唯一可见选项。克重不使用总衣重替代，也不根据照片推测；区间边界和单位原样保留。当前不会把数字170自动换算成区间，数字输入拒绝。

```bash
npm run pdd:fill-attributes -- examples/pdd-textile-attributes-smoke.json
npm run pdd:fill-attributes -- examples/pdd-textile-attributes-smoke.json --apply
```

执行沿用原属性模块的当前页面、类目和测试货号检查；选项缺失、控件锁定或回读不符停止。示例不是实际商品事实。

测试货号 `AUTO-MATRIX-20260908-02` 三项均从空值填写，回读与预期完全一致。报告：`output/playwright/real-textile-attributes/dev-2026-09-09/report.json`。采用 CLI 注入相同核心执行函数；没有保存或发布。尚未证明整表、草稿重开或真实商品准确。

统一编译回归验证保留平方克重精确区间和支数字符串，并拒绝裸数字。原单选组件的写入、异常与回读测试继续适用。当前剩余品牌、资质、整表覆盖、店铺身份及草稿闭环继续阻断完整验收。

最新全量验证：105 项 Node 测试＋8 项 Vitest，共 113 项通过，TypeScript 检查与生产构建通过。
