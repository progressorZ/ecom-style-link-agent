# 真实定位测试跟进（2026-09-07）

## 用户测试结果

读取了两份实际运行报告：

- `output/real-locator-verification/2026-09-07T12-34-57-190Z/report.json`：initial，18 个字段，4 个通过、14 个类型失败。
- `output/real-locator-verification/2026-09-07T12-45-44-211Z/report.json`：linked，21 个字段，4 个通过、17 个类型失败。

这些字段的 labelCount 和 controlCount 均为 1。主要问题不是找不到字段，而是自定义下拉框的输入没有标准 combobox role。原始报告保留，不回写成通过。

## 现场补查及代码修复

复用测试专用 Chrome profile，进入新的 T 恤编辑页。读取基础属性结构后，在未提交的编辑页选择“棉”和“简约通勤”以展开父子属性；没有点击保存草稿或提交并上架。本次不是全表填写测试，也未验证平台是否会自行暂存编辑状态。

已确认：

1. 基础字段有 `data-testid="beast-core-form-item"` 容器。
2. 自定义下拉框同时存在 `beast-core-select`、`beast-core-select-header`、`beast-core-select-htmlInput` 三个标记；内部输入为普通 text，role 为空。
3. 多选组件的内部容器有 `ST_selectValueMultiple_` 类名前缀；识别前缀而不绑定版本后缀。标记缺失即不认为多选通过。
4. 选择面料“棉”后，材质显示“棉”且 disabled/readOnly；这是已观察到的联动结果，不能推断所有面料的材质都固定或均可忽略核对。

新增 `scripts/pdd-observe.mjs`，由验证器和测试共享。按精确 label 限定本字段容器，禁止向相邻字段借用 input。报告仅记录控件结构，不记录输入值、完整 HTML 或登录凭据。

定位评估现在区分：

- `basicFieldsLocated`：基础字段结构能否识别，包括已定位但需要回读的派生字段。
- `basicFieldsReady`：所有基础字段都满足可操作检查；派生字段未核对时仍为 false。
- `derived_readback_required`：已登记的材质字段处于锁定状态，唯一允许操作为 readback_only，不能强制启用或跳过业务核对。
- `ready`：完整 R1 是否通过；类目、规格矩阵、尺寸、素材和物流未完整验证，继续为 false。

## 修复后真实复测

证据目录：`output/real-locator-verification/followup-2026-09-07/`。

| 状态 | 结果 |
|---|---|
| initial.json | 18 个基础字段全部通过，basicFieldsReady=true |
| linked.json | 21 个基础字段全部识别，20 个可操作，材质为 derived_readback_required |
| linked.png | 本次真实编辑页面截图，仅保存在本机 |

联动态仅展开基础属性依赖，未生成本次 SKU 或尺码表。该报告不能作为 SKU、图片或物流检查通过的依据，也不证明真实保存草稿成功。

## 自动化回归

- 领域与模拟存储测试：8 项通过。
- Mock API：7 项通过。
- Adapter 与 DOM 观察测试：10 项通过。
- 构建：通过。

新增测试覆盖自定义下拉框、普通 input 误识别、组件标记不完整、多选证据、只读派生字段、重复 label、同字段多输入以及相邻字段串位。DOM 测试使用精简结构夹具；真实通过结论仅来自上述现场报告。

## 后续实施顺序

1. 补齐类目、SKU 行键、尺码表、用途限定上传入口与物流区域的 R1 定位。
2. 实现冻结商品事实与材质派生值的回读比对：预期与页面不同则停止；一致才能免除该字段写入。
3. 从已验证控件开始实现选择、填写与回读，父属性变化后重新定位子属性；不直接套用之前模拟数据中的属性选项名称。
4. 全表 R2 回读通过后才验证保存草稿和重开。测试用户无需为本次下拉框误判重新做一遍初始态测试。
