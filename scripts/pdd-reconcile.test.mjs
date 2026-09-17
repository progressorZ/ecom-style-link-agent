import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {recoveryReference,reconcileDraft} from './pdd-reconcile.mjs'
const input=JSON.parse(await readFile(new URL('../examples/product-package-tshirt.json',import.meta.url)))
const options={shopBindings:[{platform:'pdd',shopKey:input.listing.shopKey,shopName:'测试店铺',mallId:'123'}]}
const plan=compileProductPackage(input,options)
const job={id:'old-job',action:'save-draft',status:'needs_inspection',editorUrl:'https://mms.pinduoduo.com/goods/goods_add/index?id=12&goods_id=34&type=add',sourceHash:plan.sourceHash,executionHash:plan.executionHash}
test('recovery only accepts stopped, source-bound tasks with concrete editor identity',()=>{
 assert.equal(recoveryReference(job,plan).goodsId,'34')
 for(const patch of [{status:'running'},{sourceHash:'changed'},{executionHash:'changed'},{editorUrl:undefined},{action:'publication-result'}])assert.throws(()=>recoveryReference({...job,...patch},plan))
})
test('finding an older saved draft with differences never certifies an interrupted save or retries',async()=>{
 let reads=0;const reference=recoveryReference(job,plan)
 const result=await reconcileDraft({},input,options,{reference,openDraft:async()=>({page:{getByText:()=>({count:async()=>0}),url:()=>job.editorUrl},evidence:{goodsId:'34',status:'编辑中'}}),read:async()=>{reads++;return {sourceHash:plan.sourceHash,executionHash:plan.executionHash,checks:[{id:'stock',status:'mismatch',expected:20,observed:10}]}}})
 assert.equal(reads,1);assert.equal(result.status,'draft_reconciled_with_differences');assert.equal(result.draftExists,true);assert.equal(result.originalSaveConfirmed,false);assert.equal(result.saveExecuted,false);assert.equal(result.retryAllowed,false)
})
test('recovery refuses a report from a different input revision',async()=>{
 await assert.rejects(()=>reconcileDraft({},input,options,{reference:recoveryReference(job,plan),openDraft:async()=>({page:{getByText:()=>({count:async()=>0})},evidence:{}}),read:async()=>({sourceHash:'other',executionHash:plan.executionHash,checks:[]})}),/INPUT_MISMATCH/)
})
