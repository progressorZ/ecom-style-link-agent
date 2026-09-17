# 精确详情图修正

2026-09-09，虚构测试货号AUTO-MATRIX-20260908-02。

## 来源核实

查看了两张详情图的实际缩略图：第1张为“正面测试”，第2张为“背面测试”。当前完整远程地址与早先真实上传报告中front/back的记录一致。冻结输入只要求back.png；未通过修改输入数量回避差异。

截图：output/playwright/detail-first.png、detail-second.png；旧上传来源：output/playwright/real-detail-images/dev-2026-09-08/report.json。本次仅证明测试卡片和来源对应，不涉及真实服装材质/款式判断。

## 新修正模块

scripts/pdd-detail-remove.mjs提供compileDetailRemoval和executeDetailRemoval。计划必须提供测试货号、当前完整有序beforeUrls和唯一removeUrl；当前只支持至少两张中移除一张并保留其他图。

默认dryRun=true；实际执行前两次核对页面、货号、完整URL序列、计数和加载状态。按图的精确地址解析唯一删除控件，只点击一次；之后必须观察到完整剩余序列一致、图片加载及序号有效，才能返回detail_removal_subset_verified。中途改序、缺图、弹窗或未知结果停止，不盲目重试。此模块未接成统一任务的自动修复步骤，不会因任何数量差异就擅自删除图片。

## 实测结果

已移除第1张正面测试卡片，原第2张背面卡片远程地址保持完全一致并变为第1张，数量2→1。没有上传新文件、保存草稿或发布。

报告：output/playwright/real-detail-remove/dev-2026-09-09/report.json。执行使用CLI注入同一核心。后续独立综合回读保存于output/playwright/real-package-readback/after-detail-repair-2026-09-09/，原始预期保留不变。

图片引用台账/视觉审核以及其他未提供字段、资质、店铺身份和运费阻断仍需处理，数量修正不能作为完整项目验收。隔离测试覆盖只读预检、精确URL删除、保留图地址与序号，以及原序列改变时不删除。

再次真实综合回读：28项匹配、0项差异、3项素材待核实；输入/覆盖阻断仍在，非整单通过。最新134项Node＋8项Vitest共142项测试及构建通过。
