# Adapter 贡献规范

## 1. Manifest

每个 Adapter 在 `adapters/<id>/adapter.json` 登记。其机器校验规则是 [adapter-manifest.schema.json](../schemas/adapter-manifest.schema.json)。Manifest 只描述能力与入口，不保存账号、Cookie、店铺 ID 或商品数据。

关键字段：

- `id`：稳定且全仓库唯一，发布后不复用。
- `platform`：平台 ID、显示名、站点和接入模式。
- `compatibility`：核心版本及 Node 运行要求。
- `categories`：类目 Profile、路径、成熟度和最后验证日期。
- `capabilities`：每项能力单独标记状态。
- `entrypoints`：相对仓库根目录的编译器与执行器入口。
- `safety`：是否要求人工审核、是否存在自动发布。
- `maintainers`：负责响应页面变化的人；可在正式提交时补充 GitHub 用户名。

## 2. 能力名称

首版登记以下标准能力：

```text
basic
attributes
variants
pricing-inventory
size-chart
main-images
variant-images
detail-images
video
logistics
services
save-draft
reopen-draft
readback
publish
batch
```

状态使用 `unsupported`、`proposal`、`experimental`、`beta`、`stable` 或 `deprecated`。`publish` 与其他能力分开登记；填写稳定不代表发布稳定。

## 3. 计划与执行接口（目标形态）

```ts
interface Adapter<Input, Plan, Report> {
  compile(input: ProductPackage, context: AdapterContext): Plan
  preflight(target: TargetSession, plan: Plan): Promise<PreflightReport>
  execute(target: TargetSession, plan: Plan, journal: TaskJournal): Promise<ExecutionReceipt>
  readback(target: TargetSession, plan: Plan, receipts: ExecutionReceipt[]): Promise<Report>
  recover?(target: TargetSession, task: InterruptedTask): Promise<RecoveryReport>
}
```

接口尚未作为 npm SDK 发布。新增 Adapter 应保持这些边界，避免把编译、页面点击和结果判断写进一个函数。

## 4. 错误要求

错误应包含稳定代码、用户可读说明、步骤、是否可能产生副作用、是否允许重试和必要的脱敏诊断。以下情况默认禁止自动重试：图片上传结果未知、保存草稿结果未知、页面身份变化、店铺不一致、平台返回状态不明。

## 5. Fixture 与证据

- DOM fixture 只保留定位与状态机需要的最小结构。
- 删除姓名、手机号、地址、Cookie、token、店铺二维码和真实商品图。
- 截图只用于解释页面事实，提交前人工检查所有可见区域。
- 真实验证文档必须区分：只读发现、填写回读、草稿保存、重开核对、发布结果。

## 6. 当前迁移状态

拼多多女装 T 恤仍由仓库根部的 `scripts/pdd-*` 文件实现。其 manifest 将这些文件登记为 `legacy-root` 入口。后续迁移先保持 manifest ID 和能力语义稳定，再移动代码；贡献者不应依赖文件名长期不变。
