# 素材与远程引用核验

2026-09-09。新增 `scripts/pdd-media-bindings.mjs`，接入独立综合回读。

## 核验边界

图片存在或数量相同不能证明素材对应。现在允许提供由未来上传Worker产生的receipt，核验以下范围和内容：

- 同一sourceHash、executionHash、shopKey、productCode和精确editorUrl。
- 同一步骤且只有一份记录，覆盖所有目标；轮播/详情目标为从1开始的位置字符串，SKU目标为JSON编码的颜色/尺码键。
- 每个assetId对应当前本地文件重新计算的SHA256。
- 当前DOM中的远程图片地址与记录精确一致，包括顺序、SKU绑定和URL参数。

记录缺失为missing，范围错误/重复/结构错误使该媒体项unreadable，内容或远程引用不同为mismatch。引用一致返回references_matched，但外层仍为unverified并要求视觉审核。主图经平台处理后视觉可能变化，引用匹配不证明内容正确。

输入配置在开始回读时克隆，避免外部调用方在异步回读期间替换记录。文件在核验时读取，后续任务执行仍需再次冻结/校验素材，当前没有持久Worker或锁。

## 调用方式

```bash
npm run pdd:check-package -- /path/to/product.json /path/to/readback-context.json
```

配置可含freightProfiles和mediaReceipts；其他顶层键拒绝。函数API `readbackProductPackage(page, raw, options)` 同样支持这两个键。当前交互式CLI入口未真实端到端验收。

receipt结构如下（结构说明，不是可用真实证据）：

```json
{
  "version": "pdd-media-receipt-v1",
  "sourceHash": "商品编译指纹",
  "executionHash": "执行指纹",
  "shopKey": "店铺配置键",
  "productCode": "货号",
  "editorUrl": "精确编辑页地址",
  "stepId": "carousel",
  "entries": [
    {"assetId":"main-1","target":"1","sha256":"源文件64位十六进制哈希","remoteUrl":"https://平台图片地址"}
  ]
}
```

stepId还支持detail和skuImages。记录的可信产生和持久化尚未实现，调用方可编辑的JSON不是防篡改证明，shopKey也不等于浏览器店铺身份已验证。因此本模块不能独立放行整单，不会把历史无范围的上传报告自动包装成可信receipt。

## 验收状态

本轮是本地文件及隔离测试：验证作用域隔离、版本失效、重复拒绝、同路径替换文件、远程地址变化，以及引用匹配不提升为视觉已审核。没有创建任何真实商品receipt，也没有修改平台页面或验证真实图片绑定闭环。

下一步在实际上传执行边界产生带范围的记录，持久化原始证据，再连接独立回读与人工图片审核；现有尺码、M码缺图和详情数量差异保留，整单仍未通过。

最新全量验证：116项Node测试＋8项Vitest，共124项通过，TypeScript检查及生产构建通过。
