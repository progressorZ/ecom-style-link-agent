# SKU 预览图上传（2026-09-08）

## 本轮范围

支持新建女装 T 恤页中的 SKU 预览图逐行上传。按颜色＋尺码定位，兼容颜色合并单元格，复用 `resolveSkuDom` 的行身份和数值回读。新增可选 `includeImages`，旧数值适配器默认行为不变。

新增 `scripts/pdd-sku-image-adapter.mjs`、`scripts/pdd-upload-sku-images.mjs`、`scripts/pdd-sku-image.test.mjs`。输入为独立版本化计划，尚未接入 ProductPackage 编译或前端。

## 输入与绑定

参考 `examples/pdd-sku-images-smoke.json`：

```json
{
  "scope": "pdd-tshirt-sku-images-v1",
  "productCode": "AUTO-MATRIX-20260908-01",
  "images": [{"id": "white", "path": ".runtime/carousel-test/front.png"}],
  "bindings": [
    {"color": "白色", "size": "S", "imageId": "white"},
    {"color": "白色", "size": "M", "imageId": "white"}
  ]
}
```

同一素材通过 imageId 显式复用，不要求复制本地文件。拒绝重复行绑定、不存在的素材引用和未使用素材。可以只填写指定子集，其他行的已有图片保持不变；目标行已存在图片则拒绝覆盖。

素材校验复用当前轮播图校验：最多 10 个独立文件、JPEG/PNG、完整解码、单文件不超过 3,000,000 字节、宽高大于 480、比例 1:1 或 3:4。这是当前保守实现范围，并非本轮已经确认的 SKU 图片完整平台限制；后续如需更宽松规则应单独采集。绑定行数可大于独立文件数。

## 真实页面证据

在 `AUTO-MATRIX-20260908-02` 上只上传白色 S：M 仍为空，证明此次页面没有自动同步同色其他尺码。没有据此推断其他页面和操作也不联动。

随后在 `AUTO-MATRIX-20260908-01` 的空 SKU 图片区连续上传白色 S、M，同一测试图片分别绑定两个尺码。两行都回读到 PFS 图片地址，价格、库存、编码、启停状态与上传前一致。报告状态 `sku_images_upload_observed`。

图片控件位于表格“预览图”列的 `.goods-sku-img` 中。上传后文件入口被预览替换，预览元素的 `data-tracking-click-viewid` 为 `el_specification_batch_modification_preview_picture`，地址在 CSS background-image 中。不能用普通 img 标签计数，也不能用全页第几个 file input 定位。

## 执行与保护

1. 核对页面地址未变化、新建 T 恤类目、货号匹配。
2. 上传前解析全部 SKU 行、数值和图片，确认所有目标行为空且可上传。
3. 全部文件预检、解码，正式 CLI 使用已校验内存字节上传。
4. 每次按当前颜色尺码键重新取文件输入控件，仅传一张图；不点击批量上传或更换/删除。
5. 每次观察时核对完整 SKU 行集合及价格、库存、编码、状态。非当前目标行的图片地址必须保持一致，包括此前已上传的行。
6. 单次最多等待 30 秒，接受已观察到的平台 PFS/pddpic 地址。失败保留已完成行并停止，不重传或盲目回滚。
7. 全部结束再核对所有已绑定图片地址。

图片地址回读只能证明页面绑定结果，不能证明平台压缩后的图像内容正确，报告 `contentVerified:false`。未核验尺寸表、主图及其他属性是否受平台联动影响，完整商品核对仍待开发。

## 使用

```bash
npm run pdd:upload-sku-images -- examples/pdd-sku-images-smoke.json
npm run pdd:upload-sku-images -- examples/pdd-sku-images-smoke.json --apply
npm run test:sku-images
```

默认只读预检；`--apply` 执行上传。按终端提示进入唯一的新建 T 恤编辑页、准备对应货号与规格。路径相对命令运行目录。默认 Chrome profile 为 `.runtime/pdd-inspection-profile`，可使用 `PDD_PROFILE_DIR`，不要与正在占用相同 profile 的测试浏览器同时运行。

本机示例引用有“自动化测试，勿上架”字样的 600×600 测试卡。该图片在忽略的运行目录中，其他机器需准备图片并修改路径。此次测试页面已存在预览图，再次运行会拒绝覆盖，属于预期保护行为。

## 验证与限制

本地报告：`output/playwright/real-sku-images/dev-2026-09-08/report.json`。现场通过 Playwright CLI 注入同一执行核心，预检及解码后使用路径上传；生产 CLI 的 Buffer 上传路径由隔离测试覆盖，不能将本次描述为整个手动登录 CLI 的端到端验收。

新增 6 项回归测试：共享素材显式绑定、合并颜色行、批量入口隔离、已有图片保护、跨行图片/数值联动阻断、超时不重试、上传后行重排。全量 63 项测试及生产构建通过。

此次没有保存草稿、提交并上架或删除任何已有图片。测试素材已发生平台上传；编辑页可能有临时缓存，不代表草稿保存通过。详情图、物流、完整属性、整表核对、草稿保存与重开仍待完成。
