import LiveWorkbench from './LiveWorkbench'
import { useEffect, useMemo, useRef, useState } from 'react'
import { initialProduct, parseNumericInput, totalStock, validateProduct, type Issue, type JobState, type Product } from './domain'
import { MockDraft, differences } from './mock-draft'
import './styles.css'
import './linkage.css'

const STORAGE_KEY = 'ecom-style-link-agent.product.v1'
const STEP_LABEL: Record<JobState, string> = {
  idle: '尚未执行', validating: '正在校验商品资料', filling: '正在填写模拟商家页面', verifying: '正在回读核对', draft_ready: '模拟草稿已保存，等待人工审核', waiting_user: '等待人工处理', failed: '任务失败'
}

function loadProduct(): Product {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '') as Partial<Product>
    const savedVariants = Array.isArray(saved.variants) ? saved.variants : []
    return {
      ...initialProduct,
      ...saved,
      variants: Array.isArray(saved.variants) ? savedVariants : initialProduct.variants,
      assets: Array.isArray(saved.assets) ? saved.assets : initialProduct.assets,
      sizeRows: Array.isArray(saved.sizeRows) ? saved.sizeRows : initialProduct.sizeRows
    }
  } catch { return initialProduct }
}

function DemoApp() {
  const [product, setProduct] = useState<Product>(loadProduct)
  const [active, setActive] = useState<'商品资料' | '任务中心' | '审核结果'>('商品资料')
  const [job, setJob] = useState<JobState>('idle')
  const [events, setEvents] = useState<string[]>(['开发模式已就绪：尚未连接任何真实店铺。'])
  const [reviewed, setReviewed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const run = useRef(0)
  const [verified, setVerified] = useState<Product | null>(null)
  useEffect(() => () => { run.current += 1 }, [])
  const issues = useMemo(() => validateProduct(product), [product])
  const blockers = issues.filter((issue) => issue.severity === 'blocking')
  const confirmation = issues.filter((issue) => issue.severity === 'confirmation')
  const status = job === 'draft_ready' ? '待人工审核' : blockers.length ? '资料待补充' : '可准备'

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(product)) }, [product])

  const patch = (change: Partial<Product>) => {
    setProduct((current) => ({ ...current, ...change, revision: current.revision + 1 }))
    setDirty(true)
    setReviewed(false)
    run.current += 1
    setVerified(null)
    setJob('idle')
  }

  const prepare = async () => {
    const token = ++run.current
    const snapshot = structuredClone(product)
    const draft = new MockDraft<Product>()
    setVerified(null)
    setActive('任务中心')
    setReviewed(false)
    setEvents([])
    setJob('validating')
    await wait(650)
    if (token !== run.current) return
    const currentIssues = validateProduct(snapshot)
    if (currentIssues.some((item) => item.severity === 'blocking')) {
      setEvents(currentIssues.map((item) => `需要处理：${item.title}`))
      setJob('waiting_user')
      return
    }
    setEvents(['资料校验完成：SKU、尺寸表和素材关联通过。'])
    setJob('filling')
    draft.write(snapshot)
    await wait(850)
    if (token !== run.current) return
    setEvents((current) => [...current, '已填写基础信息、商品属性与素材。'])
    await wait(700)
    if (token !== run.current) return
    setEvents((current) => [...current, `已按颜色和尺码填写 ${snapshot.variants.length} 个实际销售规格。`])
    await wait(700)
    if (token !== run.current) return
    setJob('verifying')
    setEvents((current) => [...current, '正在回读价格、库存、SKU 图、尺码与物流配置。'])
    await wait(900)
    if (token !== run.current) return
    const observed = draft.read()
    const mismatch = differences(snapshot, observed)
    if (mismatch.length) {
      setEvents((current) => [...current, `模拟字段存储核对失败：${mismatch.join('、')}`])
      setJob('failed')
      return
    }
    setVerified(observed)
    setEvents((current) => [...current, '独立模拟字段存储核对通过；尚未验证真实浏览器填表或平台回读。'])
    setJob('draft_ready')
    setDirty(false)
  }

  const reset = () => {
    run.current += 1
    setVerified(null)
    setDirty(false)
    localStorage.removeItem(STORAGE_KEY)
    setProduct(initialProduct)
    setJob('idle')
    setEvents(['已恢复示例商品；不影响任何外部店铺。'])
    setReviewed(false)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">上</span><span>上新助手</span></div>
      <p className="environment"><span className="dot" /> 开发模式 · 模拟商家页</p>
      <nav>
        {(['商品资料', '任务中心', '审核结果'] as const).map((item) => <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>{item}<span>{item === '商品资料' ? blockers.length : item === '任务中心' && job !== 'idle' ? 1 : ''}</span></button>)}
      </nav>
      <div className="side-note">当前版本不连接拼多多，不会发布商品。用于完成资料、SKU 与自动填表逻辑开发。</div>
      <button className="reset" onClick={reset}>恢复示例资料</button>
    </aside>
    <main className="content">
      <header className="topbar"><div><p className="eyebrow">商品自动上新 Agent</p><h1>{active}</h1></div><div className="shop-chip">模拟店铺 · 女装测试店 <span>未连接</span></div></header>
      {active === '商品资料' && <ProductEditor product={product} patch={patch} issues={issues} onPrepare={prepare} state={status} blockers={blockers.length} confirmations={confirmation.length} dirty={dirty} />}
      {active === '任务中心' && <TaskCenter state={job} events={events} product={product} onPrepare={prepare} blockers={blockers.length} />}
      {active === '审核结果' && <Review product={verified || product} state={job} reviewed={reviewed} setReviewed={(value) => { if (verified && verified.revision === product.revision && job === 'draft_ready') setReviewed(value) }} onOpenTask={() => setActive('任务中心')} />}
    </main>
  </div>
}

function ProductEditor({ product, patch, issues, onPrepare, state, blockers, confirmations, dirty }: { product: Product; patch: (change: Partial<Product>) => void; issues: Issue[]; onPrepare: () => void; state: string; blockers: number; confirmations: number; dirty: boolean }) {
  const setField = (field: keyof Product, value: string) => patch({ [field]: value } as Partial<Product>)
  const setVariant = (id: string, field: 'groupPrice' | 'singlePrice' | 'stock' | 'merchantSku', value: string) => patch({ variants: product.variants.map((variant) => variant.id === id ? { ...variant, [field]: field === 'merchantSku' ? value : parseNumericInput(value) } : variant) })
  const setVariantEnabled = (id: string, enabled: boolean) => patch({ variants: product.variants.map((variant) => variant.id === id ? { ...variant, enabled } : variant) })
  return <div className="page-grid">
    <section className="main-column">
      <div className="status-card"><div><p className="eyebrow">当前商品</p><h2>{product.name}</h2><p>货号 {product.code} · 版本 {product.revision} {dirty && '· 有未准备的修改'}</p></div><div className={`status-pill ${blockers ? 'status-danger' : 'status-ok'}`}>{state}</div></div>
      <section className="card"><CardTitle number="01" title="基本资料" subtitle="商品事实与店铺刊登内容分开维护；整款商品编码与逐规格编码分开。" /><div className="fields two"><Field label="商品编码 / 货号" value={product.code} onChange={(value) => setField('code', value)} /><Field label="商品内部名称" value={product.name} onChange={(value) => setField('name', value)} /><Field label="发布标题（最多 30 个汉字）" value={product.title} onChange={(value) => setField('title', value)} wide /><SelectField label="类目" value={product.category} onChange={(value) => setField('category', value)} options={['女装 / T恤 / T恤（真实字段模拟）', '女装 / 连衣裙（待后续验证）']} /><SelectField label="品牌" value={product.brand} onChange={(value) => setField('brand', value)} options={['无品牌', '示例品牌']} /></div></section>
      <section className="card"><CardTitle number="02" title="商品属性" subtitle="已按真实 T 恤页面补充重要属性；材质仍应以标签或供应商资料为准。" /><div className="fields two"><Field label="主要材质" value={product.material} onChange={(value) => setField('material', value)} /><Field label="面料名称（重要）" value={product.fabricName} onChange={(value) => setField('fabricName', value)} /><Field label="流行元素（最多 3 个）" value={product.fashionElements} onChange={(value) => setField('fashionElements', value)} /><SelectField label="主风格（重要）" value={product.style} onChange={(value) => setField('style', value)} options={['通勤', '法式', '休闲']} /><SelectField label="袖长（重要）" value={product.sleeve} onChange={(value) => setField('sleeve', value)} options={['长袖', '短袖', '无袖']} /><SelectField label="服装版型（重要）" value={product.fit} onChange={(value) => setField('fit', value)} options={['修身型', '常规型', '宽松型']} /><SelectField label="衣长（重要）" value={product.garmentLength} onChange={(value) => setField('garmentLength', value)} options={['短款', '常规款', '中长款']} /><SelectField label="领型" value={product.collar} onChange={(value) => setField('collar', value)} options={['方领', '圆领', 'V领']} /><SelectField label="袖型" value={product.sleeveType} onChange={(value) => setField('sleeveType', value)} options={['常规袖', '泡泡袖', '插肩袖']} /><SelectField label="适用年龄（重要）" value={product.ageRange} onChange={(value) => setField('ageRange', value)} options={['18-24周岁', '25-29周岁', '30-34周岁']} /><Field label="上市时节（重要）" value={product.listingSeason} onChange={(value) => setField('listingSeason', value)} /><SelectField label="是否加绒（重要）" value={product.fleece} onChange={(value) => setField('fleece', value)} options={['不加绒', '加绒']} /><Field label="平方米克重（重要）" value={String(product.gramsPerSquareMeter)} onChange={(value) => patch({ gramsPerSquareMeter: parseNumericInput(value) })} /><SelectField label="商品资质" value={product.qualification} onChange={(value) => setField('qualification', value)} options={['普通商品', '其他资质待确认']} /></div></section>
      <section className="card"><CardTitle number="03" title="销售规格与库存" subtitle="颜色与尺码先确定规格矩阵，再逐行填写库存、双价格、规格编码、预览图和启用状态。" /><div className="fields two spec-settings"><Field label="尺码模板" value={product.sizeTemplate} onChange={(value) => setField('sizeTemplate', value)} /><SelectField label="尺码体系" value={product.sizeSystem} onChange={(value) => setField('sizeSystem', value)} options={['通用', '中国码', '欧码', '英码', '德码', '美码', '均码']} /></div><div className="table-wrap"><table><thead><tr><th>颜色</th><th>尺码</th><th>规格编码</th><th>拼单价</th><th>单买价</th><th>库存</th><th>预览图</th><th>状态</th></tr></thead><tbody>{product.variants.map((variant) => <tr key={variant.id}><td><span className={`swatch ${variant.colorKey}`} />{variant.color}</td><td>{variant.size}</td><td><input aria-label={`${variant.color}${variant.size}规格编码`} value={variant.merchantSku} onChange={(event) => setVariant(variant.id, 'merchantSku', event.target.value)} /></td><td><input aria-label={`${variant.color}${variant.size}拼单价`} type="number" min="0" step="0.01" value={variant.groupPrice} onChange={(event) => setVariant(variant.id, 'groupPrice', event.target.value)} /></td><td><input aria-label={`${variant.color}${variant.size}单买价`} type="number" min="0" step="0.01" value={variant.singlePrice} onChange={(event) => setVariant(variant.id, 'singlePrice', event.target.value)} /></td><td><input aria-label={`${variant.color}${variant.size}库存`} type="number" min="0" step="1" value={variant.stock} onChange={(event) => setVariant(variant.id, 'stock', event.target.value)} /></td><td className="asset-ref">{product.assets.find((asset) => asset.id === variant.image)?.name || '未绑定'}</td><td><label className="toggle-label"><input aria-label={`${variant.color}${variant.size}启用状态`} type="checkbox" checked={variant.enabled} onChange={(event) => setVariantEnabled(variant.id, event.target.checked)} />{variant.enabled ? '启用' : '停用'}</label></td></tr>)}</tbody></table></div><p className="table-foot">共 {product.variants.length} 个实际销售规格 · 总库存 {totalStock(product)} 件。真实页面还支持按颜色/尺码筛选、批量设置和 Excel 批量编辑。</p></section>
      <section className="card"><CardTitle number="04" title="尺码表与素材" subtitle="平台推荐模板可按所选尺码生成尺码表；当前记录成衣实测值，并单独控制是否同步到商品详情。" /><label className="toggle-label sync-toggle"><input type="checkbox" checked={product.syncSizeChartToDetail} onChange={(event) => patch({ syncSizeChartToDetail: event.target.checked })} />保存尺码表图片并同步添加到商品详情</label><div className="split"><div className="table-wrap compact"><table><thead><tr><th>尺码</th><th>衣长 (cm)</th><th>胸围 (cm)</th><th>肩宽 (cm)</th></tr></thead><tbody>{product.sizeRows.map((row) => <tr key={row.size}><td>{row.size}</td><td>{row.length}</td><td>{row.bust}</td><td>{row.shoulder}</td></tr>)}</tbody></table></div><div className="asset-list">{product.assets.map((asset) => <div className="asset" key={asset.id}><div className="asset-icon">{asset.role === 'SKU图' ? 'S' : asset.role === '主图' ? '主' : '详'}</div><div><b>{asset.name}</b><p>{asset.role}{asset.color ? ` · ${asset.color}` : ''}</p></div><span className={asset.state === '已校验' ? 'tag approved' : 'tag'}>{asset.state}</span></div>)}</div></div></section>
      <section className="card"><CardTitle number="05" title="价格策略与服务承诺" subtitle="这些字段来自当前真实 T 恤发布页面，选项值仍需后续交互验证。" /><div className="fields two"><Field label="商品参考价（须大于最大单买价）" value={String(product.referencePrice)} onChange={(value) => patch({ referencePrice: parseNumericInput(value) })} /><label className="field"><span>满件折扣（当前页面默认）</span><input value={`${product.multiItemCount}件 ${product.multiItemDiscount}折`} readOnly /></label><SelectField label="库存扣减方式" value={product.inventoryDeduction} onChange={(value) => setField('inventoryDeduction', value)} options={['支付成功减库存']} /><SelectField label="承诺发货时间" value={product.shipping} onChange={(value) => setField('shipping', value)} options={['48小时内发货及揽收', '24小时内发货及揽收', '当日发货及揽收']} /><SelectField label="物流方案（内部模拟配置）" value={product.logistics} onChange={(value) => setField('logistics', value)} options={['现货标准方案（模拟）', '预售方案（模拟）']} /></div><p className="table-foot">当前页面显示：7 天无理由退货为该类商品必选；“假一赔十”为可选项，具体服务开关后续按实际业务确认。</p></section>
    </section>
    <aside className="right-column"><div className="card readiness"><p className="eyebrow">准备检查</p><h2>{blockers ? `${blockers} 个阻塞项` : confirmations ? `${confirmations} 个待确认项` : '资料已就绪'}</h2><p>{blockers ? '处理阻塞项后才能自动填写模拟页面。' : confirmations ? '可继续模拟执行；真实店铺前应确认这些事实。' : '可以生成模拟草稿。'}</p><button className="primary" disabled={blockers > 0} onClick={onPrepare}>{blockers ? '请先处理资料' : '自动填写模拟页面'}</button></div><div className="card issues"><p className="eyebrow">问题列表</p>{issues.length === 0 ? <div className="empty-check">✓ SKU、素材、尺码与物流配置检查通过</div> : issues.map((issue) => <div className={`issue ${issue.severity}`} key={issue.id}><b>{issue.title}</b><p>{issue.detail}</p></div>)}</div><div className="mock-guard">所有按钮只运行本地模拟流程。真实拼多多登录、API、发布和商品链接均未接入。</div></aside>
  </div>
}

function TaskCenter({ state, events, product, onPrepare, blockers }: { state: JobState; events: string[]; product: Product; onPrepare: () => void; blockers: number }) {
  const stages: JobState[] = ['validating', 'filling', 'verifying', 'draft_ready']
  const reached = stages.indexOf(state)
  return <div className="task-layout"><section className="card task-summary"><div><p className="eyebrow">任务 #mock-{product.code.toLowerCase()}-001</p><h2>{STEP_LABEL[state]}</h2><p>{product.name} · {product.variants.length} 个 SKU · {totalStock(product)} 件库存</p></div>{state === 'idle' || state === 'waiting_user' ? <button className="primary" disabled={blockers > 0} onClick={onPrepare}>开始模拟填写</button> : <span className="status-pill status-ok">模拟任务</span>}</section><section className="card"><CardTitle number="流程" title="自动填写与回读" subtitle="每一步完成后都需要读取页面状态，不只依赖点击成功。" /><div className="steps">{stages.map((stage, index) => <div className={`step ${reached >= index ? 'done' : ''} ${state === stage ? 'current' : ''}`} key={stage}><span>{reached > index ? '✓' : index + 1}</span><div><b>{STEP_LABEL[stage]}</b><p>{stage === 'validating' ? '校验商品、SKU、素材和尺寸引用' : stage === 'filling' ? '按结构化数据填写基本信息、属性、规格与物流' : stage === 'verifying' ? '逐行读取 SKU 与关键字段，生成差异报告' : '保存模拟草稿，进入人工审核'}</p></div></div>)}</div></section><section className="card"><CardTitle number="日志" title="本次执行记录" subtitle="真实平台模式会记录脱敏页面证据及结果对账。" />{events.length ? <ol className="events">{events.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}</ol> : <p className="muted">尚未创建任务。</p>}</section></div>
}

function Review({ product, state, reviewed, setReviewed, onOpenTask }: { product: Product; state: JobState; reviewed: boolean; setReviewed: (value: boolean) => void; onOpenTask: () => void }) {
  if (state !== 'draft_ready') return <div className="empty-state"><div className="empty-icon">◎</div><h2>尚无可审核的模拟草稿</h2><p>完成“自动填写模拟页面”和回读核对后，审核信息会显示在这里。</p><button className="primary" onClick={onOpenTask}>前往任务中心</button></div>
  return <div className="review-layout"><section className="card"><p className="eyebrow">模拟草稿 · 仅开发验证</p><h2>{product.title}</h2><p className="muted">目标类目：{product.category} · 物流：{product.logistics} · {product.shipping}</p><div className="review-grid"><div><h3>销售规格已核对</h3>{product.variants.map((variant) => <div className="review-row" key={variant.id}><span>{variant.color} / {variant.size}</span><b>拼 ¥{Number(variant.groupPrice).toFixed(2)} / 单 ¥{Number(variant.singlePrice).toFixed(2)}</b><span>{variant.stock} 件</span><span>{variant.merchantSku}</span><i>已匹配 SKU 图</i></div>)}</div><div><h3>素材与尺寸</h3><p>主图 {product.assets.filter((asset) => asset.role === '主图').length} 张 · 详情图 {product.assets.filter((asset) => asset.role === '详情图').length} 张</p><p>成衣尺寸表覆盖：{product.sizeRows.map((row) => row.size).join('、')}</p><p>参考价：¥{Number(product.referencePrice).toFixed(2)} · 总库存：{totalStock(product)} 件</p><div className="compare-ok">✓ 预期数据与独立模拟字段存储一致</div></div></div></section><section className="card human-review"><p className="eyebrow">人工审核</p><h2>{reviewed ? '已完成内部审核' : '等待人工确认'}</h2><p>真实拼多多版本会在这里打开草稿供你检查。v0.1 不会点击“提交并上架”。</p><button className="primary" onClick={() => setReviewed(true)} disabled={reviewed}>{reviewed ? '已标记审核完成' : '标记内部审核通过'}</button><div className="mock-guard">模拟商品链接：不生成。只有实店发布结果经页面或官方能力核实后，才能记录真实商品 ID 与链接。</div></section></div>
}

function CardTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="card-title"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div> }
function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <label className={wide ? 'field wide' : 'field'}><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label> }
function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)) }

export default function App(){return new URLSearchParams(window.location.search).get("demo")==="1"?<DemoApp/>:<LiveWorkbench/>}
