import test from 'node:test'
import assert from 'node:assert/strict'
import {compileRepairSteps} from './pdd-repair-plan.mjs'
import {withVerifiedNewDraft} from './pdd-draft-write-scope.mjs'
import {assertBasicScope} from './pdd-basic-adapter.mjs'

const plan={sourceHash:'s',executionHash:'e',steps:[{id:'basic',input:{fields:[{key:'listing.title',value:'测试T恤'},{key:'product.productCode',value:'TEST'}]}},{id:'attributes',input:{fields:[{key:'attributes.sleeveLength',value:'短袖'},{key:'attributes.fit',value:'常规'}]}}]}
const report={sourceHash:'s',executionHash:'e',checks:[{id:'listing.title',status:'matched',expected:'测试T恤',observed:'测试T恤'},{id:'attributes.sleeveLength',status:'mismatch',expected:'短袖',observed:'长袖'},{id:'attributes.fit',status:'matched',expected:'常规',observed:'常规'},{id:'variants',status:'mismatch',expected:[],observed:[]},{id:'carousel',status:'unverified'}]}
test('repair selects only changed supported fields and retains unsupported differences',()=>{
 const repair=compileRepairSteps(plan,report)
 assert.deepEqual(repair.changedFields,['attributes.sleeveLength'])
 assert.deepEqual(repair.manualChecks,['variants'])
 assert.equal(repair.steps.length,1);assert.equal(repair.steps[0].input.fields.length,1)
 assert.throws(()=>compileRepairSteps(plan,{...report,sourceHash:'other'}),/INPUT_CHANGED/)
 const changed=structuredClone(report);changed.checks[1].expected='中袖';assert.throws(()=>compileRepairSteps(plan,changed),/EVIDENCE_INVALID/)
})
test('a clean report causes no writes and product identity cannot be repaired',()=>{
 const clean=structuredClone(report);clean.checks=clean.checks.filter(c=>c.status!=='mismatch')
 assert.equal(compileRepairSteps(plan,clean).steps.length,0)
 clean.checks.push({id:'product.productCode',status:'mismatch',expected:'TEST',observed:'OTHER'})
 assert.deepEqual(compileRepairSteps(plan,clean).manualChecks,['product.productCode'])
 assert.equal(compileRepairSteps(plan,clean).steps.length,0)
})
const url='https://mms.pinduoduo.com/goods/goods_add/index?id=12&goods_id=34&type=edit'
const makePage=()=>({url:()=>url,context:()=>({}),getByText:()=>({count:async()=>1})})
test('verified new-draft access is limited to one page and one operation',async()=>{
 const page=makePage(),other=makePage();let closed=0
 const openDraft=async()=>({page:{close:async()=>closed++},evidence:{status:'编辑中',editType:'发布',goodsId:'34',draftId:'12'}})
 await assert.rejects(()=>assertBasicScope(page),/NEW_PRODUCT/)
 await withVerifiedNewDraft(page,{},async()=>{await assertBasicScope(page);await assert.rejects(()=>assertBasicScope(other),/NEW_PRODUCT/)},{openDraft})
 await assert.rejects(()=>assertBasicScope(page),/NEW_PRODUCT/);assert.equal(closed,1)
})
test('an existing-product edit draft or different identity never permits a write',async()=>{
 let writes=0
 for(const patch of [{editType:'编辑'},{goodsId:'35'},{status:'发布中'}]){
  await assert.rejects(()=>withVerifiedNewDraft(makePage(),{},async()=>writes++,{openDraft:async()=>({page:{close:async()=>{}},evidence:{status:'编辑中',editType:'发布',goodsId:'34',draftId:'12',...patch}})}),/NOT_CONFIRMED/)
 }
 assert.equal(writes,0)
})
