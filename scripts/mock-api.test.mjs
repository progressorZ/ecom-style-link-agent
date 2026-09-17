import test from 'node:test'
import assert from 'node:assert/strict'
import { listenMockApi } from './mock-api.mjs'

let api
let baseUrl

test.before(async () => {
  api = await listenMockApi(0)
  baseUrl = `http://127.0.0.1:${api.port}`
})

test.after(async () => { await api.close() })

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options)
  return { status: response.status, body: await response.json() }
}

test('exposes only a clearly labelled mock shop and template', async () => {
  const health = await request('/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.data.mode, 'mock')
  const shops = await request('/api/v1/shops')
  assert.equal(shops.body.data[0].executionMode, 'mock')
  const templates = await request('/api/v1/shops/shop-mock-001/templates')
  assert.equal(templates.body.data[0].verificationStatus, 'simulated')
})

test('rejects incomplete listing input with explicit business errors', async () => {
  const created = await request('/api/v1/listings', post({ productId: 'product-demo-A001', shopId: 'shop-mock-001' }))
  assert.equal(created.status, 201)
  const result = await request(`/api/v1/listings/${created.body.data.id}/validate`, post({}))
  assert.equal(result.status, 200)
  assert.equal(result.body.data.executable, false)
  assert.ok(result.body.data.issues.some((item) => item.code === 'LOGISTICS_UNAVAILABLE'))
})

test('runs the valid mock lifecycle without returning a real product URL', async () => {
  const product = (await request('/api/v1/products/product-demo-A001')).body.data
  const listing = await request('/api/v1/listings', post({
    productId: product.id,
    shopId: 'shop-mock-001',
    logisticsProfileKey: 'mock-standard-48h',
    referencePriceMinor: 16900,
    offers: product.variants.map((variant) => ({ variantId: variant.id, enabled: variant.enabled, groupPriceMinor: variant.groupPriceMinor, singlePriceMinor: variant.singlePriceMinor, stock: variant.stock }))
  }))
  const id = listing.body.data.id
  const validation = await request(`/api/v1/listings/${id}/validate`, post({}))
  assert.equal(validation.body.data.executable, true)
  const prepared = await request(`/api/v1/listings/${id}/prepare`, post({}))
  assert.equal(prepared.status, 202)
  await new Promise((resolve) => setTimeout(resolve, 220))
  const job = await request(`/api/v1/jobs/${prepared.body.data.jobId}`)
  assert.equal(job.body.data.status, 'succeeded')
  const review = await request(`/api/v1/listings/${id}/review`)
  assert.deepEqual(review.body.data.differences, [])
  const approved = await request(`/api/v1/listings/${id}/reviews`, post({ decision: 'approved' }))
  assert.equal(approved.body.data.status, 'review_ready')
  const outcome = await request(`/api/v1/listings/${id}/check-outcome`, post({}))
  assert.equal(outcome.body.data.status, 'outcome_unknown')
  assert.equal(outcome.body.data.productUrl, undefined)
})

test('rejects invalid single-purchase and reference prices', async () => {
  const product = (await request('/api/v1/products/product-demo-A001')).body.data
  const listing = await request('/api/v1/listings', post({
    productId: product.id,
    shopId: 'shop-mock-001',
    logisticsProfileKey: 'mock-standard-48h',
    referencePriceMinor: 10000,
    offers: product.variants.map((variant, index) => ({ variantId: variant.id, enabled: variant.enabled, groupPriceMinor: variant.groupPriceMinor, singlePriceMinor: index === 0 ? 1 : variant.singlePriceMinor, stock: variant.stock }))
  }))
  const validation = await request(`/api/v1/listings/${listing.body.data.id}/validate`, post({}))
  const codes = validation.body.data.issues.map((item) => item.code)
  assert.ok(codes.includes('INPUT_INVALID'))
  assert.ok(codes.includes('REFERENCE_PRICE_INVALID'))
})

test('keeps variant enabled state and excludes disabled stock from the sellable total', async () => {
  const product = (await request('/api/v1/products/product-demo-A001')).body.data
  const listing = await request('/api/v1/listings', post({
    productId: product.id,
    shopId: 'shop-mock-001',
    logisticsProfileKey: 'mock-standard-48h',
    referencePriceMinor: 16900,
    offers: product.variants.map((variant, index) => ({ variantId: variant.id, enabled: index !== 0, groupPriceMinor: variant.groupPriceMinor, singlePriceMinor: variant.singlePriceMinor, stock: variant.stock }))
  }))
  assert.equal(listing.body.data.offers[0].enabled, false)
  assert.equal(listing.body.data.totalStock, 45)
})

function post(body) { return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } }

async function validListing() {
  const product = (await request('/api/v1/products/product-demo-A001')).body.data
  return (await request('/api/v1/listings', post({ productId: product.id, shopId: 'shop-mock-001', logisticsProfileKey: 'mock-standard-48h', referencePriceMinor: 16900, offers: product.variants.map((v) => ({ variantId: v.id, stock: v.stock, groupPriceMinor: v.groupPriceMinor, singlePriceMinor: v.singlePriceMinor })) }))).body.data.id
}

test('blocks approval before preparation, during preparation and after return', async () => {
  const id = await validListing()
  const approve = () => request(`/api/v1/listings/${id}/reviews`, post({ decision: 'approved' }))
  assert.equal((await approve()).status, 409)
  await request(`/api/v1/listings/${id}/prepare`, post({}))
  assert.equal((await approve()).status, 409)
  await request(`/api/v1/listings/${id}/validate`, post({}))
  assert.equal((await request(`/api/v1/listings/${id}/prepare`, post({}))).status, 409)
  await new Promise((resolve) => setTimeout(resolve, 220))
  assert.equal((await request(`/api/v1/listings/${id}/reviews`, post({ decision: 'returned' }))).status, 200)
  assert.equal((await approve()).status, 409)
  await request(`/api/v1/listings/${id}/prepare`, post({}))
  await new Promise((resolve) => setTimeout(resolve, 220))
  assert.equal((await approve()).status, 200)
})

test('fails preparation when independently stored draft is corrupted', async () => {
  const { createMockApi } = await import('./mock-api.mjs')
  const isolated = createMockApi({ mutateDraft: (draft) => draft.setField('referencePriceMinor', 1) })
  await new Promise((resolve) => isolated.server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${isolated.server.address().port}`
  const call = async (path, options) => { const r = await fetch(url + path, options); return { status: r.status, body: await r.json() } }
  try {
    const p = (await call('/api/v1/products/product-demo-A001')).body.data
    const id = (await call('/api/v1/listings', post({ productId: p.id, shopId: 'shop-mock-001', logisticsProfileKey: 'mock', referencePriceMinor: 16900, offers: p.variants.map((v) => ({ variantId: v.id, stock: v.stock, groupPriceMinor: v.groupPriceMinor, singlePriceMinor: v.singlePriceMinor })) }))).body.data.id
    const prepared = await call(`/api/v1/listings/${id}/prepare`, post({}))
    await new Promise((resolve) => setTimeout(resolve, 220))
    assert.equal((await call(`/api/v1/jobs/${prepared.body.data.jobId}`)).body.data.status, 'failed')
    assert.equal((await call(`/api/v1/listings/${id}/reviews`, post({ decision: 'approved' }))).status, 409)
  } finally { await isolated.close() }
})
