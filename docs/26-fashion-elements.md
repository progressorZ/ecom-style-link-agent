# 流行元素多选（2026-09-09）

前一目标轮风格模块落地，属于进展。本轮新增 `scripts/pdd-elements.mjs`、CLI、测试及统一编译接入。

真实字段为“重要流行元素”，最多三项；选中结果位于 Beast tagGroup 标签，输入框只用于交互，不能作为完整已选值。执行器按集合比较，不依赖标签顺序。

输入 `pdd-tshirt-elements-v1`、productCode、values 数组。values 表示期望完整集合，空数组明确取消全部。开始先检查目标选项和待取消选项全部唯一可见，再逐项取消多余值、补选缺少值。每次重新读标签，核对 option 的 data-checked 与当前标签一致，禁用或状态不符则停止。最后关闭弹层并比较完整集合。

默认预检不写页面，也不提前承诺所有选项可用。复用商家原有选项属于显式集合语义；不自动推断“纯色”等商品事实。

```bash
npm run pdd:fill-elements -- examples/pdd-elements-smoke.json
npm run pdd:fill-elements -- examples/pdd-elements-smoke.json --apply
npm run test:elements
```

ProductPackage 的 attributes.fashionElements 必须为数组，不能用逗号字符串替代，存在该字段时生成 elements 步骤。

2026-09-09 实测在测试商品 `AUTO-MATRIX-20260908-02` 中保留纯色并补选口袋，标签集合回读一致。已有纯色为初探手动选择；满三项替换路径由隔离测试覆盖。报告 `output/playwright/real-elements/dev-2026-09-08/report.json` 的目录名沿用本地 helper，实际本次执行日期为 2026-09-09。未保存草稿或发布。

新增 4 项模块测试和 1 项编译测试：满额先删后加、缺少选项前零修改、点击无效回读阻断、重复/超限计划、数组输入。全量 96 项测试及构建通过。

限制：仅处理已经渲染的选项，虚拟列表查找待补；未知 UI 签名会停止。完整必填覆盖、品牌、价格附加字段、运费有效配置、独立整表核对、统一执行和草稿闭环仍未完成，不标记整单可执行。
