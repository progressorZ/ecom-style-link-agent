import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {runSingleJournal,assertDraftReadback,saveAndReopenDraft,runSingleWorkflow} from './pdd-single-workflow.mjs'
const report=value=>({sourceHash:'source',executionHash:'execution',shopIdentity:{status:'matched'},coverage:{errorSummaries:[]},checks:[{id:'price',status:value==='129'?'matched':'mismatch',expected:'129',observed:value}]})
test('draft gate rejects differences, missing identity, duplicate checks and visible errors',()=>{
 assert.doesNotThrow(()=>assertDraftReadback(report('129')))
 for(const r of [report('130'),{...report('129'),shopIdentity:null},{...report('129'),checks:[...report('129').checks,...report('129').checks]},{...report('129'),coverage:{errorSummaries:['1个错误项未处理']}}])assert.throws(()=>assertDraftReadback(r))
})
test('no publication action can be dispatched',async()=>{await assert.rejects(()=>runSingleWorkflow(null,null,{}, {action:'publish'}),/UNSUPPORTED/)})
test('unknown partial operation remains claimed with its evidence and cannot silently rerun',async()=>{
 const root=await mkdtemp(join(tmpdir(),'single-journal-'));try{
 let calls=0
 await assert.rejects(()=>runSingleJournal(root,{action:'save'},async record=>{await record('before',{value:129});calls++;const e=new Error('lost response');e.partialResult={saved:'unknown'};throw e}),/lost response/)
 await assert.rejects(()=>runSingleJournal(root,{action:'save'},()=>{calls++}),/INSPECT_BEFORE_RETRY/)
 const [dir]=await readdir(root),f=JSON.parse(await readFile(join(root,dir,'failure.json')));assert.equal(f.partialResult.saved,'unknown');assert.equal(f.retryAllowed,false);assert.equal(calls,1)
 }finally{await rm(root,{recursive:true,force:true})}
})
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function fixture(corrupt=false){
 const context=await browser.newContext();let stored='129',saves=0,publishes=0
 await context.route('https://example.test/**',async r=>{
  if(r.request().url().endsWith('/save')){saves++;stored=corrupt?'130':r.request().postData();await r.fulfill({body:'ok'});return}
  if(r.request().url().endsWith('/publish')){publishes++;await r.fulfill({body:'bad'});return}
  await r.fulfill({contentType:'text/html; charset=utf-8',body:`<input id="value" value="${stored}"><button onclick="fetch('/save',{method:'POST',body:document.getElementById('value').value}).then(()=>document.body.insertAdjacentHTML('beforeend','<h3>保存成功!</h3>'))">保存草稿</button><button onclick="fetch('/publish')">提交并上架</button>`})
 })
 const page=await context.newPage();await page.goto('https://example.test/editor');const records={}
 return {context,page,records,counts:()=>({saves,publishes}),callbacks:{productCode:'TEST',guard:async()=>{assert.equal(page.url(),'https://example.test/editor')},read:async p=>report(await p.locator('#value').inputValue()),record:async(k,v)=>{records[k]=v}}}
}
test('one save, explicit success and fresh page read preserve values without publishing',async()=>{const f=await fixture();try{
 const r=await saveAndReopenDraft(f.page,f.callbacks)
 assert.equal(r.status,'draft_saved_reopened_needs_review');assert.equal(r.saved,true);assert.equal(r.mediaContentVerified,false);assert.deepEqual(f.counts(),{saves:1,publishes:0});assert.equal(f.context.pages().length,2);assert.equal(f.records.reopened.checks[0].observed,'129')
 await assert.rejects(()=>saveAndReopenDraft(f.page,f.callbacks),/STALE_SUCCESS/);assert.equal(f.counts().saves,1)
}finally{await f.context.close()}})
test('corrupted persisted data is detected after reopen and never triggers another save',async()=>{const f=await fixture(true);try{
 await assert.rejects(()=>saveAndReopenDraft(f.page,f.callbacks),e=>e.message==='DRAFT_READBACK_HAS_DIFFERENCES'&&e.partialResult.saved===true)
 assert.equal(f.records.reopened.checks[0].observed,'130');assert.deepEqual(f.counts(),{saves:1,publishes:0})
}finally{await f.context.close()}})
