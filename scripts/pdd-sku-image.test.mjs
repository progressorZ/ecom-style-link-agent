import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileSkuImagePlan,executePreparedSkuImages} from './pdd-sku-image-adapter.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
const input={scope:'pdd-tshirt-sku-images-v1',productCode:'IMAGE-TEST',images:[{id:'white',path:'white.png'}],bindings:[{color:'白色',size:'S',imageId:'white'},{color:'白色',size:'M',imageId:'white'}]}
const files=[{id:'white',name:'white.png',mime:'image/png',buffer:Buffer.from('fixture'),sha256:'test'}]
const imageCell='<td><div class="goods-sku-img"><input type="file" accept="image/jpeg,image/png" multiple></div></td>'
function fixture(){return `<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="IMAGE-TEST"></div><div data-testid="beast-core-form-item" id="sku"><input type="file" id="bulk"><table><thead><tr>${['颜色分类','尺码','库存','拼单价(元)','单买价(元)','预览图','规格编码','状态'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${['S','M'].map((s,i)=>`<tr>${i?'':'<td rowspan="2">白色</td>'}<td>${s}</td><td><input value="1"></td><td><input value="1000"></td><td><input value="1001"></td>${imageCell}<td><input value="SKU-${s}"></td><td><button data-testid="beast-core-switch">已启用</button></td></tr>`).join('')}</tbody></table></div><script>document.querySelector('#bulk').onchange=()=>window.bulkUploaded=true;for(const input of document.querySelectorAll('tbody input[type=file]'))input.onchange=()=>{const box=input.parentElement;const e=document.createElement('span');e.dataset.trackingClickViewid='el_specification_batch_modification_preview_picture';e.style.backgroundImage='url(https://pfs.pinduoduo.com/'+box.closest('tr').querySelectorAll('input')[3].value+'.jpg)';box.replaceChildren(e)}</script>`}
let browser
test.before(async()=>{browser=await chromium.launch({headless:true})})
test.after(async()=>{await browser.close()})
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture()}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
const observe=p=>p.evaluate(resolveSkuDom,{includeImages:true})
test('explicit bindings permit shared assets but reject duplicate rows and unused assets',()=>{
 assert.equal(compileSkuImagePlan(input).bindings.length,2)
 assert.throws(()=>compileSkuImagePlan({...input,bindings:[input.bindings[0],input.bindings[0]]}),/BINDING/)
 assert.throws(()=>compileSkuImagePlan({...input,images:[...input.images,{id:'unused',path:'u.png'}]}),/UNUSED/)
})
test('rowspan color mapping uploads both rows without touching bulk upload or SKU values',async()=>{
 const p=await pageFor();try{const before=await observe(p),plan=compileSkuImagePlan(input)
 assert.equal((await executePreparedSkuImages(p,plan,files,before)).status,'sku_images_preflight_passed')
 assert.equal(await p.locator('tbody input[type=file]').count(),2)
 const r=await executePreparedSkuImages(p,plan,files,before,{dryRun:false});assert.equal(r.completed.length,2);assert.equal(r.skuValuesUnchanged,true);assert.equal(await p.evaluate(()=>!!window.bulkUploaded),false)
 }finally{await p.close()}
})
test('stops when upload modifies another row image or price',async()=>{
 for(const mode of ['image','price']){const p=await pageFor();try{const before=await observe(p);await p.evaluate(mode=>{const input=document.querySelector('tbody input[type=file]'),original=input.onchange;input.onchange=()=>{original();const second=document.querySelectorAll('tbody tr')[1];if(mode==='price')second.querySelector('input').value='999';else{const e=document.createElement('span');e.dataset.trackingClickViewid='el_specification_batch_modification_preview_picture';e.style.backgroundImage='url(https://pfs.pinduoduo.com/unexpected.jpg)';second.querySelector('.goods-sku-img').replaceChildren(e)}}},mode)
 await assert.rejects(()=>executePreparedSkuImages(p,compileSkuImagePlan(input),files,before,{dryRun:false}),e=>e.partialResult.status==='needs_inspection')
 }finally{await p.close()}}
})
test('rejects occupied target and shared preview cells before upload',async()=>{
 for(const mode of ['existing','shared']){const p=await pageFor();try{await p.evaluate(mode=>{const box=document.querySelector('.goods-sku-img');if(mode==='shared')box.parentElement.rowSpan=2;else{const e=document.createElement('span');e.dataset.trackingClickViewid='el_specification_batch_modification_preview_picture';e.style.backgroundImage='url(https://pfs.pinduoduo.com/existing.jpg)';box.replaceChildren(e)}},mode)
 await assert.rejects(async()=>executePreparedSkuImages(p,compileSkuImagePlan(input),files,await observe(p),{dryRun:false}),/SKU_/)
 }finally{await p.close()}}
})
test('timeout performs only one upload attempt',async()=>{
 const p=await pageFor();try{const before=await observe(p);await p.evaluate(()=>{window.calls=0;for(const i of document.querySelectorAll('tbody input[type=file]'))i.onchange=()=>window.calls++})
 await assert.rejects(()=>executePreparedSkuImages(p,compileSkuImagePlan(input),files,before,{dryRun:false,timeout:250}),/TIMEOUT/);assert.equal(await p.evaluate(()=>window.calls),1)
 }finally{await p.close()}
})
test('semantic image targets survive reversed rows after each upload',async()=>{
 const p=await pageFor();try{
 await p.evaluate(()=>{const trs=[...document.querySelectorAll('tbody tr')];trs[0].cells[0].rowSpan=1;const color=document.createElement('td');color.textContent='白色';trs[1].prepend(color);for(const i of document.querySelectorAll('tbody input[type=file]')){const original=i.onchange;i.onchange=()=>{original();const body=document.querySelector('tbody');body.prepend(body.lastElementChild)}}})
 const before=await observe(p);const r=await executePreparedSkuImages(p,compileSkuImagePlan(input),files,before,{dryRun:false});assert.deepEqual(r.completed.map(c=>c.key),['["白色","S"]','["白色","M"]'])
 }finally{await p.close()}
})
