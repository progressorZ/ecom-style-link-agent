# 页面字段清单与弹窗阻断

2026-09-09。新增pdd-page-coverage.mjs，与综合回读报告的coverage字段连接。

## 当前能证明什么

扫描可见Beast表单区域，按最近表单父节点归属收集字段标签、可见控件数和观察到的Form_itemRequired星号。与定位契约和实际生成的readback checks关联，区分reader_present、input_or_reader_missing、unmapped_region。reader_present只表示有对应检查，实际成功与否看readbackStatus。

扫描可见叶节点中的“数字个错误项未处理”摘要，避免从整页大段文本推断错误。没有星号不能证明可选；当前扫描也不覆盖所有非Beast容器、隐藏联动字段或服务子项映射。complete始终false，现有完整性blockers继续保留。

## 弹窗与真实证据

真实页面出现“当前页面停留时间过长，为了避免数据延迟，建议刷新一次页面”的弹窗，遮挡“去处理”。未强制点击穿透，未刷新。可见beast-core-modal会使观察器返回blocked_by_modal，字段列表留空；综合回读守卫则抛READBACK_BLOCKING_MODAL，不发布旧页面核验结果。

实测报告：`output/playwright/page-coverage/modal-2026-09-09.json`，modalCount=1。此次只证明弹窗检测有效，尚未完成最新真实页面的字段清单验收。没有保存或发布。

## 回归与后续

隔离测试覆盖有必填标记但计划缺失、已有读取检查、未知字段、错误摘要、读取不改DOM、弹窗阻断清单及综合报告。全量结果见当前方案。

后续先处理超时弹窗并重新验证页面状态；补非Beast区域/服务子项映射、当前必填依赖和缺失字段清单，仍需真实完整商品和草稿闭环验收。

最新全量验证：128项Node测试＋8项Vitest，共136项通过，TypeScript检查及生产构建通过。

## 真实页面恢复与区域映射追加

已通过可见关闭按钮关闭停留超时提示，未刷新页面。重新读取显示平台错误为“请上传第2行规格的预览图后重新操作”，与独立回读的M码缺图吻合。

新采集43个可见Beast表单区域；这包含嵌套区域，不等于43个业务字段。区域库存增加ancestorRegionIds；服务明确ID关联对应services检查，尺码单元格依据最近newSpec区域关联sizeChart，SKU区域同时要求variants与skuImages读取器。依旧保留其真实readbackStatus，不能将mismatch改成通过。

本次综合报告仍为26 matched、3 mismatch、1 unverified。覆盖缺口包括五项输入未提供的普通属性（版型、衣长、袖型、适用年龄、上市时节）、资质、未提供配置的运费区域，以及包装标签图和三种视频未映射区域。没有星号不意味着可忽略，后续须明确业务/平台适用性。

原始清单在`output/playwright/page-coverage/fields-2026-09-09.json`；综合报告在`output/playwright/real-package-readback/dev-coverage-2026-09-09/`。复用CLI注入核心，编译仍在Node执行；CLI缺少structuredClone，测试桥接仅对JSON配置使用等价JSON克隆，生产代码保持原生structuredClone。没有生成新图片、保存草稿或发布。

最新全量验证：129项Node测试＋8项Vitest，共137项通过，TypeScript检查及生产构建通过。
