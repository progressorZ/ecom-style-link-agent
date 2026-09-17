# 商品轮播图上传（2026-09-08）

## 本轮交付

新增图片计划、文件校验、轮播图区观察、顺序上传和 CLI：

- `scripts/pdd-image-plan.mjs`：版本化计划，文件读取、SHA-256、完整图片解码、尺寸校验。
- `scripts/pdd-image-dom.mjs`：读取当前主图区域上传数量、容量、文件入口和背景图地址。
- `scripts/pdd-image-adapter.mjs`：只读预检、逐张上传、每张新增地址及最终顺序核对。
- `scripts/pdd-upload-images.mjs`：默认只读，`--apply` 才上传。

成功状态为 `carousel_upload_observed`，不等于图片内容已核实、商品已保存或可发布。统一 ProductPackage 素材编译和前端接入尚未完成。

## 输入与校验

输入示例见 `examples/pdd-carousel-smoke.json`，scope 为 `pdd-tshirt-carousel-v1`；数组顺序就是期望轮播顺序，第一张为主图。每项包括唯一 id 和本地 path。相对路径以运行命令的工作目录为基准。

执行前全部检查：

1. 新建 T 恤页面、精确类目和货号匹配，当前图片区域为空。
2. 1～10 张，仅 JPG/JPEG/PNG；文件实际魔数与扩展名一致。
3. 路径存在、为普通文件，拒绝重复真实路径和重复内容。
4. 单文件不超过 3,000,000 字节；这是对页面“3M 内”的保守实现，不宣称平台的精确字节边界。
5. 在独立空白页面解码完整图片；解码页网络请求全部阻断。
6. 宽高均大于 480，比例精确为 1:1 或 3:4。
7. 形成包含尺寸、字节数、顺序及 SHA-256 的清单。正式 CLI 上传内存中的已校验字节，避免路径文件在上传过程中被替换。

页面文案或入口签名变化则停止，已有图片不覆盖、不删除、不自动续传。首版仅支持空图片区，超时后的再次运行必须先人工检查原页面。

## 真实页面观察和完成判定

上传入口位于 `basic.carousel_gallery` 的 Beast 表单区域。鼠标移入上传区后显示本地上传按钮；文件 input 的追踪属性为 `carousel_img_localfile_upload`，accept 为 JPEG/PNG。

真实缩略图使用 `MaterialModalButton_v2_imageBox__` 类名前缀的 CSS 背景，而非 img 标签。只读数量不够，必须同时检查缩略图地址数量和先前已记录的地址前缀顺序。

本轮观察到：第一张先出现 PFS 上传地址，随后平台处理并替换成 `img.pddpic.com/aid-image/aid-sr/` 地址；第二张保留 PFS 地址。当前适配器首张等待已观察到的处理地址，后续接受该处理地址或 PFS 地址。这是当前测试页面的保守适配，不能推断所有店铺都有相同处理规则；首张不发生该转换时会超时停止，需要补采行为再扩展。

逐张上传后最多观察 30 秒，只重读状态，不重传文件。上传失败或超时可能已经产生素材，失败报告保留 completed 和 `uploadMayHaveCompleted`，不盲目重试。全部结束再核对数量及顺序。

平台会改格式/处理图片，因此本地哈希不能当成远端图片内容核验。报告保留 `contentVerified:false`。商家仍需检查图片是否被平台处理失真；也没有验证其他商品字段不受图片推荐联动影响。

## 使用

关闭占用同一独立 Chrome profile 的测试进程，在项目根目录：

```bash
npm run pdd:upload-images -- examples/pdd-carousel-smoke.json
npm run pdd:upload-images -- examples/pdd-carousel-smoke.json --apply
npm run test:images
```

按终端提示进入唯一的新建 T 恤编辑页、填写匹配货号、保留空主图区，再按 Enter。默认 profile 是 `.runtime/pdd-inspection-profile`，可通过 `PDD_PROFILE_DIR` 设置独立目录。

示例引用 `.runtime/carousel-test/front.png` 和 `back.png`，本机本轮已生成。它们是写有“自动化测试，勿上架”的 600×600 测试卡，运行目录不提交。其他机器需自行准备合规测试图并修改路径；不可拿后台截图作为商品图上传。

## 实测记录

2026-09-08，新建测试商品 `AUTO-IMAGE-20260908-01`，连续上传两张测试图；最终计数 2、顺序 front/back，状态 `carousel_upload_observed`。之前两次诊断分别因首张地址转换、第二张保留 PFS 地址而停止，错误报告保留用于回归。此次全部使用显式测试商品页，没有触发保存草稿或提交并上架。

本地证据目录：`output/playwright/real-carousel/dev-2026-09-08/`，成功报告 `report.json`，诊断报告 `temporary-url-stop.json`、`second-image-timeout.json`。现场通过 Playwright CLI 注入同一执行核心，文件先校验并解码，再使用本地路径上传；正式 CLI 使用内存 Buffer 上传，该路径由隔离测试覆盖。不得把此次实测描述为完整 CLI 人工登录流程的端到端验收。

新增 8 项测试；合计 57 项测试及生产构建通过。隔离页面测试拦截全部网络请求，覆盖损坏图片、身份不符、已有素材保护、顺序、处理中地址、超时不重试。

## 后续

接详情图、SKU 图、物流及完整属性填写，建立整表核对，再验证草稿保存/重开。当前不能自动发布或返回真实可售链接。测试图片可能已进入平台素材存储，商品编辑页可能有自身缓存；未保存草稿不代表未发生素材上传。
