# 运行时结构校验与属性覆盖

2026-09-09。此前JSON Schema只作设计文档，编译依赖局部手写检查。现在增加 `scripts/pdd-package-schema.mjs`，在compileProductPackage返回计划前执行完整结构校验。调用编译器的回读和上传任务入口因此也获得这一检查。

使用固定版本ajv 8.20.0、ajv-formats 3.0.1及现有draft2020-12 Schema。开启严格模式与全部错误收集；关闭类型转换、默认值填充和多余字段删除。格式错误抛PACKAGE_SCHEMA_INVALID，validationErrors提供字段路径、校验关键字、消息及规则参数，不包含完整输入内容。

现有业务编译检查继续保留且部分先执行，因此相同无效输入可能先抛业务错误。结构有效不等于平台有效、库存未过期或字段事实已确认；日期格式校验也不证明库存时间新鲜。

## 防止静默忽略

- services=null、无效inventoryConfirmedAt、缺失商品名称、pricing拼错的额外键等，不再得到编译计划。
- stock字符串不会转换为数字。
- attributes按Schema允许扩展，但每个实际输入键均进入attributeCoverage。
- 已接适配器的属性标compiled；其余标unhandled并新增attribute_not_mapped阻断，路径使用JSON Pointer转义。

compiled仅表示有编译处理，不能代表真实页面已经匹配；当前仍保留完整必填覆盖未知的阻断。覆盖清单目前针对输入属性，不是全平台字段总表，尚不能证明不存在未输入的必填字段。

## 验收与后续

新增测试验证无输入修改、无默认值、额外键拒绝、日期格式、null服务、属性空对象类型、字符串不转换，以及扩展属性逐项阻断。原示例和全部旧测试继续回归。

本轮不操作平台页面。下一步需将页面当前字段和必填标记纳入覆盖清单，并继续真实上传记录/完整商品/草稿闭环验收。

最新全量验证：125项Node测试＋8项Vitest，共133项通过，TypeScript检查及生产构建通过。
