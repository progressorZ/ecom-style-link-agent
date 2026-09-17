import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileDetailPlan,uploadPreparedDetail} from './pdd-detail-adapter.mjs'
const plan=compileDetailPlan({scope:'pdd-tshirt-detail-images-v1',productCode:'DETAIL-TEST',images:[{id:'front',path:'front.png'},{id:'back',path:'back.png'}]})
const files=plan.assets.images.map(i=>({...i,name:i.path,mime:'image/png',buffer:Buffer.from('fixture'),sha256:i.id}))
function setup(){
 window.uploadCalls=0
 const input=document.querySelector('input[type=file]')
 input.onchange=()=>{
 const n=++window.uploadCalls
 if(window.mode==='timeout')return
 const card=document.createElement('div');card.className='quick_decoration_v2_remarkImage__test'
 const image=document.createElement('img');image.dataset.trackingClickViewid='el_preview_business_details';image.src='https://pfs.pinduoduo.com/'+n+'.png'
 const label=document.createElement('div');label.className='ImageWithRemark_v2_remark__test';label.textContent=n
 card.append(image,label);document.querySelector('#cards').append(card);document.querySelector('#count').textContent=n;document.querySelector('#empty').textContent=''
 if(window.mode==='wrong-order')label.textContent='9'
 if(window.mode==='corrupt'&&n===2)document.querySelector('#cards img').src='https://pfs.pinduoduo.com/changed.png'
 }
}
function fixture(){return `<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="DETAIL-TEST"></div><div class="quick-decoration-container-v2"><div id="empty">暂未编辑商详</div><div class="quick_decoration_v2_sortableWrapper__test">已上传<span id="count">0</span>/50张<input type="file" accept="image/jpeg,image/png" multiple data-tracking-click-viewid="detail_img_localfile_upload"><div id="cards"></div></div></div><script>(${setup.toString()})()</script>`}
let browser,png
test.before(async()=>{browser=await chromium.launch({headless:true});const p=await browser.newPage();png=Buffer.from(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=10;return c.toDataURL().split(',')[1]}),'base64');await p.close()})
test.after(async()=>{await browser.close()})
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.request().url().startsWith('https://pfs.pinduoduo.com/')?r.fulfill({contentType:'image/png',body:png}):r.fulfill({contentType:'text/html; charset=utf-8',body:fixture()}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('preflight never uploads; sequential uploads verify loaded images and numbered order',async()=>{const p=await pageFor();try{
 assert.equal((await uploadPreparedDetail(p,plan,files)).status,'detail_images_preflight_passed');assert.equal(await p.evaluate(()=>window.uploadCalls),0)
 const r=await uploadPreparedDetail(p,plan,files,{dryRun:false});assert.equal(r.status,'detail_images_upload_observed');assert.deepEqual(r.completed.map(c=>c.id),['front','back']);assert.ok(r.observed.images.every(i=>i.loaded));assert.equal(r.contentVerified,false)
 }finally{await p.close()}})
test('refuses custom decoration, existing images and wrong product before upload',async()=>{
 for(const mode of ['custom','existing','product']){const p=await pageFor();try{
 await p.evaluate(mode=>{if(mode==='custom')document.querySelector('#empty').remove();if(mode==='existing')document.querySelector('#count').textContent='1';if(mode==='product')document.querySelector('input').value='OTHER'},mode)
 await assert.rejects(()=>uploadPreparedDetail(p,plan,files,{dryRun:false}),/EXISTING_CONTENT|PRODUCT_CODE/)
 assert.equal(await p.evaluate(()=>window.uploadCalls),0)
 }finally{await p.close()}}
})
test('wrong numbering, changed earlier image and timeout stop without retrying',async()=>{
 for(const mode of ['wrong-order','corrupt','timeout']){const p=await pageFor();try{
 await p.evaluate(mode=>window.mode=mode,mode)
 await assert.rejects(()=>uploadPreparedDetail(p,plan,files,{dryRun:false,timeout:500}),e=>e.partialResult.status==='needs_inspection')
 assert.equal(await p.evaluate(()=>window.uploadCalls),mode==='corrupt'?2:1)
 }finally{await p.close()}}
})
test('broken thumbnail cannot be reported as a completed upload',async()=>{
 const p=await pageFor();try{await p.route('https://pfs.pinduoduo.com/**',r=>r.abort());await assert.rejects(()=>uploadPreparedDetail(p,plan,files,{dryRun:false,timeout:500}),/TIMEOUT/)}finally{await p.close()}
})
test('waits for a transient empty card without retrying the upload',async()=>{
 const p=await pageFor();try{
 await p.evaluate(()=>{const input=document.querySelector('input[type=file]');input.onchange=()=>{const n=++window.uploadCalls;const card=document.createElement('div');card.className='quick_decoration_v2_remarkImage__test';document.querySelector('#cards').append(card);document.querySelector('#count').textContent=n;document.querySelector('#empty').textContent='';setTimeout(()=>{const image=document.createElement('img');image.dataset.trackingClickViewid='el_preview_business_details';image.src='https://pfs.pinduoduo.com/'+n+'.png';const label=document.createElement('div');label.className='ImageWithRemark_v2_remark__test';label.textContent=n;card.append(image,label)},200)}})
 const r=await uploadPreparedDetail(p,plan,files,{dryRun:false,timeout:2000});assert.equal(r.completed.length,2);assert.equal(await p.evaluate(()=>window.uploadCalls),2)
 }finally{await p.close()}
})
