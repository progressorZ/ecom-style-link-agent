import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveServer} from './live-server.mjs'
const input=JSON.parse(await readFile(new URL('../examples/product-package-tshirt.json',import.meta.url)))
const options={shopBindings:[{platform:'pdd',shopKey:input.listing.shopKey,shopName:'测试店铺',mallId:'123'}]}
async function setup(extra={}){
 const root=await mkdtemp(join(tmpdir(),'live-api-'));let url='about:blank'
 const page={isClosed:()=>false,url:()=>url,goto:async target=>{url=target}}
 const browser={pages:()=>[page],on:()=>{},close:async()=>{}}
 const app=createLiveServer({root,launch:async()=>browser,...extra});await app.ready;await new Promise(r=>app.server.listen(0,'127.0.0.1',r))
 const base='http://127.0.0.1:'+app.server.address().port
 const post=(path,body,origin='http://127.0.0.1:5173')=>fetch(base+'/api/live/'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})
 return {root,app,page,post,state:async()=>await(await fetch(base+'/api/live/state')).json(),cleanup:async()=>{await app.close();await rm(root,{recursive:true,force:true})}}
}
test('API rejects cross-origin mutations, invalid packages and all publish requests',async()=>{const f=await setup();try{
 assert.equal((await f.post('package',{input,options},'https://untrusted.test')).status,403)
 assert.equal((await f.post('package',{input,options:{}})).status,400)
 assert.equal((await f.post('jobs',{action:'publish'})).status,400)
 assert.equal((await f.state()).loaded,null)
}finally{await f.cleanup()}})
test('backup API exports and restores local business data with restart gate',async()=>{const f=await setup();try{await writeFile(join(f.root,'settings.json'),JSON.stringify({shopKey:'before'}));const backup=await(await fetch('http://127.0.0.1:'+f.app.server.address().port+'/api/live/backup')).json();assert.equal(backup.format,'ecom-workbench-backup');await writeFile(join(f.root,'settings.json'),JSON.stringify({shopKey:'changed'}));const restored=await f.post('restore',{backup,confirmed:true});assert.equal(restored.status,200);assert.equal((await restored.json()).restartRequired,true);assert.equal((await f.state()).restartRequired,true);assert.equal((await f.post('next-product-code',{})).status,409);assert.equal(JSON.parse(await readFile(join(f.root,'settings.json'),'utf8')).shopKey,'before')}finally{await f.cleanup()}})
test('real-workflow dispatch is exclusive, source-bound and persisted without inventing published status',async()=>{
 let release,called=0;const gate=new Promise(r=>release=r)
 const f=await setup({run:async(page,source,config,args)=>{called++;assert.equal(source.product.id,input.product.id);assert.equal(config.shopBindings[0].mallId,'123');assert.equal(args.action,'inspect');args.onProgress({step:'readback'});await gate;return {status:'inspected',saved:false,published:false,report:{counts:{matched:1}}}}})
 try{
 assert.equal((await f.post('package',{input,options})).status,200)
 await f.post('browser',{});await f.page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add')
 const pageId=(await f.state()).pages[0].id
 const start=await f.post('jobs',{action:'inspect',pageId});assert.equal(start.status,202);const {job}=await start.json()
 assert.equal((await f.post('jobs',{action:'fill',pageId})).status,409)
 assert.equal((await f.post('package',{input,options})).status,409)
 release();for(let i=0;i<100&&(await f.state()).busy;i++)await new Promise(r=>setTimeout(r,10))
 const done=(await f.state()).jobs[0];assert.equal(done.status,'completed');assert.equal(done.result.published,false);assert.equal(called,1)
 const disk=JSON.parse(await readFile(join(f.root,job.id+'.json')));assert.equal(disk.status,'completed');assert.equal(disk.events[0].step,'readback')
 }finally{release();await f.cleanup()}
})
test('unfinished prior record is shown as requiring inspection and never restarted',async()=>{
 const root=await mkdtemp(join(tmpdir(),'live-history-')),id='12345678-abcd-1234-abcd-123456789000'
 await writeFile(join(root,id+'.json'),JSON.stringify({id,status:'running',action:'save-draft',events:[],createdAt:'2026-09-10T00:00:00Z'}))
 let calls=0;const app=createLiveServer({root,run:async()=>calls++});await app.ready;await new Promise(r=>app.server.listen(0,'127.0.0.1',r))
 try{const state=await(await fetch('http://127.0.0.1:'+app.server.address().port+'/api/live/state')).json();assert.equal(state.jobs[0].status,'needs_inspection');assert.equal(state.busy,false);assert.equal(calls,0)}finally{await app.close();await rm(root,{recursive:true,force:true})}
})
test('review API persists source-bound review and loaded package survives service restart',async()=>{
 const {compileProductPackage}=await import('./pdd-package-plan.mjs')
 const plan=compileProductPackage(input,options)
 const f=await setup({run:async()=>({saved:false,published:false,report:{sourceHash:plan.sourceHash,executionHash:plan.executionHash,shopIdentity:{status:'matched'},checks:[{id:'title',status:'matched',expected:'x',observed:'x'}],blockers:[{reason:'qualification_unverified'}]}})})
 try{
 await f.post('package',{input,options});await f.post('browser',{});await f.page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add')
 const {job}=await(await f.post('jobs',{action:'inspect',pageId:(await f.state()).pages[0].id})).json()
 for(let i=0;i<100&&(await f.state()).busy;i++)await new Promise(r=>setTimeout(r,10))
 assert.equal((await f.post('reviews',{jobId:job.id,decision:'accepted'})).status,400)
 assert.equal((await f.post('reviews',{jobId:job.id,decision:'rejected',note:'图片颜色需要修正'})).status,200)
 const saved=JSON.parse(await readFile(join(f.root,job.id+'.json')));assert.equal(saved.reviews[0].decision,'rejected');assert.equal(saved.reviews[0].publicationAuthorized,false)
 await f.app.close()
 const restored=createLiveServer({root:f.root});await restored.ready;await new Promise(r=>restored.server.listen(0,'127.0.0.1',r))
 try{const state=await(await fetch('http://127.0.0.1:'+restored.server.address().port+'/api/live/state')).json();assert.equal(state.loaded.identity.productCode,input.product.productCode);assert.equal(state.jobs[0].reviews[0].note,'图片颜色需要修正');assert.equal(state.pages.length,0)}finally{await restored.close()}
 }finally{await f.cleanup()}
})
test('failed save can be reconciled from history without an open editor and is never resubmitted',async()=>{
 let saves=0,reconciliations=0
 const f=await setup({run:async()=>{saves++;throw new Error('save response lost')},reconcile:async(context,source,config,{reference})=>{reconciliations++;assert.equal(reference.goodsId,'34');return {status:'draft_reconciled_needs_review',draftExists:true,saved:false,published:false}}})
 try{
 await f.post('package',{input,options});await f.post('browser',{});await f.page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add&id=12&goods_id=34')
 const {job}=await(await f.post('jobs',{action:'save-draft',pageId:(await f.state()).pages[0].id})).json()
 for(let i=0;i<100&&(await f.state()).busy;i++)await new Promise(r=>setTimeout(r,10))
 await f.page.goto('about:blank')
 assert.equal((await f.post('jobs',{action:'recover-draft',sourceJobId:'missing'})).status,400)
 assert.equal((await f.post('jobs',{action:'recover-draft',sourceJobId:job.id})).status,202)
 for(let i=0;i<100&&(await f.state()).busy;i++)await new Promise(r=>setTimeout(r,10))
 const state=await f.state();assert.equal(saves,1);assert.equal(reconciliations,1);assert.equal(state.jobs[0].result.draftExists,true);assert.equal(state.jobs[1].status,'needs_inspection')
 const changed=structuredClone(input);changed.product.revision++
 await f.post('package',{input:changed,options});assert.equal((await f.post('jobs',{action:'recover-draft',sourceJobId:job.id})).status,400)
 }finally{await f.cleanup()}
})
