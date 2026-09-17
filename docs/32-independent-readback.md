# 独立商品回读入口

2026-09-09。新增 `scripts/pdd-readback.mjs` 和 `pdd:check-package` 命令，将真实页面多个区域合并为同一份只读报告。

```bash
npm run pdd:check-package -- /path/to/product-package.json
npm run test:readback
```

当前 CLI 只接收商品文件，不接外部运费配置文件；函数 API 可传与 compileProductPackage 相同的 freightProfiles 参数。命令无 --apply，报告未完整通过时退出码为2。

## 数据链与证据

重新编译并冻结输入 → 页面身份检查 → 从当前 DOM 逐项读取 → 比较预期与页面值 → 再次身份检查 → 统一报告。

不读取之前填写模块的 success/verified 标记。复用无写入的 DOM 观察函数；品牌回读文字本身不能证明选择动作或品牌授权，相关阻断继续保留。SKU 按颜色/尺码键定位，报告保留每行实际读出的交易数值；不将数组顺序当业务身份。

已接入：标题/货号、品牌文本、独立属性、面料派生值、风格、多选集合、SKU 矩阵交易字段、参考价/折扣、发货时效、服务字段，以及有配置时的运费规则。

状态区分 matched、mismatch、unreadable、uncovered。缺控件或不支持读取记录 unreadable；当前无法集成的步骤记录 uncovered。身份改变、货号不符或已有下拉弹层直接终止。每项观察有身份前后检查，但尚非全页面原子快照；后续需增加变化检测，不能据此放行草稿。

整单状态目前始终 incomplete，保留编译 blockers，fullProductVerified=false。输入没提供的可选模块不会凭页面默认值补齐；编译的完整性阻断仍有效。已有固定阻断清单尚需演进为完整字段覆盖契约。

## 本次真实测试

测试货号 AUTO-MATRIX-20260908-02，使用已有虚构资料编译预期，26项 matched、0 mismatch、0 unreadable、4 uncovered。四个未覆盖步骤是 size、carousel、skuImages、detail；运费没有传绑定配置，保留运费未验证阻断。

证据位于 `output/playwright/real-package-readback/dev-2026-09-09/` 的 input.json 和 report.json。使用 Node 先编译冻结计划，再通过现有 CLI 注入同一回读核心；未测试完整交互式 CLI。没有保存或发布，不代表整表验收完成。

## 验收与下一步

隔离浏览器测试证明直接读取当前 DOM 的新值、不修改 DOM、报告不可读与未覆盖、错误身份和弹层拒绝。接下来接尺寸与图片独立回读，并补覆盖契约、页面错误和店铺身份核验，然后才能推进草稿闭环。

最新全量验证：109项Node测试＋8项Vitest，共117项通过，TypeScript检查及生产构建通过。
