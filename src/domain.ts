export type Variant = {
  id: string
  color: string
  colorKey: string
  size: string
  sizeKey: string
  merchantSku: string
  enabled: boolean
  groupPrice: number | ''
  singlePrice: number | ''
  stock: number | ''
  image: string
}

export type Asset = { id: string; name: string; role: '主图' | '详情图' | 'SKU图'; color?: string; state: '已校验' | '待补图' }

export type Product = {
  id: string
  code: string
  name: string
  title: string
  category: string
  brand: string
  material: string
  fabricName: string
  fashionElements: string
  collar: string
  sleeve: string
  sleeveType: string
  garmentLength: string
  fit: string
  style: string
  ageRange: string
  listingSeason: string
  fleece: string
  gramsPerSquareMeter: number | ''
  qualification: string
  sizeTemplate: string
  sizeSystem: string
  syncSizeChartToDetail: boolean
  referencePrice: number | ''
  multiItemCount: number
  multiItemDiscount: number
  inventoryDeduction: string
  logistics: string
  shipping: string
  revision: number
  assets: Asset[]
  variants: Variant[]
  sizeRows: { size: string; length: number; bust: number; shoulder: number }[]
}

export type Issue = { id: string; severity: 'blocking' | 'confirmation' | 'warning'; title: string; detail: string }
export type JobState = 'idle' | 'validating' | 'filling' | 'verifying' | 'draft_ready' | 'waiting_user' | 'failed'

export const initialProduct: Product = {
  id: 'product-demo-A001',
  code: 'A001',
  name: '圆领短袖女士T恤测试款',
  title: '纯色圆领短袖修身女士T恤',
  category: '女装 / T恤 / T恤（真实字段模拟）',
  brand: '无品牌',
  material: '聚酯纤维95%，氨纶5%',
  fabricName: '涤纶',
  fashionElements: '纯色,简约',
  collar: '圆领',
  sleeve: '短袖',
  sleeveType: '常规袖',
  garmentLength: '常规款',
  fit: '修身型',
  style: '通勤',
  ageRange: '25-29周岁',
  listingSeason: '2026年秋季',
  fleece: '不加绒',
  gramsPerSquareMeter: 180,
  qualification: '普通商品',
  sizeTemplate: '衣服/女装上衣/中国码（平台推荐）',
  sizeSystem: '中国码',
  syncSizeChartToDetail: true,
  referencePrice: 169,
  multiItemCount: 2,
  multiItemDiscount: 9.5,
  inventoryDeduction: '支付成功减库存',
  logistics: '现货标准方案（模拟）',
  shipping: '48小时内发货及揽收',
  revision: 1,
  assets: [
    { id: 'asset-main-black', name: 'A001-black-front.jpg', role: '主图', color: '黑色', state: '已校验' },
    { id: 'asset-main-ivory', name: 'A001-ivory-front.jpg', role: '主图', color: '米白', state: '已校验' },
    { id: 'asset-detail', name: 'A001-detail.jpg', role: '详情图', state: '已校验' },
    { id: 'asset-sku-black', name: 'A001-black-front.jpg', role: 'SKU图', color: '黑色', state: '已校验' },
    { id: 'asset-sku-ivory', name: 'A001-ivory-front.jpg', role: 'SKU图', color: '米白', state: '已校验' }
  ],
  variants: [
    { id: 'black-s', color: '黑色', colorKey: 'black', size: 'S', sizeKey: 's', merchantSku: 'A001-BLK-S', enabled: true, groupPrice: 129, singlePrice: 139, stock: 20, image: 'asset-sku-black' },
    { id: 'black-m', color: '黑色', colorKey: 'black', size: 'M', sizeKey: 'm', merchantSku: 'A001-BLK-M', enabled: true, groupPrice: 129, singlePrice: 139, stock: 30, image: 'asset-sku-black' },
    { id: 'ivory-m', color: '米白', colorKey: 'ivory', size: 'M', sizeKey: 'm', merchantSku: 'A001-IVR-M', enabled: true, groupPrice: 139, singlePrice: 149, stock: 15, image: 'asset-sku-ivory' }
  ],
  sizeRows: [
    { size: 'S', length: 108, bust: 86, shoulder: 37 },
    { size: 'M', length: 110, bust: 90, shoulder: 38 }
  ]
}

export function validateProduct(product: Product): Issue[] {
  const issues: Issue[] = []
  if (!product.code.trim()) issues.push({ id: 'code', severity: 'blocking', title: '缺少货号', detail: '货号是本款素材、SKU 和草稿对账的基础。' })
  if (!product.title.trim()) issues.push({ id: 'title', severity: 'blocking', title: '缺少商品标题', detail: '填写标题后才能准备发布草稿。' })
  if (!product.material.trim()) issues.push({ id: 'material', severity: 'confirmation', title: '请确认主要材质', detail: '材质应来自水洗标、供应商资料或人工确认，不能只凭图片判断。' })
  if (!product.fabricName.trim()) issues.push({ id: 'fabricName', severity: 'blocking', title: '缺少面料名称', detail: '真实 T 恤页面将面料名称标为重要属性。' })
  if (!product.sizeTemplate.trim() || !product.sizeSystem.trim()) issues.push({ id: 'size-template', severity: 'blocking', title: '缺少尺码模板或尺码体系', detail: '平台先按尺码模板和体系提供可选尺码，再生成尺码表与规格矩阵。' })
  if (product.title.length > 30) issues.push({ id: 'title-length', severity: 'blocking', title: '商品标题超过 30 个汉字', detail: '当前真实页面提示商品标题最多输入 30 个汉字（60 个字符）。' })
  if (!validMoney(product.referencePrice) || Number(product.referencePrice) <= Math.max(...product.variants.map((item) => Number(item.singlePrice)))) issues.push({ id: 'reference-price', severity: 'blocking', title: '商品参考价无效', detail: '当前真实页面要求参考价大于商品最大单买价。' })
  if (!product.logistics.trim()) issues.push({ id: 'logistics', severity: 'blocking', title: '未选择物流方案', detail: '必须选择一个已验证的店铺物流配置。' })
  const block = (id: string, title: string) => issues.push({ id, severity: 'blocking', title, detail: '请补充或修正真实商品数据后重新准备。' })
  if (!product.variants.length || !product.variants.some((v) => v.enabled)) block('variants', '至少需要一个启用的销售规格')
  if (typeof product.gramsPerSquareMeter !== 'number' || !Number.isFinite(product.gramsPerSquareMeter) || product.gramsPerSquareMeter <= 0) block('grams', '平方米克重必须为正数')
  const ids = new Set<string>()
  const skus = new Set<string>()
  product.variants.forEach((v, index) => {
    if (!v.id.trim() || ids.has(v.id.trim())) block(`variant-id-${index}`, '规格 ID 为空或重复')
    ids.add(v.id.trim())
    if (skus.has(v.merchantSku.trim())) block(`merchant-sku-${index}`, '规格编码重复')
    skus.add(v.merchantSku.trim())
    if (![v.color, v.colorKey, v.size, v.sizeKey].every((value) => value.trim())) block(`identity-${index}`, '颜色或尺码标识缺失')
  })
  const sizes = new Set<string>()
  product.sizeRows.forEach((row, index) => {
    if (!row.size.trim() || sizes.has(row.size.trim())) block(`size-row-${index}`, '尺码表尺码为空或重复')
    sizes.add(row.size.trim())
    if (![row.length, row.bust, row.shoulder].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)) block(`measurement-${index}`, '成衣尺寸必须为有限正数')
  })
  const combinations = new Set<string>()
  product.variants.forEach((variant) => {
    const key = JSON.stringify([variant.colorKey.trim(), variant.sizeKey.trim()])
    if (combinations.has(key)) issues.push({ id: `duplicate-${variant.id}`, severity: 'blocking', title: `重复规格：${variant.color} ${variant.size}`, detail: '同一颜色与尺码只能存在一个实际销售规格。' })
    combinations.add(key)
    if (!variant.merchantSku.trim()) issues.push({ id: `sku-${variant.id}`, severity: 'blocking', title: `${variant.color} ${variant.size} 缺少规格编码`, detail: '每一个实际销售规格需要唯一的规格编码；它与整款商品编码分开。' })
    if (!validMoney(variant.groupPrice)) issues.push({ id: `group-price-${variant.id}`, severity: 'blocking', title: `${variant.color} ${variant.size} 拼单价无效`, detail: '拼单价必须为不小于 0 的金额。' })
    if (!validMoney(variant.singlePrice) || Number(variant.singlePrice) < Number(variant.groupPrice)) issues.push({ id: `single-price-${variant.id}`, severity: 'blocking', title: `${variant.color} ${variant.size} 单买价无效`, detail: '单买价必须为有效金额，且不能低于拼单价。' })
    if (!Number.isSafeInteger(variant.stock) || Number(variant.stock) < 0) issues.push({ id: `stock-${variant.id}`, severity: 'blocking', title: `${variant.color} ${variant.size} 库存无效`, detail: '库存必须为不小于 0 的整数。' })
    const image = product.assets.find((asset) => asset.id === variant.image)
    if (!image || image.role !== 'SKU图' || image.color !== variant.color || image.state !== '已校验') issues.push({ id: `image-${variant.id}`, severity: 'blocking', title: `${variant.color} ${variant.size} 缺少正确 SKU 图`, detail: 'SKU 图必须已校验，且颜色与销售规格一致。' })
  })
  const salesSizes = new Set(product.variants.map((item) => item.size))
  for (const size of salesSizes) if (!product.sizeRows.some((row) => row.size === size)) issues.push({ id: `size-${size}`, severity: 'blocking', title: `${size} 缺少成衣尺码数据`, detail: '尺码表应覆盖所有实际销售尺码。' })
  if (product.assets.filter((asset) => asset.role === '主图' && asset.state === '已校验').length < 1) issues.push({ id: 'main-image', severity: 'blocking', title: '缺少主图', detail: '至少需要一张已校验主图。' })
  return issues
}

export const totalStock = (product: Product) => product.variants.reduce((sum, variant) => sum + (variant.enabled ? Number(variant.stock) || 0 : 0), 0)

// Keep an empty editor value distinct from a legitimate zero.
export const parseNumericInput = (value: string): number | '' => value.trim() === '' ? '' : Number(value)
export function validMoney(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false
  const cents = value * 100
  return Number.isSafeInteger(Math.round(cents)) && Number(value.toFixed(2)) === value
}
