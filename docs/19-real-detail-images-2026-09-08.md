# 详情图上传与回读（2026-09-08）

## 交付

新增 `scripts/pdd-detail-dom.mjs`、`scripts/pdd-detail-adapter.mjs`、`scripts/pdd-upload-detail-images.mjs` 及测试。支持新建女装 T 恤页中未装修、无已有图片的快捷编辑区，按输入顺序上传并回读。输入 scope 为 `pdd-tshirt-detail-images-v1`，示例为 `examples/pdd-detail-images-smoke.json`。

独立版本化计划包含 productCode 和有序 images（id/path）。当前仍未接统一 ProductPackage 或前端。

## 实际页面结构

详情区为 `.quick-decoration-container-v2`，快捷编辑容器类名前缀 `quick_decoration_v2_sortableWrapper__`。本地文件入口追踪标识为 `detail_img_localfile_upload`，接受 JPEG/PNG。当前计数容量为 50 张。

每个上传卡片由 `quick_decoration_v2_remarkImage__` 标记，内部 img 追踪标识为 `el_preview_business_details`，序号在 `ImageWithRemark_v2_remark__` 元素。左侧页面预览不作为上传列表，避免重复计数。

上传过程中存在短暂空卡片，没有图片或序号时标记 pending，持续只读观察；出现重复元素或错误序号则停止。上传完成要求计数、卡片数、序号、平台地址及图片 complete/naturalWidth 同时符合，最终再核对全列表。

## 执行边界

- 核对新建 T 恤类目、货号和页面地址。
- 图片数非零或没有“暂未编辑商详”提示时，拒绝写入，避免覆盖已有装修。
- 每次仅上传一个文件，记录本地 SHA-256 和该次新增的远端地址、顺序。
- 先前已上传的图片地址不得变化；数量多于预期或序号错误时停止。
- 超时 30 秒，仅重读状态，不重传。失败保留 completed 和 uploadMayHaveCompleted。
- 正式 CLI 上传已预检的内存字节；内容核验仍为 false，不将地址一致解释为图片内容一致。

本版本复用轮播图素材校验，保守支持最多 10 张独立图、JPEG/PNG、3,000,000 字节以内、宽高均大于 480、比例 1:1 或 3:4。**这不是详情长图的完整平台规则**。50 张容量已观察，但本版输入仍限制 10 张；更长比例和更多详情图需补规则及实测后扩展。

页面提示未编辑时发布后会自动将轮播图填入详情；未测试实际发布，因此不依赖该提示作为已完成详情的证据。此次显式上传详情图。

## 使用

```bash
npm run pdd:upload-detail-images -- examples/pdd-detail-images-smoke.json
npm run pdd:upload-detail-images -- examples/pdd-detail-images-smoke.json --apply
npm run test:detail-images
```

默认只读预检，`--apply` 才上传。进入唯一新建 T 恤编辑页，匹配货号并保持详情未编辑。相对图片路径从命令工作目录解析。默认 profile 为 `.runtime/pdd-inspection-profile`，可用 `PDD_PROFILE_DIR` 覆盖，运行前关闭占用同一 profile 的其他测试浏览器。

示例引用本机 `.runtime/carousel-test/` 中写有“自动化测试，勿上架”的测试卡，运行文件不提交，其他机器需要准备文件并修改路径。此前已上传的测试页再次运行将拒绝覆盖。

## 验证

2026-09-08 在 `AUTO-MATRIX-20260908-02` 测试页空详情区连续上传两张测试卡，序号 1/2、远端地址和缩略图加载状态均符合，结果 `detail_images_upload_observed`。独立初探使用 `AUTO-MATRIX-20260908-01`，首次完整执行在 `AUTO-IMAGE-20260908-01` 遇到空占位卡片后停止，未自动重传或删除；随后修复并在上述空详情页复跑成功。

证据目录：`output/playwright/real-detail-images/dev-2026-09-08/`，成功 `report.json`、诊断 `placeholder-stop.json`。真实 CLI 注入同一执行核心，文件预检/解码后以路径传入；生产 Buffer 上传由隔离测试覆盖，未宣称手动登录 CLI 全链路验收。

新增 5 项测试覆盖只读预检、顺序/加载完成、已有装修/货号阻断、序号错误/前图变更/超时不重试、坏图和短暂空卡片。全量 68 项测试及生产构建通过。

## 后续

物流字段、完整商品属性、其他字段是否受详情操作影响的整表核对、草稿保存和重开仍待完成。此次未点击保存草稿或提交并上架，素材确已上传至平台，编辑缓存不等于草稿闭环。人工仍需核实图片内容及详情整体展示。
