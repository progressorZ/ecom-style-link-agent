import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {chromium} from '@playwright/test'
import {readbackProductPackage} from './pdd-readback.mjs'
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/product-package-tshirt.json',import.meta.url)))
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input id="code" value="AUTO-PACKAGE-TEST"></div><div data-testid="beast-core-form-item"><label>商品标题</label><input id="title" value="旧标题"></div>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('reads current DOM differences, preserves unreadable and uncovered, never mutates',async()=>{const p=await pageFor();try{
 const before=await p.content(),a=await readbackProductPackage(p,fixture())
 assert.equal(a.checks.find(c=>c.id==='listing.title').observed,'旧标题');assert.equal(a.counts.mismatch,1)
 assert.ok(a.counts.unreadable>0);assert.equal(a.counts.uncovered,0);assert.equal(a.fullProductVerified,false);assert.equal(await p.content(),before)
 await p.locator('#title').fill(fixture().listing.title)
 const b=await readbackProductPackage(p,fixture());assert.equal(b.checks.find(c=>c.id==='listing.title').status,'matched');assert.equal(b.status,'incomplete');assert.equal(a.sourceHash,b.sourceHash)
 }finally{await p.close()}})
test('wrong identity or open dropdown aborts rather than returning usable report',async()=>{const p=await pageFor();try{await p.locator('#code').fill('OTHER');await assert.rejects(()=>readbackProductPackage(p,fixture()),/PRODUCT_CODE_MISMATCH/);await p.locator('#code').fill('AUTO-PACKAGE-TEST');await p.evaluate(()=>{const x=document.createElement('div');x.setAttribute('role','listbox');x.textContent='选项';document.body.append(x)});await assert.rejects(()=>readbackProductPackage(p,fixture()),/READBACK_CLOSE_POPUP/)}finally{await p.close()}})

const sizeHtml=`<div data-testid="beast-core-form-item" id="newSpec">${['肩宽(cm)','胸围(cm)'].map(c=>`<label data-testid="beast-core-checkbox"><input type="checkbox" checked>${c}</label>`).join('')}<div data-testid="beast-core-table"><div data-testid="beast-core-table-middle-header"><table><thead><tr>${['尺码','肩宽(cm)','胸围(cm)','操作'].map(c=>'<th>'+c+'</th>').join('')}</tr></thead></table></div><div data-testid="beast-core-table-middle-body"><table><tbody><tr><td>M</td><td><input value="38.5"></td><td><input value="90"></td><td>操作</td></tr><tr><td>S</td><td><input value="37.5"></td><td><input value="86"></td><td>操作</td></tr></tbody></table></div></div></div>`
test('independent size readback uses row identity and detects half-centimeter mismatch',async()=>{
 const p=await pageFor();try{
 await p.locator('body').evaluate((e,html)=>e.insertAdjacentHTML('beforeend',html),sizeHtml)
 const before=await p.content(),report=await readbackProductPackage(p,fixture()),size=report.checks.find(c=>c.id==='sizeChart')
 assert.equal(size.status,'mismatch');assert.equal(size.observed.rows[0].size,'S');assert.equal(size.observed.rows[0].values['肩宽(cm)'],37.5)
 assert.equal(size.expected.rows[0].values['肩宽(cm)'],37);assert.equal(await p.content(),before)
 const input=fixture();input.sizeCharts[0].rows[0].values.shoulderWidth=37.5;input.sizeCharts[0].rows[1].values.shoulderWidth=38.5
 assert.equal((await readbackProductPackage(p,input)).checks.find(c=>c.id==='sizeChart').status,'matched')
 await p.locator('#newSpec tbody tr').first().evaluate(e=>e.remove())
 assert.equal((await readbackProductPackage(p,input)).checks.find(c=>c.id==='sizeChart').status,'unreadable')
 }finally{await p.close()}
})

test('blocking modal prevents a composite report from being issued',async()=>{const p=await pageFor();try{await p.locator('body').evaluate(e=>e.insertAdjacentHTML('beforeend','<div data-testid="beast-core-modal">建议刷新</div>'));await assert.rejects(()=>readbackProductPackage(p,fixture()),/READBACK_BLOCKING_MODAL/)}finally{await p.close()}})

test('configured shop mismatch prevents full-form report before other fields are read',async()=>{
 const p=await pageFor();try{
  await p.locator('body').evaluate(e=>e.insertAdjacentHTML('afterbegin','<div id="mms-header-next"><div class="user-name-name"><span class="user-name-text">其他店铺</span></div></div>'))
  const input=fixture(),before=await p.content()
  await assert.rejects(()=>readbackProductPackage(p,input,{shopBindings:[{platform:'pdd',shopKey:input.listing.shopKey,mallId:'123',shopName:'目标店铺'}]}),/SHOP_IDENTITY_MISMATCH/)
  assert.equal(await p.content(),before)
 }finally{await p.close()}
})
