# 主风格与子风格（2026-09-08）

前一目标轮完成面料依赖，属于进展。本轮新增 `scripts/pdd-style.mjs`、CLI 和测试，继续完整属性目标。

输入 scope `pdd-tshirt-style-v1`，同时提供 productCode、primaryStyle、secondaryStyle。先选主风格，等待“风格”字段，再选子风格并重新核对两个值。主风格改变时，即使子字段残留文字与目标相同，也强制打开当前子选项重新选择，不能仅凭旧文本复用。

沿用独立单选 DOM 结构与身份检查，只选择精确可见选项；缺失、禁用、重复弹层或最终值不同则停止。没有实现虚拟滚动和模糊匹配，未证明全部风格类别有相同子字段结构。预检对未出现子字段标记 deferred，不提前宣称选项有效。

```bash
npm run pdd:fill-style -- examples/pdd-style-smoke.json
npm run pdd:fill-style -- examples/pdd-style-smoke.json --apply
npm run test:style
```

ProductPackage 中任一风格字段存在时要求另一项也提供，生成 style 步骤。完整属性覆盖及整单执行阻断仍保留。

真实页面：主风格选择简约通勤后出现子字段，选项包含韩版、简约、OL风格、欧美、英伦。执行核心实测从已选主风格、空子风格开始，填写简约并核对两项。完整父字段切换、延迟生成和旧子值处理由隔离测试覆盖；不能描述为完整动态路径全部实测。

报告 `output/playwright/real-style/dev-2026-09-08/report.json`，商品 `AUTO-MATRIX-20260908-02`，均为虚构测试配置，未保存或发布。

新增 4 项模块测试及 1 项编译测试，全量 91 项测试及构建通过。剩余多选、长列表、参考价/折扣、物流配置来源、整表核对和草稿闭环继续实施。
