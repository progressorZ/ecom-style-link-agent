import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {compileImagePlan,loadImageFiles,validateImageDimensions} from './pdd-image-plan.mjs'
import {preflightCarousel} from './pdd-image-adapter.mjs'
let browser,dir,front,back
const input=()=>({scope:'pdd-tshirt-carousel-v1',productCode:'IMAGE-TEST',images:[{id:'front',path:front},{id:'back',path:back}]})
test.before(async()=>{
 browser=await chromium.launch({headless:true});dir=await mkdtemp(join(tmpdir(),'carousel-'));front=join(dir,'front.png');back=join(dir,'back.png')
 const p=await browser.newPage()
 for(const [path,color] of [[front,'red'],[back,'blue']]){const data=await p.evaluate(color=>{const c=document.createElement('canvas');c.width=c.height=600;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,600,600);return c.toDataURL().split(',')[1]},color);await writeFile(path,Buffer.from(data,'base64'))}
 await p.close()
})
test.after(async()=>{await browser?.close();await rm(dir,{recursive:true,force:true})})
test('validates count, format, dimensions and stable ordered hashes',async()=>{
 assert.throws(()=>compileImagePlan({...input(),images:[]}),/PLAN/)
 assert.throws(()=>compileImagePlan({...input(),images:[{id:'x',path:'x.svg'}]}),/EXTENSION/)
 for(const d of [{width:480,height:480},{width:600,height:900}])assert.throws(()=>validateImageDimensions(d))
 validateImageDimensions({width:600,height:800})
 const result=await loadImageFiles(input());assert.deepEqual(result.files.map(f=>f.id),['front','back']);assert.notEqual(result.files[0].sha256,result.files[1].sha256)
})
test('rejects duplicate bytes, missing files and masquerading extensions',async()=>{
 const copy=join(dir,'copy.png');await writeFile(copy,(await loadImageFiles(input())).files[0].buffer)
 await assert.rejects(()=>loadImageFiles({...input(),images:[{id:'a',path:front},{id:'b',path:copy}]}),/DUPLICATE_CONTENT/)
 await assert.rejects(()=>loadImageFiles({...input(),images:[{id:'a',path:join(dir,'missing.png')}]}),/ENOENT/)
 const fake=join(dir,'fake.jpg');await writeFile(fake,'not an image');await assert.rejects(()=>loadImageFiles({...input(),images:[{id:'a',path:fake}]}),/CONTENT_TYPE/)
})
async function pageFor(){const context=await browser.newContext();const p=await context.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="IMAGE-TEST"></div><div data-testid="beast-core-form-item" id="basic.carousel_gallery">图片要求：宽高比例为1:1或3:4，且宽高均大于480px，大小3M内。已上传<span id="count">0</span>/10张<input type="file" multiple accept="image/jpeg,image/png" data-tracking-click-viewid="carousel_img_localfile_upload" onchange="window.uploaded=true"></div>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('preflight decodes images without uploading or changing the merchant page',async()=>{const p=await pageFor();try{const r=await preflightCarousel(p,input());assert.equal(r.status,'carousel_preflight_passed');assert.deepEqual(r.manifest.map(f=>f.width),[600,600]);assert.equal(r.manifest[0].position,1);assert.equal(await p.evaluate(()=>!!window.uploaded),false);assert.equal(r.uploaded,false)}finally{await p.context().close()}})
test('rejects pre-existing media and wrong product identity',async()=>{for(const mode of ['count','code']){const p=await pageFor();try{await p.evaluate(mode=>{if(mode==='count')document.querySelector('#count').textContent='1';else document.querySelector('input').value='OTHER'},mode);await assert.rejects(()=>preflightCarousel(p,input()),/EXISTING_IMAGES|PRODUCT_CODE/)}finally{await p.context().close()}}})
test('rejects a header-valid but undecodable image',async()=>{const p=await pageFor();try{const path=join(dir,'broken.png');await writeFile(path,Buffer.from([137,80,78,71,13,10,26,10]));await assert.rejects(()=>preflightCarousel(p,{...input(),images:[{id:'broken',path}]}));assert.equal(await p.evaluate(()=>!!window.uploaded),false)}finally{await p.context().close()}})
test('uploads sequentially and binds each new URL to the supplied order',async()=>{
 const {executeCarousel}=await import('./pdd-image-adapter.mjs');const p=await pageFor();try{
 await p.evaluate(()=>{document.querySelector('input[type=file]').onchange=()=>{const count=document.querySelector('#count');const n=Number(count.textContent)+1;count.textContent=String(n);const e=document.createElement('div');e.className='MaterialModalButton_v2_imageBox__fixture';e.style='width:96px;height:96px;background-image:url('+ (n===1?'https://img.pddpic.com/aid-image/aid-sr/':'https://pfs.pinduoduo.com/')+n+'.jpg)';count.parentElement.append(e)}})
 const r=await executeCarousel(p,input(),{dryRun:false});assert.equal(r.status,'carousel_upload_observed');assert.deepEqual(r.completed.map(x=>x.id),['front','back']);assert.equal(r.completed[1].remoteUrl,'https://pfs.pinduoduo.com/2.jpg');assert.equal(r.contentVerified,false)
 }finally{await p.context().close()}
})
test('timeout stops without a second upload; reordering existing URLs fails',async()=>{
 const {executeCarousel}=await import('./pdd-image-adapter.mjs')
 for(const mode of ['timeout','order']){const p=await pageFor();try{
 await p.evaluate(mode=>{window.uploadCalls=0;document.querySelector('input[type=file]').onchange=()=>{window.uploadCalls++;if(mode==='timeout')return;const count=document.querySelector('#count');count.textContent=String(window.uploadCalls);const e=document.createElement('div');e.className='MaterialModalButton_v2_imageBox__fixture';e.style='width:96px;height:96px;background-image:url(https://img.pddpic.com/aid-image/aid-sr/'+window.uploadCalls+'.jpg)';count.parentElement.append(e);if(window.uploadCalls===2)document.querySelector('[class*=imageBox]').style.backgroundImage='url(https://img.pddpic.com/aid-image/aid-sr/changed.jpg)'}},mode)
 await assert.rejects(()=>executeCarousel(p,input(),{dryRun:false,timeout:300}),e=>e.partialResult.status==='needs_inspection')
 assert.equal(await p.evaluate(()=>window.uploadCalls),mode==='timeout'?1:2)
 }finally{await p.context().close()}}
})
test('waits for the main image processed URL before uploading the next file',async()=>{
 const {executeCarousel}=await import('./pdd-image-adapter.mjs');const p=await pageFor();try{
 await p.evaluate(()=>{window.calls=0;window.overlap=false;window.processing=false;document.querySelector('input[type=file]').onchange=()=>{if(window.processing)window.overlap=true;window.processing=true;const n=++window.calls;document.querySelector('#count').textContent=String(n);const e=document.createElement('div');e.className='MaterialModalButton_v2_imageBox__fixture';e.style='width:96px;height:96px;background-image:url(https://pfs.pinduoduo.com/tmp'+n+'.jpeg)';document.querySelector('#count').parentElement.append(e);setTimeout(()=>{e.style.backgroundImage='url(https://img.pddpic.com/aid-image/aid-sr/'+n+'.jpg)';window.processing=false},250)}})
 const r=await executeCarousel(p,input(),{dryRun:false,timeout:2000});assert.equal(r.completed.length,2);assert.equal(await p.evaluate(()=>window.overlap),false)
 }finally{await p.context().close()}
})

test('package media task uploads, persists receipt, and independently verifies current DOM and file bytes',async()=>{
 const {readFile}=await import('node:fs/promises')
 const {executePackageMedia}=await import('./pdd-media-task.mjs')
 const {compileProductPackage}=await import('./pdd-package-plan.mjs')
 const {verifyMediaBindings}=await import('./pdd-media-bindings.mjs')
 const {observeCarousel}=await import('./pdd-image-dom.mjs')
 const raw=JSON.parse(await readFile(new URL('../examples/product-package-tshirt.json',import.meta.url),'utf8'))
 raw.product.productCode='IMAGE-TEST';raw.assets.forEach(a=>a.sourcePath=front)
 raw.assets.push({...raw.assets[0],id:'main-back',sourcePath:back,order:1})
 const p=await pageFor(),journalRoot=join(dir,'package-journal'),shopBindings=[{platform:'pdd',shopKey:raw.listing.shopKey,shopName:'测试店铺',mallId:'123'}]
 try{
 await p.context().route('https://mobile.yangkeduo.com/**',r=>r.fulfill({body:'shop'}))
 await p.locator('body').evaluate(e=>{
  e.insertAdjacentHTML('afterbegin',`<div id="mms-header-next"><div class="user-name-name"><span class="user-name-text">测试店铺</span></div><button onclick="document.getElementById('shop-qr').style.display='block'">店铺二维码</button></div><div id="shop-qr" data-testid="beast-core-modal" style="display:none"><canvas width="40" height="40"></canvas><button onclick="window.open('https://mobile.yangkeduo.com/mall_page.html?mall_id=123')">打开网页查看店铺</button><button data-testid="beast-core-modal-icon-close" onclick="document.getElementById('shop-qr').style.display='none'">关闭</button></div>`)
  const c=document.querySelector('#shop-qr canvas').getContext('2d');c.fillStyle='white';c.fillRect(0,0,40,40);c.fillStyle='black';c.fillRect(0,0,20,20)
 })
 await p.evaluate(()=>{window.uploadCalls=0;document.querySelector('input[type=file]').onchange=()=>{window.uploadCalls++;const count=document.querySelector('#count');count.textContent=String(window.uploadCalls);const image=document.createElement('div');image.className='MaterialModalButton_v2_imageBox__fixture';image.style='width:96px;height:96px;background-image:url(https://img.pddpic.com/aid-image/aid-sr/'+window.uploadCalls+'.jpg)';count.parentElement.append(image)}})
 const preflight=await executePackageMedia(p,raw,{stepId:'carousel',journalRoot});assert.equal(preflight.uploaded,false);assert.equal(await p.evaluate(()=>window.uploadCalls),0)
 await assert.rejects(()=>executePackageMedia(p,raw,{stepId:'carousel',dryRun:false,journalRoot}),/SHOP_BINDING_REQUIRED_FOR_WRITE/)
 await assert.rejects(()=>executePackageMedia(p,raw,{stepId:'carousel',dryRun:false,journalRoot,shopBindings:[{...shopBindings[0],mallId:'456'}]}),/SHOP_IDENTITY_MISMATCH/)
 assert.equal(await p.evaluate(()=>window.uploadCalls),0)
 const task=await executePackageMedia(p,raw,{stepId:'carousel',dryRun:false,journalRoot,shopBindings})
 assert.equal(task.shopIdentity.status,'matched');assert.equal(task.shopIdentityAfter.status,'matched');assert.equal(task.status,'media_upload_recorded');assert.equal(task.receipt.entries.length,2);assert.equal(await p.evaluate(()=>window.uploadCalls),2)
 const disk=JSON.parse(await readFile(join(task.directory,'result.json'),'utf8'));assert.deepEqual(disk.receipt,task.receipt)
 const {inspectMediaJournal}=await import('./pdd-media-journal-read.mjs');const restored=await inspectMediaJournal(task.directory);assert.equal(restored.status,'recorded');assert.deepEqual(restored.receipt,disk.receipt)
 const plan=compileProductPackage(raw,{shopBindings}),step=plan.steps.find(s=>s.id==='carousel'),observed=await p.evaluate(observeCarousel)
 const result=await verifyMediaBindings({plan,step,editorUrl:p.url(),observed,receipts:[disk.receipt]});assert.equal(result.status,'references_matched');assert.equal(result.contentVerified,false)
 await assert.rejects(()=>executePackageMedia(p,raw,{stepId:'carousel',dryRun:false,journalRoot,shopBindings}),/RECONCILE_REQUIRED/);assert.equal(await p.evaluate(()=>window.uploadCalls),2)
 await p.locator('[class*=imageBox]').first().evaluate(e=>e.style.backgroundImage='url(https://img.pddpic.com/aid-image/aid-sr/replaced.jpg)')
 const changed=await verifyMediaBindings({plan,step,editorUrl:p.url(),observed:await p.evaluate(observeCarousel),receipts:[disk.receipt]});assert.equal(changed.status,'mismatch')
 // A shop change during upload leaves a claimed failed task, with completed uploads recorded.
 await p.evaluate(()=>{
  document.querySelectorAll('[class*=imageBox]').forEach(e=>e.remove());document.querySelector('#count').textContent='0';window.uploadCalls=0
  const input=document.querySelector('input[type=file]'),upload=input.onchange
  input.onchange=()=>{upload();if(window.uploadCalls===2)document.querySelector('.user-name-name .user-name-text').textContent='其他店铺'}
 })
 const failedRoot=join(dir,'changed-shop-journal')
 await assert.rejects(()=>executePackageMedia(p,raw,{stepId:'carousel',dryRun:false,journalRoot:failedRoot,shopBindings}),e=>e.message==='SHOP_IDENTITY_MISMATCH'&&e.partialResult?.completed.length===2)
 const {readdir}=await import('node:fs/promises'),[claim]=await readdir(failedRoot)
 const failed=await inspectMediaJournal(join(failedRoot,claim));assert.equal(failed.status,'needs_inspection');assert.equal(failed.retryAllowed,false);assert.equal(failed.failure.partialResult.completed.length,2)

 }finally{await p.context().close()}
})
