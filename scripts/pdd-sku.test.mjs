import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { compileSkuPlan,executeSkuPlan,parseMoney,moneyText } from './pdd-sku-adapter.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
const variants=[{color:'白色',size:'S',stock:1,groupPriceMinor:12929,singlePriceMinor:13900,merchantSku:'TEST-S',enabled:true},{color:'白色',size:'M',stock:2,groupPriceMinor:14000,singlePriceMinor:15000,merchantSku:'TEST-M',enabled:true}]
const plan={scope:'pdd-tshirt-sku-v1',productCode:'TEST-001',variants}
const url='https://mms.pinduoduo.com/goods/goods_add/index?type=add'
const headers=['颜色分类','尺码','库存','拼单价(元)','单买价(元)','预览图','规格编码','状态']
function html({merged=false,disabledM=false,blur='',reverseColumns=false}={}){
  const names=reverseColumns?[...headers].reverse():headers
  const rows=variants.map((v,i)=>{
    const disabled=disabledM&&i===1
    const cells={颜色分类:merged&&i===1?'':`<td ${merged?'rowspan="2"':''}>白色</td>`,尺码:`<td>${v.size}</td>`,库存:`<td><input data-field="stock" ${disabled?'disabled value="0"':''} onblur="${blur}"></td>`,'拼单价(元)':`<td><input data-field="groupPriceMinor" onblur="${blur}"></td>`,'单买价(元)':`<td><input data-field="singlePriceMinor" onblur="${blur}"></td>`,预览图:'<td>本地上传<input type="file" style="display:none"></td>',规格编码:`<td><input data-field="merchantSku" onblur="${blur}"></td>`,状态:`<td><span class="sku-status-word">${disabled?'已停用':'已启用'}</span><div style="width:20px;height:20px;background:#ccc" data-testid="beast-core-switch" onclick="const r=this.closest('tr'),s=r.querySelector('.sku-status-word'),i=r.querySelector('[data-field=stock]');const off=s.textContent==='已启用';s.textContent=off?'已停用':'已启用';i.disabled=off;if(off)i.value='0'"></div></td>`}
    return `<tr data-size="${v.size}">${names.map(n=>cells[n]).join('')}</tr>`
  }).join('')
  return `<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="TEST-001"></div><div data-testid="beast-core-form-item" id="sku"><div id="sku"><input id="bulk" value="UNCHANGED"><table><thead><tr>${names.map(n=>`<th>${n}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div><button onclick="window.saved=true">保存草稿</button><button onclick="window.published=true">提交并上架</button>`
}
let browser
test.before(async()=>{browser=await chromium.launch({headless:true})})
test.after(async()=>{await browser?.close()})
async function pageFor(options){const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html(options)}));await page.goto(url);return page}

test('money and plan validation preserve cents, unknown stock and uniqueness',()=>{
  assert.equal(moneyText(12929),'129.29');assert.equal(parseMoney('0.29'),29);assert.equal(parseMoney('129.00'),12900)
  for(const raw of ['', '1.001','NaN','-1','1e3','9007199254740992'])assert.equal(parseMoney(raw),null)
  for(const patch of [{stock:''},{stock:null},{groupPriceMinor:1.1},{singlePriceMinor:1},{enabled:false,stock:2},{merchantSku:'TEST-M'}])assert.throws(()=>compileSkuPlan({...plan,variants:[{...variants[0],...patch},variants[1]]}))
  assert.throws(()=>compileSkuPlan({...plan,variants:[variants[0],variants[0]]}))
})
test('preflight does not mutate; merged color rows fill correctly without touching bulk or publish',async()=>{
  const page=await pageFor({merged:true})
  try{
    assert.equal((await executeSkuPlan(page,plan)).status,'preflight_passed')
    assert.equal(await page.locator('[data-field=stock]').first().inputValue(),'')
    const result=await executeSkuPlan(page,plan,{dryRun:false})
    assert.equal(result.status,'sku_subset_verified');assert.deepEqual(result.differences,[])
    assert.equal(await page.locator('#bulk').inputValue(),'UNCHANGED')
    assert.equal(await page.evaluate(()=>!!window.saved||!!window.published),false)
  }finally{await page.close()}
})
test('fresh business-key resolution survives reordered columns and rerendered/reordered rows',async()=>{
  const page=await pageFor({reverseColumns:true,blur:"const b=this.closest('tbody');b.appendChild(b.firstElementChild);b.innerHTML=b.innerHTML"})
  // innerHTML would drop live input properties; emulate framework rerender preserving current values.
  await page.locator('tbody input').evaluateAll(inputs=>inputs.forEach(i=>i.setAttribute('onblur',"const b=this.closest('tbody');b.querySelectorAll('input').forEach(e=>e.setAttribute('value',e.value));b.appendChild(b.firstElementChild);b.innerHTML=b.innerHTML")))
  try{assert.equal((await executeSkuPlan(page,plan,{dryRun:false})).status,'sku_subset_verified')}finally{await page.close()}
})
test('rejects missing, extra, duplicate and hidden rows before any input is changed',async()=>{
  for(const mutate of [p=>p.locator('tbody tr').last().evaluate(r=>r.remove()),p=>p.locator('tbody').evaluate(b=>b.appendChild(b.firstElementChild.cloneNode(true))),p=>p.locator('tbody tr').last().evaluate(r=>r.style.display='none')]){
    const page=await pageFor()
    try{await mutate(page);await assert.rejects(()=>executeSkuPlan(page,plan,{dryRun:false}));assert.equal(await page.locator('[data-field=stock]').first().inputValue(),'')}finally{await page.close()}
  }
})
test('rejects wrong product code and a locked late field before mutations',async()=>{
  for(const mutate of [p=>p.locator('label + input').fill('OTHER'),p=>p.locator('[data-field=merchantSku]').last().evaluate(e=>e.readOnly=true)]){
    const page=await pageFor();try{await mutate(page);await assert.rejects(()=>executeSkuPlan(page,plan,{dryRun:false}));assert.equal(await page.locator('[data-field=stock]').first().inputValue(),'')}finally{await page.close()}
  }
})
test('enables before setting stock and disables only after filling with confirmed zero stock',async()=>{
  const page=await pageFor({disabledM:true})
  try{
    assert.equal((await executeSkuPlan(page,plan,{dryRun:false})).status,'sku_subset_verified')
    const disabled={...plan,variants:[variants[0],{...variants[1],enabled:false,stock:0}]}
    assert.equal((await executeSkuPlan(page,disabled,{dryRun:false})).status,'sku_subset_verified')
    assert.equal((await executeSkuPlan(page,disabled,{dryRun:false})).status,'sku_subset_verified')
    const rows=await page.evaluate(resolveSkuDom);assert.equal(rows[1].values.enabled,false);assert.equal(rows[1].values.stock,'0')
  }finally{await page.close()}
})
test('detects normalized amounts and later handlers corrupting previously filled values',async()=>{
  const page=await pageFor({blur:"if(this.dataset.field==='groupPriceMinor')this.closest('tr').querySelector('[data-field=stock]').value='999'"})
  try{await assert.rejects(()=>executeSkuPlan(page,plan,{dryRun:false}),e=>e.message==='SKU_FINAL_READBACK_MISMATCH'&&e.partialResult.differences.some(d=>d.field==='stock'))}finally{await page.close()}
})

test('compiles unified ProductPackage by variant ID without expanding a Cartesian product',async()=>{
  const {compileSkuPlanFromPackage}=await import('./pdd-sku-adapter.mjs')
  const pkg={schemaVersion:'0.1',product:{categoryKey:'womenswear.tshirt',productCode:plan.productCode},variants:variants.map((v,i)=>({id:'v'+i,colorLabel:v.color,sizeLabel:v.size,merchantSku:v.merchantSku})),listing:{platform:'pdd',offers:variants.map((v,i)=>({variantId:'v'+i,stock:v.stock,enabled:v.enabled,prices:[{role:'sale',amountMinor:v.groupPriceMinor,currency:'CNY'},{role:'platform:pdd.single',amountMinor:v.singlePriceMinor,currency:'CNY'}]})).reverse()}}
  const compiled=compileSkuPlanFromPackage(pkg)
  assert.deepEqual(compiled.variants.map(v=>v.stock),[1,2])
  assert.equal(compiled.variants.length,2)
  assert.throws(()=>compileSkuPlanFromPackage({...pkg,product:{...pkg.product,categoryKey:'womenswear.dress'}}))
  assert.throws(()=>compileSkuPlanFromPackage({...pkg,listing:{...pkg.listing,offers:pkg.listing.offers.slice(1)}}))
})
