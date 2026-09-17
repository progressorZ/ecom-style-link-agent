import { MockDraft, differences } from '../src/mock-draft.ts'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()
const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

export function createMockApi({ mutateDraft = () => {} } = {}) {
  const shop = { id: 'shop-mock-001', platform: 'pdd', name: '女装测试店', connectionStatus: 'simulated', executionMode: 'mock' }
  const product = {
    id: 'product-demo-A001', code: 'A001', name: '圆领短袖女士T恤测试款', title: '纯色圆领短袖修身女士T恤',
    category: 'womenswear.tshirt.mock', revision: 2,
    variants: [
      { id: 'black-s', color: '黑色', size: 'S', merchantSku: 'A001-BLK-S', enabled: true, groupPriceMinor: 12900, singlePriceMinor: 13900, stock: 20 },
      { id: 'black-m', color: '黑色', size: 'M', merchantSku: 'A001-BLK-M', enabled: true, groupPriceMinor: 12900, singlePriceMinor: 13900, stock: 30 },
      { id: 'ivory-m', color: '米白', size: 'M', merchantSku: 'A001-IVR-M', enabled: true, groupPriceMinor: 13900, singlePriceMinor: 14900, stock: 15 }
    ]
  }
  const listings = new Map()
  const jobs = new Map()
  const reviews = new Map()

  const issue = (code, severity, fieldPath, message) => ({ code, severity, fieldPath, message })
  const validate = (listing) => {
    const issues = []
    if (!listing.title?.trim()) issues.push(issue('REQUIRED_FACT_MISSING', 'blocking', '/listing/title', '缺少商品标题'))
    if (!listing.logisticsProfileKey) issues.push(issue('LOGISTICS_UNAVAILABLE', 'blocking', '/listing/logistics/profileKey', '未选择物流方案'))
    if (!listing.offers?.length) issues.push(issue('SKU_SET_MISMATCH', 'blocking', '/listing/offers', '缺少销售规格'))
    const variants = new Set(product.variants.map((item) => item.id))
    const seen = new Set()
    for (const offer of listing.offers || []) {
      if (!variants.has(offer.variantId)) issues.push(issue('SKU_SET_MISMATCH', 'blocking', '/listing/offers', `未知规格 ${offer.variantId}`))
      if (seen.has(offer.variantId)) issues.push(issue('SKU_SET_MISMATCH', 'blocking', '/listing/offers', `规格重复 ${offer.variantId}`))
      seen.add(offer.variantId)
      if (!Number.isInteger(offer.stock) || offer.stock < 0) issues.push(issue('INPUT_INVALID', 'blocking', `/listing/offers/${offer.variantId}/stock`, '库存必须是不小于 0 的整数'))
      if (!Number.isInteger(offer.groupPriceMinor) || offer.groupPriceMinor < 0) issues.push(issue('INPUT_INVALID', 'blocking', `/listing/offers/${offer.variantId}/groupPriceMinor`, '拼单价必须以非负整数分表示'))
      if (!Number.isInteger(offer.singlePriceMinor) || offer.singlePriceMinor < offer.groupPriceMinor) issues.push(issue('INPUT_INVALID', 'blocking', `/listing/offers/${offer.variantId}/singlePriceMinor`, '单买价必须以整数分表示且不能低于拼单价'))
    }
    if (seen.size !== variants.size) issues.push(issue('SKU_SET_MISMATCH', 'blocking', '/listing/offers', '实际销售规格集合不完整'))
    const maxSinglePrice = Math.max(0, ...(listing.offers || []).map((offer) => offer.singlePriceMinor || 0))
    if (!Number.isInteger(listing.referencePriceMinor) || listing.referencePriceMinor <= maxSinglePrice) issues.push(issue('REFERENCE_PRICE_INVALID', 'blocking', '/listing/referencePriceMinor', '商品参考价必须大于最大单买价'))
    return issues
  }
  const publicListing = (listing) => ({ ...listing, product: { id: product.id, code: product.code, name: product.name }, shop, totalStock: listing.offers.reduce((total, offer) => total + (offer.enabled === false ? 0 : offer.stock), 0) })
  const server = createServer(async (request, response) => {
    const requestId = randomUUID()
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    const path = url.pathname
    if (request.method === 'OPTIONS') { response.writeHead(204, cors()); response.end(); return }
    const send = (status, body) => json(response, status, { ...body, requestId })
    try {
      if (request.method === 'GET' && path === '/health') return send(200, { data: { status: 'ok', mode: 'mock', at: now() } })
      if (request.method === 'GET' && path === '/api/v1/shops') return send(200, { data: [shop] })
      if (request.method === 'GET' && path === `/api/v1/shops/${shop.id}/templates`) return send(200, { data: [{ id: 'template-dress-v1', shopId: shop.id, category: product.category, verificationStatus: 'simulated', defaults: { logisticsProfileKey: 'mock-standard-48h' } }] })
      if (request.method === 'GET' && path === `/api/v1/products/${product.id}`) return send(200, { data: product })
      if (request.method === 'POST' && path === '/api/v1/listings') {
        const body = await readBody(request)
        if (body.productId !== product.id || body.shopId !== shop.id) return send(422, error('INPUT_INVALID', '商品或店铺不属于模拟环境'))
        const id = `listing-mock-${randomUUID().slice(0, 8)}`
        const listing = { id, productId: product.id, shopId: shop.id, revision: 1, status: 'editing', title: body.title ?? product.title, logisticsProfileKey: body.logisticsProfileKey ?? '', sizeTemplate: body.sizeTemplate ?? '衣服/女装上衣/中国码（平台推荐）', sizeSystem: body.sizeSystem ?? '中国码', syncSizeChartToDetail: body.syncSizeChartToDetail ?? true, referencePriceMinor: body.referencePriceMinor ?? null, inventoryDeduction: body.inventoryDeduction ?? 'payment_success', multiItemDiscount: body.multiItemDiscount ?? { count: 2, discount: 9.5 }, serviceCommitments: body.serviceCommitments ?? { sevenDayReturn: true, counterfeitCompensation: false }, offers: (body.offers ?? []).map((offer) => ({ enabled: true, ...offer })), createdAt: now(), updatedAt: now(), environment: 'mock' }
        listings.set(id, listing)
        return send(201, { data: publicListing(listing) })
      }
      const listingId = path.match(/^\/api\/v1\/listings\/([^/]+)/)?.[1]
      const listing = listingId ? listings.get(listingId) : undefined
      if (listing && request.method === 'GET' && path === `/api/v1/listings/${listingId}`) return send(200, { data: publicListing(listing) })
      if (listing && request.method === 'POST' && path === `/api/v1/listings/${listingId}/validate`) {
        const issues = validate(listing)
        if (['editing', 'needs_input', 'validated'].includes(listing.status)) listing.status = issues.some((item) => item.severity === 'blocking') ? 'needs_input' : 'validated'
        listing.updatedAt = now()
        return send(200, { data: { listingId, executable: issues.length === 0, issues, rulesVersion: 'mock-dress-v1' } })
      }
      if (listing && request.method === 'POST' && path === `/api/v1/listings/${listingId}/prepare`) {
        if (listing.status === 'preparing') return send(409, error('JOB_IN_PROGRESS', '已有准备任务正在执行'))
        const issues = validate(listing)
        if (issues.length) return send(422, { error: { code: 'VALIDATION_FAILED', message: '商品资料未通过校验', issues } })
        const jobId = `job-mock-${randomUUID().slice(0, 8)}`
        const job = { id: jobId, listingId, status: 'queued', step: 'validating', environment: 'mock', events: [{ type: 'job.queued', occurredAt: now(), message: '模拟任务已创建' }] }
        const expected = structuredClone({
          revision: listing.revision, title: listing.title, offers: listing.offers,
          logisticsProfileKey: listing.logisticsProfileKey, sizeTemplate: listing.sizeTemplate,
          sizeSystem: listing.sizeSystem, syncSizeChartToDetail: listing.syncSizeChartToDetail,
          referencePriceMinor: listing.referencePriceMinor, inventoryDeduction: listing.inventoryDeduction,
          multiItemDiscount: listing.multiItemDiscount, serviceCommitments: listing.serviceCommitments
        })
        const draft = new MockDraft()
        reviews.delete(listingId)
        jobs.set(jobId, job); listing.status = 'preparing'; listing.updatedAt = now()
        setTimeout(() => { draft.write(expected); job.status = 'running'; job.step = 'filling'; job.events.push({ type: 'step.verified', occurredAt: now(), message: '模拟页面已填写基础信息和销售规格' }) }, 60)
        setTimeout(() => {
          try {
            mutateDraft(draft) // Test-only dependency injection; never exposed by an HTTP endpoint.
            const observed = draft.read()
            const mismatch = differences(expected, observed)
            job.differences = mismatch
            reviews.set(listingId, { revision: listing.revision, expected, observed, differences: mismatch })
            job.status = mismatch.length ? 'failed' : 'succeeded'
            job.step = mismatch.length ? 'verification_failed' : 'draft_ready'
            listing.status = mismatch.length ? 'needs_input' : 'draft_ready'
            job.events.push({ type: `job.${job.status}`, occurredAt: now(), message: mismatch.length ? '独立模拟字段核对失败' : '独立模拟字段核对通过；不代表真实浏览器回读' })
            if (!mismatch.length) listing.externalDraftId = `mock-draft-${listing.id}`
            listing.updatedAt = now()
          } catch {
            job.status = 'failed'; job.step = 'verification_failed'; listing.status = 'needs_input'
          }
        }, 150)
        return send(202, { data: { jobId, status: job.status, environment: 'mock' } })
      }
      if (request.method === 'GET' && path.match(/^\/api\/v1\/jobs\/([^/]+)$/)) {
        const job = jobs.get(path.split('/').at(-1))
        return job ? send(200, { data: job }) : send(404, error('NOT_FOUND', '任务不存在'))
      }
      if (listing && request.method === 'GET' && path === `/api/v1/listings/${listingId}/review`) {
        if (listing.status !== 'draft_ready' && listing.status !== 'review_ready') return send(409, error('REVIEW_NOT_READY', '模拟草稿尚未准备完成'))
        return send(200, { data: { listingId, environment: 'mock', ...reviews.get(listingId), externalDraftId: listing.externalDraftId } })
      }
      if (listing && request.method === 'POST' && path === `/api/v1/listings/${listingId}/reviews`) {
        const body = await readBody(request)
        if (body.decision !== 'approved' && body.decision !== 'returned') return send(422, error('INPUT_INVALID', 'decision 只能是 approved 或 returned'))
        const review = reviews.get(listingId)
        if (listing.status !== 'draft_ready' || !review || review.revision !== listing.revision || review.differences.length) return send(409, error('REVIEW_NOT_READY', '仅允许审核当前版本且核对通过的模拟草稿'))
        listing.status = body.decision === 'approved' ? 'review_ready' : 'needs_input'; listing.updatedAt = now()
        return send(200, { data: { listingId, decision: body.decision, status: listing.status, environment: 'mock' } })
      }
      if (listing && request.method === 'POST' && path === `/api/v1/listings/${listingId}/check-outcome`) return send(200, { data: { listingId, status: 'outcome_unknown', reason: 'mock 模式禁止生成真实商品 ID 或链接', environment: 'mock' } })
      return send(404, error('NOT_FOUND', '接口不存在'))
    } catch (cause) {
      return send(400, error('REQUEST_INVALID', cause instanceof Error ? cause.message : '请求体无效'))
    }
  })
  return { server, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,idempotency-key' } }
function error(code, message) { return { error: { code, message } } }
async function readBody(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); const raw = Buffer.concat(chunks).toString(); return raw ? JSON.parse(raw) : {} }
export async function listenMockApi(port = Number(process.env.PORT || 8787)) { const api = createMockApi(); await new Promise((resolve) => api.server.listen(port, '127.0.0.1', resolve)); return { ...api, port: api.server.address().port } }

if (import.meta.url === `file://${process.argv[1]}`) {
  const api = await listenMockApi()
  console.log(`Mock API listening at http://127.0.0.1:${api.port} (mode=mock; no real platform connection)`)
}
