import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {chromium} from '@playwright/test'
import {compileServicesPlan,verifyServices} from './pdd-services.mjs'
import {compileProductPackage} from './pdd-package-plan.mjs'
const plan=JSON.parse(readFileSync(new URL('../examples/pdd-services-smoke.json',import.meta.url)))
const check=(label,checked=false,disabled=false)=>`<label data-testid="beast-core-checkbox"><input type="checkbox" ${checked?'checked':''} ${disabled?'disabled':''}>${label}</label>`
const radio=(id,label,value)=>`<div data-testid="beast-core-form-item" id="${id}"><label>${label}</label><label data-testid="beast-core-radio"><input type="radio" checked>${value}</label></div>`
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input id="code" value="${plan.productCode}"></div><main>${radio('service.goods_type','商品类型','普通商品')}${radio('service.second_hand','是否二手','非二手')}${radio('service.is_customized','是否定制','非定制')}${radio('service.is_pre_sale','是否预售','非预售')}<div data-testid="beast-core-form-item" id="service.support_promise_delivery">${check('周边区域提前至当天发货及揽收，享发货享时效权益推荐')}</div>${check('7天无理由退货',true,true)}${check('假一赔十')}<div id="goods_pattern"><div class="pattern-left">库存扣减方式</div><div class="pattern-right">支付成功减库存</div></div><div data-testid="beast-core-form-item"><label>拼单人数</label><div>2</div></div></main>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('requires explicit complete normal-stock service configuration',()=>{
 for(const patch of [{presale:'定时预售'},{sevenDayReturns:false},{nearbySameDay:undefined},{groupSize:3},{unknown:false}])assert.throws(()=>compileServicesPlan({...plan,expected:{...plan.expected,...patch}}),/SERVICES_PLAN_INVALID/)
})
test('reads native checked properties and disabled mandatory return policy without mutation',async()=>{const p=await pageFor();try{const before=await p.content(),r=await verifyServices(p,plan);assert.equal(r.status,'services_subset_verified');assert.equal(r.observed.controls.sevenDayReturns.disabled,true);assert.equal(await p.content(),before);assert.equal(r.fullProductVerified,false)}finally{await p.close()}})
test('reports unexpected optional promise without silently turning it off',async()=>{const p=await pageFor();try{await p.getByLabel('假一赔十',{exact:true}).check();const r=await verifyServices(p,plan);assert.equal(r.status,'services_mismatch');assert.deepEqual(r.differences,[{field:'authenticityPromise',expected:false,observed:true}]);assert.equal(await p.getByLabel('假一赔十',{exact:true}).isChecked(),true)}finally{await p.close()}})
test('hidden, ambiguous or wrong-product page cannot pass',async()=>{
 for(const change of [p=>p.locator('main').evaluate(e=>e.hidden=true),p=>p.locator('#goods_pattern').evaluate(e=>e.after(e.cloneNode(true))),p=>p.locator('#code').fill('OTHER')]){const p=await pageFor();try{await change(p);await assert.rejects(()=>verifyServices(p,plan))}finally{await p.close()}}
})
test('package adds explicit service verification and retains live blockers',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../examples/product-package-tshirt.json',import.meta.url)))
 const {inventoryDeduction,...services}=plan.expected;pkg.listing.services=services
 const result=compileProductPackage(pkg);assert.equal(result.steps.find(s=>s.id==='services').input.expected.inventoryDeduction,inventoryDeduction)
 assert.ok(result.blockers.some(b=>b.reason==='services_live_readback_required'));assert.equal(result.executable,false)
 delete pkg.listing.services.nearbySameDay;assert.throws(()=>compileProductPackage(pkg),/SERVICES_PLAN_INVALID/)
})
