import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileShippingPlan,executeShipping} from './pdd-shipping-adapter.mjs'
const input={scope:'pdd-tshirt-shipping-v1',productCode:'SHIP-TEST',shipmentHours:24}
const fixture=`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="SHIP-TEST"></div><div data-testid="beast-core-form-item" id="service.shipment_limit_second">${[48,24].map(n=>`<label data-testid="beast-core-radio"><input type="radio" name="shipping" ${n===48?'checked':''}>${n}小时发货及揽收${n===24?'<span>获额外流量扶持</span>':''}</label>`).join('')}<label data-testid="beast-core-radio"><input type="radio" name="shipping">当日发货及揽收</label></div><div style="display:none"><div data-testid="beast-core-form-item" id="service.is_default_template_id"><label><input type="radio" checked>隐藏默认模板</label></div></div><button onclick="window.published=true">提交并上架</button>`
let browser
test.before(async()=>{browser=await chromium.launch({headless:true})})
test.after(async()=>{await browser.close()})
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('requires explicit supported hours and rejects unsupported freight fields',()=>{
 for(const p of [{...input,shipmentHours:0},{...input,shipmentHours:'24'},{...input,freightTemplate:'default'}])assert.throws(()=>compileShippingPlan(p),/SHIPPING_/)
})
test('preflight is read-only; writes and reuses checked radio without verifying hidden freight',async()=>{const p=await pageFor();try{
 const before=await executeShipping(p,input);assert.equal(before.before.selected,'48小时发货及揽收');assert.equal(before.before.freight.status,'hidden_unverified')
 const r=await executeShipping(p,input,{dryRun:false});assert.equal(r.status,'shipping_subset_verified');assert.equal(r.changed,true);assert.equal(r.observed.freight.verified,false)
 assert.equal((await executeShipping(p,input,{dryRun:false})).changed,false)
 assert.equal(await p.evaluate(()=>!!window.published),false)
 }finally{await p.close()}})
test('disabled target, duplicate labels, hidden shipping and wrong identity stop',async()=>{
 for(const mode of ['disabled','duplicate','hidden','product']){const p=await pageFor();try{await p.evaluate(mode=>{const root=document.getElementById('service.shipment_limit_second');if(mode==='disabled')root.querySelectorAll('input')[1].disabled=true;if(mode==='duplicate')root.append(root.children[1].cloneNode(true));if(mode==='hidden')root.style.display='none';if(mode==='product')document.querySelector('input').value='OTHER'},mode);await assert.rejects(()=>executeShipping(p,input,{dryRun:false}),/SHIPPING_|PRODUCT_CODE/)}finally{await p.close()}}
})
test('page handler reverting the selection is detected',async()=>{const p=await pageFor();try{
 await p.evaluate(()=>{const radios=document.getElementById('service.shipment_limit_second').querySelectorAll('input');radios[1].onchange=()=>radios[0].checked=true})
 await assert.rejects(()=>executeShipping(p,input,{dryRun:false}),e=>e.partialResult.status==='needs_inspection')
 }finally{await p.close()}})
