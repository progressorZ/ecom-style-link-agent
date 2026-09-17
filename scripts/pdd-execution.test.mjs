import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { compileBasicPlan, executeBasicPlan } from './pdd-basic-adapter.mjs'
import { indexSkuRows } from './pdd-regions.mjs'
const plan={scope:'pdd-tshirt-basic-v1',fields:[{key:'listing.title',value:'自动化测试标题'},{key:'product.productCode',value:'AUTO-TEST-001'}]}
const cell=(text='',inputCount=0,rowSpan=1)=>({text,inputCount,rowSpan,colSpan:1})
const headers=['颜色','尺码','库存','拼单价(元)','单买价(元)','规格编码']
test('maps merged colors to actual SKU keys and rejects duplicate or incomplete matrices',()=>{
  const table={headers,rows:[{cells:[cell('白色',0,2),cell('S'),cell('',1),cell('',1),cell('',1),cell('',1)]},{cells:[cell('M'),cell('',1),cell('',1),cell('',1),cell('',1)]}]}
  assert.deepEqual(indexSkuRows(table).map(r=>[r.color,r.size]),[['白色','S'],['白色','M']])
  assert.throws(()=>indexSkuRows({...table,rows:table.rows.slice(0,1)}),/ROWSPAN/)
  assert.throws(()=>indexSkuRows({...table,headers:['颜色',...headers.slice(2)]}),/HEADERS/)
  const duplicate=structuredClone(table);duplicate.rows[1].cells[0].text='S'
  assert.throws(()=>indexSkuRows(duplicate),/DUPLICATE/)
  const ambiguous=structuredClone(table);ambiguous.rows[0].cells[2].inputCount=2
  assert.throws(()=>indexSkuRows(ambiguous),/INPUT/)
})
test('allows only a nonempty explicit title/code subset with unique fields',()=>{
  assert.equal(compileBasicPlan(plan).terminalAction,'stop_before_save')
  for(const invalid of [{scope:plan.scope,fields:[]},{...plan,fields:[plan.fields[0],plan.fields[0]]},{...plan,fields:[{key:'submit',value:'yes'}]},{...plan,fields:[{key:'listing.referencePrice',value:'1'}]}]) assert.throws(()=>compileBasicPlan(invalid))
})
const html=(extra='')=>`<div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品标题</label><input value="原始标题"></div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="ORIGINAL" ${extra}></div><button onclick="window.saved=true">保存草稿</button><button onclick="window.published=true">提交并上架</button>`
let browser
// Every request is intercepted; these tests cannot contact the merchant platform.
test.before(async()=>{browser=await chromium.launch({headless:true})})
test.after(async()=>{await browser?.close()})
async function fixture(content=html()) {
  const page=await browser.newPage()
  await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:content}))
  await page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add')
  return page
}
test('preflight is read-only; apply verifies both fields without saving or publishing',async()=>{
  const page=await fixture()
  try{
    assert.equal((await executeBasicPlan(page,plan)).status,'preflight_passed')
    assert.deepEqual(await page.locator('input').evaluateAll(es=>es.map(e=>e.value)),['原始标题','ORIGINAL'])
    const result=await executeBasicPlan(page,plan,{dryRun:false})
    assert.equal(result.status,'subset_verified')
    assert.deepEqual(result.observed.map(f=>f.value),plan.fields.map(f=>f.value))
    assert.equal(await page.evaluate(()=>!!window.saved || !!window.published),false)
  }finally{await page.close()}
})
test('preflights all fields before mutation and rejects disabled or ambiguous fields',async()=>{
  for(const extra of ['disabled','readonly']) {
    const page=await fixture(html(extra))
    try{await assert.rejects(()=>executeBasicPlan(page,plan,{dryRun:false}),/WRITABLE/);assert.equal(await page.locator('input').first().inputValue(),'原始标题')}finally{await page.close()}
  }
})
test('rejects wrong category and detects values changed by a page handler',async()=>{
  const wrong=await fixture(html().replace('女装/女士精品','其他类目'))
  try{await assert.rejects(()=>executeBasicPlan(wrong,plan,{dryRun:false}),/CATEGORY/)}finally{await wrong.close()}
  const page=await fixture(html('onblur="this.value=\'corrupted\'"'))
  try{await assert.rejects(()=>executeBasicPlan(page,plan,{dryRun:false}),error=>error.message.includes('MISMATCH') && error.partialResult.status==='needs_inspection')}finally{await page.close()}
})

test('indexes the real captured two-row table with color rowspan and preview column',async()=>{
  const {readFile}=await import('node:fs/promises')
  const table=JSON.parse(await readFile(new URL('./fixtures/pdd-sku-structure.json',import.meta.url),'utf8'))
  const rows=indexSkuRows(table)
  assert.deepEqual(rows.map(r=>[r.color,r.size]),[['白色','S'],['白色','M']])
  assert.equal(rows[1].fields['规格编码'].column,6)
})
