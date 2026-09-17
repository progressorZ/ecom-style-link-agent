import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runMediaJournal,createMediaReceipt} from './pdd-media-task.mjs'
let root
test.beforeEach(async()=>root=await mkdtemp(join(tmpdir(),'pdd-media-task-')));test.afterEach(async()=>rm(root,{recursive:true,force:true}))
test('durable intent exists before side effect and repeated scope cannot run again',async()=>{
 let calls=0;const scope={shop:'a',editor:'one',step:'carousel'}
 const {createHash}=await import('node:crypto');const dir=join(root,createHash('sha256').update(JSON.stringify(scope)).digest('hex'))
 const result=await runMediaJournal(root,scope,{version:1},async()=>{assert.equal(JSON.parse(await readFile(join(dir,'intent.json'))).version,1);calls++;return {status:'ok'}})
 assert.equal(result.status,'ok');assert.equal(JSON.parse(await readFile(join(dir,'result.json'))).status,'ok')
 await assert.rejects(()=>runMediaJournal(root,scope,{},async()=>calls++),/RECONCILE_REQUIRED/);assert.equal(calls,1)
})
test('failed side effect remains claimed and records partial upload evidence',async()=>{
 const scope={shop:'a'};await assert.rejects(()=>runMediaJournal(root,scope,{},async()=>{const e=new Error('timeout');e.partialResult={completed:['first']};throw e}),/timeout/)
 await assert.rejects(()=>runMediaJournal(root,scope,{},async()=>({})),/RECONCILE_REQUIRED/)
})
test('receipt binds every target and rejects partial successful-looking upload',()=>{
 const plan={sourceHash:'s',executionHash:'e',identity:{shopKey:'shop',productCode:'TEST'}}
 const step={id:'carousel',input:{images:[{id:'a'}]}}
 const report={status:'carousel_upload_observed',completed:[{id:'a',position:1,sha256:'a'.repeat(64),remoteUrl:'https://example.test/a'}]}
 const receipt=createMediaReceipt(plan,step,'editor',report);assert.equal(receipt.entries[0].assetId,'a');assert.equal(receipt.contentVerified,false)
 assert.throws(()=>createMediaReceipt(plan,step,'editor',{...report,completed:[]}),/INCOMPLETE/)
 assert.throws(()=>createMediaReceipt(plan,step,'editor',{...report,status:'needs_inspection'}),/NOT_CONFIRMED/)
})

test('journal reader distinguishes missing result from completion and never allows blind retry',async()=>{
 const {inspectMediaJournal}=await import('./pdd-media-journal-read.mjs')
 assert.equal((await inspectMediaJournal(root)).status,'unknown')
 let journalDir;const {createHash}=await import('node:crypto');const scope={shop:'unfinished'};journalDir=join(root,createHash('sha256').update(JSON.stringify(scope)).digest('hex'))
 await assert.rejects(()=>runMediaJournal(root,scope,{},async()=>{const state=await inspectMediaJournal(journalDir);assert.equal(state.status,'unknown');assert.equal(state.retryAllowed,false);throw new Error('upload interrupted')}),/interrupted/)
 const failed=await inspectMediaJournal(journalDir);assert.equal(failed.status,'needs_inspection');assert.equal(failed.retryAllowed,false)
})

test('existing journal permits verified reuse without executing upload again',async()=>{
 const scope={shop:'reuse'};let uploads=0,reconciles=0
 await runMediaJournal(root,scope,{},async()=>{uploads++;return {status:'recorded'}})
 const recovered=await runMediaJournal(root,scope,{},async()=>{uploads++},{onExisting:async directory=>{
  reconciles++;assert.equal(JSON.parse(await readFile(join(directory,'result.json'))).status,'recorded');return {status:'reused'}
 }})
 assert.equal(recovered.status,'reused');assert.equal(uploads,1);assert.equal(reconciles,1)
 await assert.rejects(()=>runMediaJournal(root,scope,{},async()=>{uploads++},{onExisting:async()=>{throw new Error('MEDIA_PREVIOUS_UPLOAD_CHANGED')}}),/MEDIA_PREVIOUS_UPLOAD_CHANGED/)
 assert.equal(uploads,1)
})
