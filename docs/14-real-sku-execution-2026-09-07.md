# 真实 SKU 数值填写与回读（2026-09-07）

## 已实现范围

在已经生成颜色/尺码矩阵的新建 T 恤编辑页，按颜色＋尺码逐行填写：库存、拼单价、单买价、规格编码和启用状态。执行器不生成额外颜色尺码组合，不上传 SKU 图片，不保存草稿或发布。

`pdd-sku-dom.mjs` 在页面内同步读取表头、展开颜色 rowSpan、验证行键，再返回目标输入元素。每次操作都重新解析当前 DOM，元素由 Playwright 原生 fill/click 操作，不用 JS 直接赋值。不存在固定输入序号或批量栏定位。表头重排、行重排或正常重新渲染不影响业务键匹配；隐藏行、重复行、缺行、额外行、歧义表格或输入均停止。

`pdd-sku-adapter.mjs` 冻结计划并在首次写入前检查所有字段。每一步检查当前页面地址、T 恤类目和整款货号，避免换页后继续执行。金额输入以整数分保存，以十进制文本填写；回读“1000”与“1000.00”均归一到 100000 分。空字符串不等同于零。逐字段回读后再做全表最终核对；异常返回已完成步骤、执行前值和差异，不自动重试、回滚或保存。

## 停用库存的真实规则

本店本次页面观察：SKU 停用时库存被清零、库存输入框 disabled，价格及规格编码仍可编辑。执行器因此：

- 计划为启用：先切换启用，再填库存。
- 计划为停用：目标库存必须显式为 0；填完字段再切换停用。
- 已停用且库存为 0：只读确认库存，不尝试修改 disabled 控件。
- 如果后续页面状态与已登记结构不一致，停止，不强制移除 disabled。

此行为仅依据此次 T 恤页面，不推断其他平台或类目。

## 运行命令

准备一个测试用新建 T 恤编辑页，货号和颜色尺码集合必须与计划完全相符。示例对应 `AUTO-TEST-20260907-01` 和白色 S/M；它是未提交页面测试数据，不是真实商品销售配置。

```bash
# 默认只读预检
npm run pdd:fill-sku -- examples/pdd-sku-smoke.json

# 显式写入并回读，停在保存前
npm run pdd:fill-sku -- examples/pdd-sku-smoke.json --apply
```

使用独立 Chrome profile；先关闭占用此 profile 的其他自动化窗口。在命令打开的窗口进入目标编辑页，检查店铺与计划后回终端按 Enter。执行结束留出检查时间，按 Enter 关闭。报告写入 `output/real-sku-fill/<时间>/report.json`。

状态 `sku_subset_verified` 只表示此次 SKU 数值/状态子集一致。`fullProductVerified=false`，不得据此在前端展示完整商品“审核通过”。

## 统一 ProductPackage 接入

同一命令也接受 schemaVersion=0.1 的 ProductPackage：

- `product.categoryKey` 必须为 `womenswear.tshirt`，`listing.platform` 必须为 `pdd`。
- 颜色、尺码、商家规格编码来自 `variants`。
- 按 variantId 查找 `listing.offers`，不得按数组位置匹配。
- 拼单价取 `role=sale`，单买价取 `role=platform:pdd.single`，currency 必须为 CNY，金额使用 amountMinor。
- stock 和 enabled 必须显式提供；缺失/重复 offer、价格角色重复、错误币种或不完整集合拒绝执行。

现有 `examples/product-package.json` 是历史连衣裙夹具，仍会被拒绝，不能自动改个类目冒充 T 恤真实数据。本次只接通 SKU 编译桥接，未将图片、尺码和物流的执行器接通。

## 真实验证证据

目录 `output/real-sku-fill/dev-2026-09-07/`：

| 报告 | 实测结果 |
|---|---|
| report.json | S 库存 1、启用；M 库存 0、停用；两行双价格及编码一致 |
| report-enabled.json | 执行器自动启用 M，再填入库存 2；回读一致 |
| report-disabled.json | 执行器自动将 M 库存设 0 并停用；回读一致 |

三次均返回 sku_subset_verified，differences=[]，没有点击保存或提交并上架。核心执行逻辑通过 Playwright CLI 注入运行；CLI 环境的 URL 全局对象限制与文档 13 相同，以等价的精确地址边界断言替代。Node 命令登录/终端交互外壳通过语法检查，未单独再跑一轮登录交互。

本次曾遇到浏览器变为空白页，地址门禁阻止了写入；随后用专用 profile 重开同一测试地址，恢复部分编辑状态后才执行。恢复编辑状态不等同于“保存草稿并从草稿箱重开验证”，R3 仍未完成。

## 自动化验证

- `npm run test:sku`：8 项通过，覆盖分精度、空库存、计划唯一性、合并颜色行、行列重排和重新渲染、缺失/重复/隐藏行、货号错误、锁定字段、启停清零和后续页面处理器篡改值、ProductPackage 的 ID 映射。
- 原有 execution 6、adapter 10、领域/模拟存储 8、API 7 项通过，合计 39 项。
- `npm run build`：通过。

## 仍待完成

1. 从计划自动创建颜色和尺码矩阵（当前要求页面已有完整矩阵）。
2. 尺码表表头/表体关联及实测值填写。
3. SKU 图片、主图及详情图上传完成验证。
4. 属性联动、物流和整表差异报告。
5. 整表核对通过后保存草稿并重开，最后才推进批量执行。
