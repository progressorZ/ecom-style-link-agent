# 三类图片独立回读

2026-09-09。综合报告已接入当前页面的主图、SKU图、详情图观察函数。读取图片数量、远程地址、规格绑定和详情加载状态；不上传、移除或重新排序图片。

## 状态语义

- mismatch：数量不符、预期SKU缺图、行集合不符或详情图未就绪。
- unverified：结构未发现差异，但没有已验证的本地assetId/文件哈希与远程引用绑定，不能证明当前图片就是预期素材。
- unreadable：定位、控件结构或页面状态不支持。

主图与SKU图使用背景图地址，不能从地址存在推断图片解码完成或视觉内容一致；详情图可读取img完成状态。主图可能被平台处理，因此不能简单比较原文件哈希与远程图字节。

`scripts/pdd-media-readback.mjs` 只负责结构差异评估，`pdd-readback.mjs` 在身份保护下从实际DOM读取。新计数unverified必须在下游展示，不能忽略。整个报告继续保持incomplete和fullProductVerified=false。

## 真实结果

本次沿用原虚构输入并保留差异：

| 检查 | 结果 |
|---|---|
| 既有字段 | 26项matched |
| 尺码表 | S/M肩宽各相差0.5cm，mismatch |
| 主图 | 1张符合数量，但素材身份待核实，unverified |
| SKU图 | M码预期有图，页面为空，mismatch |
| 详情图 | 输入1张、页面2张，mismatch |

合计26 matched、3 mismatch、1 unverified、0 unreadable、0 uncovered。uncovered=0仅指该份编译计划中的步骤已接读取，绝不代表整个平台字段全部覆盖；资质、店铺、必填完整性等blockers仍在。

证据：`output/playwright/real-package-readback/dev-media-2026-09-09/input.json` 与 `report.json`。采用Node编译后CLI注入同一回读核心；未保存或发布，没有为得到通过结果修改测试样本。

## 回归与后续

测试覆盖同数量不等于同素材、详情缺节点/多图/加载中不能通过、SKU按行键且停用规格仍按输入检查图片。下一步建立带商品/店铺/版本范围的上传引用台账，使用上传时的assetId、源哈希、位置或SKU键与远程引用核对；视觉内容审核另行保留。随后补整表覆盖契约和草稿验收。

最新全量验证：113项Node测试＋8项Vitest，共121项通过，TypeScript检查及生产构建通过。
