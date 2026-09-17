import test from 'node:test'
import assert from 'node:assert/strict'
import {assessReadbackBlockers} from './pdd-readback-blockers.mjs'
const blocker=reason=>({path:'/',reason})
const binding={platform:'pdd',shopKey:'test',mallId:'123',shopName:'测试店铺'}
const plan={bindings:{shopBinding:binding},steps:[{id:'services',input:{expected:{groupSize:2,inventoryDeduction:'payment_success'}}}],blockers:['live_shop_identity_unverified','pricing_live_readback_required','freight_live_readback_required','size_detail_sync_live_readback_required','inventory_deduction_unverified','services_live_readback_required','qualification_requirements_unverified','independent_whole_form_readback_unimplemented'].map(blocker)}
const match=(id,value)=>({id,status:'matched',expected:value,observed:value})
const checks=()=>[match('listing.pricing',{referenceAmountMinor:100200}),match('listing.logistics.freight',{templateName:'测试',groups:['区域规则']}),match('listing.sizeConfiguration.syncChartToDetail',false),match('services.inventoryDeduction','payment_success'),match('services.groupSize',2)]
test('current matched diagnostics resolve only known live blockers, preserving full-form and qualification gaps',()=>{
 const result=assessReadbackBlockers(plan,checks(),{status:'matched',...binding})
 assert.equal(result.resolvedBlockers.length,6)
 assert.deepEqual(result.blockers.map(b=>b.reason),['qualification_requirements_unverified','independent_whole_form_readback_unimplemented'])
})
test('missing, duplicate, unreadable and inconsistent checks cannot satisfy prerequisites',()=>{
 for(const mode of ['missing','duplicate','unreadable','inconsistent']){
  const c=checks(),index=c.findIndex(x=>x.id==='services.groupSize')
  if(mode==='missing')c.splice(index,1)
  if(mode==='duplicate')c.push({...c[index]})
  if(mode==='unreadable')c[index].status='unreadable'
  if(mode==='inconsistent')c[index].observed=3
  const result=assessReadbackBlockers(plan,c,{status:'matched',...binding})
  assert.ok(result.blockers.some(b=>b.reason==='services_live_readback_required'))
 }
})
test('wrong store ID or absent binding cannot resolve store identity even with a matched status',()=>{
 for(const [p,observed] of [[plan,{...binding,mallId:'456',status:'matched'}],[{...plan,bindings:{}},{...binding,status:'matched'}],[plan,{...binding,status:'unverified'}]])assert.ok(assessReadbackBlockers(p,checks(),observed).blockers.some(b=>b.reason==='live_shop_identity_unverified'))
})
