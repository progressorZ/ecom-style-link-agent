# 独立单选属性（2026-09-08）

本轮前一目标轮属于进展：统一编译及其测试已落地。本轮继续 A 阶段属性执行，未改变完整目标。

新增 `scripts/pdd-attributes.mjs`、`scripts/pdd-fill-attributes.mjs` 和 4 项测试。支持字段白名单：袖长、版型、衣长、领型、袖型、适用年龄、上市季节；字段标签来自已有 T 恤定位契约。仅支持独立单选，不处理品牌、面料/成分、主风格/子风格或多选。

## 页面证据和执行

真实袖长下拉展开后，input.value 暂时为空，原值进入 placeholder，选项在独立 role=listbox / role=option 中。不能把展开中的 value 或 placeholder 当最终商品值。

执行前要求无已打开 listbox，核对所有请求字段唯一可写、当前类目和货号。点击目标控件后要求唯一可见 listbox，以精确选项名查找，禁用、缺失和歧义停止。选中后等待列表关闭再回读 input.value，结束后重新核对全部请求属性。

不把搜索字符串填进输入框来假装选项成功；当前只选择已经渲染的选项。长列表虚拟滚动/搜索尚未接入，目标未渲染时会报告不可用，不猜近似选项。预检只验证字段控件，不展开所有选项，明确 optionsVerified:false。

出错不自动重试/回滚，保留 before 和 completed；弹层可能仍打开，需要检查后继续。只核对请求子集，没有证明其他联动字段保持不变。

## 接入

```bash
npm run pdd:fill-attributes -- examples/pdd-attributes-smoke.json
npm run pdd:fill-attributes -- examples/pdd-attributes-smoke.json --apply
npm run test:attributes
```

默认只读，apply 才执行。沿用独立测试 profile 与新建 T 恤页。ProductPackage 编译器将可支持的属性生成 attributes 步骤；面料和必填覆盖仍为阻断项，executable 仍为 false。当前 T 恤示例由 7 个步骤增加至 8 个。

## 验证

测试页 `AUTO-MATRIX-20260908-02` 袖长从长袖改为短袖，领型圆领原值复用，两项最终回读一致。该值为虚构测试配置，非真实商品判断；未保存草稿或发布。报告 `output/playwright/real-attributes/dev-2026-09-08/report.json`。

只有袖长选择和领型原值复用得到本轮实测，其他白名单字段尚需逐项真实验证。现场 CLI 注入同一核心，不宣称全部属性或完整 CLI 端到端已通过。

新增测试覆盖展开时 input 清空、精确选项缺失、禁用控件、页面改写选择以及依赖字段拒绝。全量 82 项测试与构建通过。

后续继续面料/成分、多选、风格依赖和虚拟列表，完成完整属性覆盖后才移除相关整单阻断。
