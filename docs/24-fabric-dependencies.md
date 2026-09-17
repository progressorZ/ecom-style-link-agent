# 面料与派生材质（2026-09-08）

新增 `scripts/pdd-fabric.mjs` 和 `pdd:fill-fabric`。前一目标轮已实现独立属性执行，属于进展，本轮补依赖顺序而非扩大独立下拉白名单。

输入必须同时提供 fabricName、material、composition。先选择面料，等待材质和成分标签可见，只读核对平台派生材质，再选择成分，最后重新核对三项。材质可禁用或只读；共享 DOM resolver 只有显式 allowReadOnly 且非 target 时才允许读取，不能点击锁定控件。

选择面料可能触发新字段，因此预检会标识依赖字段出现、材质派生、成分选项尚待执行确认。运行失败保留 before 和 completed，不自动回滚。当前只接受已渲染精确选项，不支持虚拟列表滚动；不能处理需要手动编辑多种材质的复合成分结构。

ProductPackage 如果提供三项中任一项，就必须提供完整三项；会生成 fabric 步骤，排在其他属性之前。整体属性覆盖仍有阻断，不宣称整单 ready。

```bash
npm run pdd:fill-fabric -- examples/pdd-fabric-smoke.json
npm run pdd:fill-fabric -- examples/pdd-fabric-smoke.json --apply
npm run test:fabric
```

示例“棉 / 棉 / 95%及以上”为虚构测试资料，非实物结论。这里 composition 是平台成分区间标签，不是精确化学成分比例；真实供应商成分需保留原始事实，后续显式映射，不能用区间覆盖原始比例。

真实观察：选择棉后平台新增材质（禁用且值为棉）与成分含量。自动执行实测开始时面料已选好，完成成分选择并核对三项；初始空白到动态字段出现的自动路径目前由隔离测试覆盖。现场不能描述为全程自动选择面料已验收。

报告：`output/playwright/real-fabric/dev-2026-09-08/report.json`，测试商品 `AUTO-MATRIX-20260908-02`。未保存或发布。只证明三字段子集，不证明其他属性无联动变化。

新增 3 项适配器测试和 1 项统一编译测试，覆盖延迟字段、锁定派生值、派生不符及后续回写篡改、完整绑定。全量 86 项测试及构建通过。

继续完成多选、主风格联动、长列表、参考价/折扣、完整必填覆盖及整表核对。目标未完成。
