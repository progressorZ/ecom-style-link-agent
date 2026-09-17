import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compilePricingPlan,executePricing} from './pdd-pricing.mjs'
const plan={scope:'pdd-tshirt-pricing-v1',productCode:'PRICE-TEST',referenceAmountMinor:15001,multiItemDiscount:{count:2,discount:9.4},variants:[{color:'白色',size:'S',stock:1,groupPriceMinor:12900,singlePriceMinor:13900,merchantSku:'TEST-S',enabled:true}]}
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="PRICE-TEST"></div><div data-testid="beast-core-form-item" id="sku"><table><thead><tr>${['颜色分类','尺码','库存','拼单价(元)','单买价(元)','规格编码','状态'].map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody><tr><td>白色</td><td>S</td><td><input value="1"></td><td><input value="129.00"></td><td><input value="139.00"></td><td><input value="TEST-S"></td><td><span class="sku-status-word">已启用</span><div data-testid="beast-core-switch" style="height:20px;width:20px"></div></td></tr></tbody></table></div><div data-testid="beast-core-form-item"><label>商品参考价</label><input id="reference" placeholder="应大于商品最大单买价" value="150"></div><div data-testid="beast-core-form-item"><label>满件折扣</label><span id="count">满2件</span><input id="discount" placeholder="5.0~9.9" value="9.5"></div><button onclick="window.published=true">提交并上架</button>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('validates cents, reference relation, fixed count and supported discount precision',()=>{
 for(const patch of [{referenceAmountMinor:13900},{referenceAmountMinor:15000.1},{multiItemDiscount:{count:3,discount:9.5}},{multiItemDiscount:{count:2,discount:9.95}},{multiItemDiscount:{count:2,discount:'9.5'}}])assert.throws(()=>compilePricingPlan({...plan,...patch}))
 assert.equal(compilePricingPlan(plan).referenceAmountMinor,15001)
})
test('preflight unchanged; native price and discount readback preserves SKU',async()=>{const p=await pageFor();try{assert.equal((await executePricing(p,plan)).status,'pricing_preflight');assert.equal(await p.locator('#reference').inputValue(),'150');const result=await executePricing(p,plan,{dryRun:false});assert.equal(result.status,'pricing_subset_verified');assert.equal(result.observed.pricing.referenceAmountMinor,'150.01');assert.equal(await p.evaluate(()=>!!window.published),false)}finally{await p.close()}})
test('wrong SKU, count or locked discount blocks before any price write',async()=>{
 for(const change of [p=>p.locator('#count').evaluate(e=>e.textContent='满3件'),p=>p.locator('#discount').evaluate(e=>e.readOnly=true),p=>p.locator('tbody input').first().fill('2')]){const p=await pageFor();try{await change(p);await assert.rejects(()=>executePricing(p,plan,{dryRun:false}));assert.equal(await p.locator('#reference').inputValue(),'150')}finally{await p.close()}}
})
test('platform rewriting discount after blur is rejected',async()=>{const p=await pageFor();try{await p.locator('#discount').evaluate(e=>e.onblur=()=>e.value='9.9');await assert.rejects(()=>executePricing(p,plan,{dryRun:false}),/PRICING_READBACK_MISMATCH/)}finally{await p.close()}})

test('saved draft summary is read-only and does not weaken execution control checks',async()=>{
 const {resolvePricingDom}=await import('./pdd-pricing.mjs'),p=await pageFor();try{
 await p.locator('#discount').evaluate(e=>{e.parentElement.innerHTML='<label>满件折扣</label><span class="price-text">满2件 9.4 折<span class="edit">修改</span></span>'})
 const read=await p.evaluate(resolvePricingDom,{allowSummary:true});assert.equal(read.discount,'9.4');assert.equal(read.count,2)
 await assert.rejects(()=>executePricing(p,plan,{dryRun:false}),/PRICING_CONTROL_UNSUPPORTED/);assert.equal(await p.locator('#reference').inputValue(),'150')
 await p.locator('.price-text').evaluate(e=>e.after(e.cloneNode(true)));await assert.rejects(()=>p.evaluate(resolvePricingDom,{allowSummary:true}),/SUMMARY/)
 }finally{await p.close()}
})
