# 数据模型与校验

## 1. 契约层级

[JSON Schema](../schemas/product-package.schema.json) 描述最小可交换输入；[示例](../examples/product-package.json) 是虚构商品。Schema 通过仅代表结构合法，不代表允许执行。

执行必须依次通过：结构校验 → 引用和业务校验 → 事实确认检查 → 平台规则编译 → 平台预检。未知必填字段必须产生阻塞错误。

校验器必须显式启用 `date-time` 等 format 校验（Ajv 接入相应 formats 支持），不能只把 format 当注释。包含非法时间的负例必须失败。

编辑态可保存不完整数据，不要求每次保存符合执行输入 Schema。进入准备阶段才组装完整 ProductPackage 并严格校验。

## 2. 领域对象

| 对象 | 关键字段 | 约束 |
|---|---|---|
| Product | id、productCode、name、categoryKey、brand、attributes、revision | 货号在业务空间唯一；categoryKey 为内部类目键 |
| Variant | id、merchantSku、colorKey、colorLabel、sizeKey、sizeLabel | 实际存在的组合；内部键稳定、展示名称可变 |
| Asset | id、sourcePath、sha256、role、colorKey、order、reviewStatus | 运行前导入受控存储；图片用途可通过多个关联表示 |
| SizeChart | kind、columns（逐列 unit）、rows；外部 FieldEvidence | 成衣尺寸与适穿建议不同 kind，不混表 |
| ListingIntent | platform、shopKey、categoryBindingKey、title、offers、logistics | 是本次店铺销售配置，不是商品事实 |
| Offer | variantId、prices、stock、enabled、skuAssetId | 与变体一一关联；价格角色须映射真实平台含义 |
| FieldEvidence | fieldPath、source、confirmed、reference | 指向本次快照的 JSON Pointer；审核事实是否可信 |
| PlatformDraft | rulesVersion、mappedFields、specs、media、logistics、inputHash | 编译产物不可就地修改 |
| Listing | productId、shopId、revision、status、externalDraftId、externalProductId、url | 平台实体引用不能与内部 ID 混用 |
| Job / Step | 状态、阶段、租约、intent、observation、错误 | 任务完成与商品上架分开 |

## 3. 输入字段约定

### 3.1 商品属性

- `attributes` 是内部属性字典，值为字符串、数值、布尔或字符串数组；真实可用属性来自类目契约。
- 已知键建议 `collar`、`sleeveLength`、`pattern`、`fit`、`style`、`season`、`composition`、`origin`；接入时定义含义，不同含义不共用一个键。
- `brand` 可缺失，但若目标页面要求必须选择，则由商家选择真实品牌或平台允许的无品牌选项；不自动填“其他”。
- 材质成分建议结构化为材料及比例，最小交换结构暂允许已确认字符串。进入 v0.2 时扩展结构并提升 schemaVersion，不能改变旧字段解释。
- 颜色销售名称在 Variant 中维护；平台普通属性颜色由 Adapter 根据实际销售颜色生成或要求补充，不能覆盖规格信息。

### 3.2 金额、库存和价格角色

`amountMinor` 为整数分，`currency` 首版仅 CNY。`12900` 显示为 `129.00` 元；拒绝将浮点金额直接乘除后截断。CSV 中单价先用十进制字符串解析，再转整数分。

每个 Offer 的 prices 是带角色的价格列表，各 role 唯一且必须恰含一个 sale。2026-09-06 的真实 T 恤页面已确认有“拼单价”和“单买价”：当前内部 `sale` 由拼多多 Adapter 映射为拼单价，`platform:pdd.single` 映射为单买价。这个映射在真实交互联调时再次验证；其他平台不继承它。商品参考价保存在 Listing pricing，当前页面提示必须大于最大单买价；满件折扣也是 Listing 级配置，不能隐含进 SKU 售价。

库存是本次刊登的确认快照，首版不承诺多平台库存同步。入队记录确认时间；建议超过 24 小时或商家设置的 TTL 要求重新确认。恢复和最终审核时检查是否过期。

### 3.3 尺码

- Variant 的 sizeKey 用稳定内部键，sizeLabel 用展示值；`2XL` 与 `XXL` 只在已确认的别名表中等价。
- 当前 T 恤页面先选择尺码模板和尺码体系，再勾选具体尺码；Adapter 按这个顺序执行并等待规格矩阵重建完成。`sizeTemplate`、`sizeSystem`、选中尺码集合及排序都属于 Listing 配置，不能只从 Variant 反推后丢弃。
- `garment` 表示成衣实测，`body_recommendation` 表示人体适穿建议。
- 每列声明 measurement key、label、unit，支持 cm 或 kg；每格为数值或 `{min,max}`，且 min ≤ max。
- 单表 unit 字段不适合身高/体重混合，故实际 Schema 使用逐列 unit。
- `chestCircumference` 与 `chestFlatWidth` 不同，不允许隐式互换；必要换算必须明示来源和方法。
- 平台要求尺码表时，所有销售尺码必须有对应行；没有销售的尺码可否展示由规则决定。
- 平台生成的推荐尺码表只能作为待确认输入；商家确认后才可覆盖成衣实测。`syncSizeChartToDetail` 显式记录是否保存尺码表图片并同步商品详情。

### 3.4 规格联动

- 颜色和尺码集合生成规格矩阵；首版内部仍保存实际 Variant 集合，以支持缺码和停用场景，平台是否允许稀疏组合待实店保存验证。
- `Product.productCode` 是整款商品编码；`Variant.merchantSku` 在拼多多 Adapter 中映射为逐行“规格编码”。两者不可互相填充。
- 当前截图显示颜色图会成为同颜色各尺码的预览图。编译时可按颜色批量绑定，保存后仍须逐行回读图片、规格编码、价格、库存和启用状态。
- 批量设置和 Excel 批量编辑是同一规格数据的快捷入口，不是第二份事实来源；执行后必须回读最终表格。

### 3.5 素材

role 首版为 main、detail、sku。示例一文件可分别声明两个用途，但运行存储按 sha256 去重；绑定仍按用途分别保存。图片属于特定颜色时必须有 colorKey；通用详情可无颜色。

先解析受控工作目录内的导入路径，拒绝越界路径和未允许的远程 URL。sourcePath 只存在于导入契约，运行时使用 assetId/storageKey，不把用户临时路径传给模型或平台。

同一用途 order 唯一；SKU 图关联检查颜色一致，通用图只有明确允许时才能跨色复用。未通过素材审核不能执行；实拍图也要经过可见清晰度和归属确认。

### 3.6 证据与确认

source 枚举：manual、supplier、label_ocr、vision、template。reference 是本地业务引用或说明，不存密码等秘密。confirmed 表示人工/明确业务流程确认，不能由模型将自己的结果设为 true。外部 JSON/CSV 自称已确认或图片 approved 不可信，导入后重置为待确认；只有当前用户或已认证可信业务流程可生成正式确认记录。

关键确认项包括货号、品牌（若使用）、成分、产地（若使用）、每 SKU 价格库存、尺寸表、物流方案。允许对整个 offers 数组确认，但必须绑定当前 revision 和快照 hash；数组顺序或内容变化后确认失效。

模型自报 confidence 可用于排序，不是可靠正确率。出现标签与手工数据冲突生成 CONFLICTING_EVIDENCE，不通过平均置信度决定。

## 4. 数据库建议

所有业务表含 id、created_at、updated_at；可编辑表含 revision。首版单用户也保留 workspace_id 或等效业务归属，为唯一约束确定边界。

| 表 | 主要列 | 关键约束/索引 |
|---|---|---|
| shops | platform、external_shop_id、profile_ref、config_revision | unique(platform, external_shop_id) |
| category_bindings | shop_id、category_key、external_category_id、rules_version、verified_at | 只使用已验证绑定 |
| shop_templates | shop_id、category_binding_id、version、defaults、status | 被删除/失效模板不可编译新草稿 |
| products | workspace_id、product_code、name、attributes、revision | unique(workspace_id, product_code) |
| variants | product_id、merchant_sku、color_key、size_key | unique(product_id, color_key, size_key)；编码业务空间唯一 |
| assets | sha256、storage_key、mime、bytes、width、height | 存储去重作用域明确，不跨店铺泄露访问 |
| product_assets | product_id、asset_id、role、color_key、sort_order | 用途与顺序单独管理 |
| size_charts | product_id、kind、data、revision | 类型和列单位强校验 |
| field_evidence | product_id、revision、field_path、source、confirmed、reference | 确认只对该快照有效 |
| listings | product_id、shop_id、revision、status、external_refs、url | 默认同 product+shop 一个主刊登；显式另建才允许多个 |
| listing_offers | listing_id、variant_id、prices、stock、enabled、sku_asset_id | unique(listing_id, variant_id) |
| listing_snapshots | listing_id、revision、input_json、input_hash、rules_version、draft_json | 不可变；审核、执行引用同一快照 |
| jobs | listing_id、snapshot_id、status、step_key、lease、fencing_token、attempt | 非终态执行任务对 listing 唯一 |
| job_steps | job_id、step_key、attempt、intent、observation、status | 步骤尝试历史不可覆盖 |
| media_uploads | shop_id、asset_id、external_media_ref、status、binding_observation | 已上传与已绑定独立状态 |
| review_records | listing_id、snapshot_hash、observed_hash、decision、actor | 数据变化使旧审核过期 |
| job_events | job_id、sequence、type、payload、occurred_at | unique(job_id, sequence) |
| idempotency_keys | scope、key、request_hash、response、expires_at | 同键不同请求体拒绝 |

JSONB 适合类目属性与观察快照；业务唯一键、金额、库存和任务状态不能全部藏在无约束 JSON 中。数据库 migration 与应用校验共同维护约束。

## 5. 校验规则登记

| ID | 规则 | 等级 | 触发后处理 |
|---|---|---|---|
| D01 | productCode、merchantSku、实际组合唯一 | 阻塞 | 指出重复行 |
| D02 | prices 非负整数分；待售价格须满足已验证平台条件 | 阻塞 | 不猜价格，不按最低价自动覆盖 |
| D03 | stock 为非负整数 | 阻塞 | 定位 Offer |
| D04 | Offer 引用的 Variant、图片、颜色均存在且一致 | 阻塞 | 修正引用 |
| D05 | 每个实际 Variant 恰有一个 Offer，无额外组合 | 阻塞 | 补齐或删除无效输入 |
| D06 | 成衣尺寸与人体建议含义明确、单位匹配、范围有序 | 阻塞 | 用户确认 |
| D07 | 必需尺寸表覆盖全部销售尺码 | 阻塞 | 补数据 |
| D08 | 关键事实确认绑定当前输入快照 | 阻塞 | 重新确认变化字段 |
| D09 | 图片存在、可解码、类型/大小/比例符合当前规则 | 阻塞或需加工 | 加工后再核对，不静默拉伸 |
| D10 | 标题长度按平台实际计数方式，无缺失必要内容 | 阻塞 | 编辑；未知规则先勘察 |
| D11 | 类目及物流绑定已验证、店铺一致、未失效 | 阻塞 | 重选配置 |
| D12 | 属性在允许值中，条件必填已展开 | 阻塞 | 补充映射或用户选择 |
| D13 | 输入版本、规则版本与草稿一致 | 阻塞 | 重新编译并回读 |
| D14 | 库存确认未超过 TTL | 待确认 | 不替用户刷新确认时间 |
| D15 | 预期与观察所有关键值一致 | 阻塞发布交接 | 修正或人工接管 |

完整 Issue 格式见 05；规则需要确定错误对应字段，而不是只给“商品不合规”。

## 6. 状态模型

### 6.1 Job（执行生命周期）

`queued → running → succeeded`；running 可进入 waiting_user、retry_wait、reconciling、failed、cancelled。

- succeeded：当前任务目标完成，例如“草稿准备完毕”，不表示商品已上架。
- waiting_user：待登录、补字段或接管；恢复先检查输入版本、店铺身份与现场。
- retry_wait：仅对明确可重试失败，达到时间后入 queued。
- reconciling：副作用结果未知，读取现场；核实成功则推进，核实未发生才重试，无法确定转 waiting_user。
- failed/cancelled：终态；用户重试创建关联新任务，保留历史。
- pause 请求先设置 pause_requested，执行器在下一个安全边界进入 waiting_user，不承诺终止已经发出的平台请求。

### 6.2 Listing（平台业务状态）

`editing → validated → preparing → draft_ready → review_ready → submitted → platform_processing → live`。

分支状态：needs_input、stale、rejected、outcome_unknown、offline。平台允许直接观察到 live 时可以跳过未观察到的中间状态，但记录观察来源，不能伪造历史。

- draft_ready：保存并成功重开核对；无草稿模式使用 `review_ready` + `deliveryMode=interactive`，不得伪造 draft ID。
- review_ready：程序核对完成可交给商家，不代表用户已发布。
- submitted：明确观察到人工提交成功证据。
- live：读取明确上架状态与商品引用；链接单独记录 verifiedAt 和 verificationScope。
- 用户说已发布但无法获取证据：outcome_unknown，保留人工报告供核对。
- 刊登内容或规则变化使原快照及审核失效，状态 stale；不能复用旧审核覆盖新输入。

## 7. 导出

结果 CSV 字段：productCode、shopKey、jobId、listingStatus、externalProductId、productUrl、verifiedAt、errorCode、errorMessage。未拿到链接留空，不拼接未经验证的 URL。导出文本防止电子表格将以 =、+、-、@ 开头的用户内容当作公式执行。
