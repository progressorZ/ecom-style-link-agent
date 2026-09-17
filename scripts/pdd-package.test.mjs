import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compileProductPackage} from './pdd-package-plan.mjs'
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/product-package-tshirt.json',import.meta.url),'utf8'))
test('one package compiles implemented modules with explicit incomplete coverage',()=>{
 const p=compileProductPackage(fixture());assert.equal(p.steps.length,10);assert.equal(p.executable,false);assert.ok(p.blockers.some(b=>b.reason==='unconfirmed_evidence'))
 const images=p.steps.find(s=>s.id==='skuImages').input;assert.equal(images.images.length,1);assert.equal(images.bindings.length,2)
 assert.equal(p.steps.find(s=>s.id==='shipping').input.shipmentHours,48)
})
test('freezes the source and nested execution plans and fingerprints all source fields',()=>{
 const raw=fixture(),p=compileProductPackage(raw);raw.listing.offers[0].stock=9
 assert.equal(p.source.listing.offers[0].stock,1);assert.throws(()=>p.steps.find(s=>s.id==='matrixAndSku').input.variants[0].stock=99,TypeError)
 assert.notEqual(compileProductPackage(raw).sourceHash,p.sourceHash)
 const reordered=Object.fromEntries(Object.entries(fixture()).reverse());assert.equal(compileProductPackage(reordered).sourceHash,p.sourceHash)
})
test('resolves offers by variant ID and sizes by sizeKey, not array position',()=>{
 const raw=fixture();raw.listing.offers.reverse();raw.sizeCharts[0].rows.reverse()
 const p=compileProductPackage(raw);assert.equal(p.steps.find(s=>s.id==='size').input.rows[0].size,'M');assert.equal(p.steps.find(s=>s.id==='skuImages').input.bindings[0].size,'M')
})
test('rejects image cross-color binding, unapproved assets and ambiguous order',()=>{
 for(const mode of ['color','approval','order','id']){const p=fixture();if(mode==='color')p.assets[2].colorKey='black';if(mode==='approval')p.assets[0].reviewStatus='pending';if(mode==='order')p.assets.push({...p.assets[0],id:'extra'});if(mode==='id')p.assets.push({...p.assets[0]});assert.throws(()=>compileProductPackage(p),/ASSET_/)}
})
test('rejects incomplete size coverage, inconsistent labels, mismatched columns and unsupported charts',()=>{
 for(const mode of ['selected','label','row','column','body']){const p=fixture();if(mode==='selected')p.listing.sizeConfiguration.selectedSizeKeys=['s'];if(mode==='label')p.variants[1].colorLabel='黑色';if(mode==='row')p.sizeCharts[0].rows.pop();if(mode==='column')p.sizeCharts[0].columns.pop();if(mode==='body')p.sizeCharts[0].kind='body_recommendation';assert.throws(()=>compileProductPackage(p),/SIZE_|VARIANT_/)}
})
test('legacy dress example cannot pass the T-shirt compiler',()=>{
 const p=JSON.parse(readFileSync(new URL('../examples/product-package.json',import.meta.url),'utf8'));assert.throws(()=>compileProductPackage(p),/PACKAGE_IDENTITY/)
})
test('fabric values compile as one dependency bundle; partial bundle is rejected',()=>{
 const raw=fixture();raw.product.attributes.fabricName='棉';assert.throws(()=>compileProductPackage(raw),/FABRIC_PLAN_INVALID/)
 Object.assign(raw.product.attributes,{material:'棉',composition:'95%及以上'});const p=compileProductPackage(raw);assert.equal(p.steps.find(s=>s.id==='fabric').input.material,'棉');assert.equal(p.executable,false)
})
test('styles compile together and incomplete pairs are rejected',()=>{
 const raw=fixture();raw.product.attributes.primaryStyle='简约通勤';assert.throws(()=>compileProductPackage(raw),/STYLE_PLAN_INVALID/)
 raw.product.attributes.secondaryStyle='简约';assert.equal(compileProductPackage(raw).steps.find(s=>s.id==='style').input.secondaryStyle,'简约')
})
test('fashion elements retain explicit array values and reject a joined string',()=>{
 const raw=fixture();raw.product.attributes.fashionElements=['纯色','口袋'];assert.deepEqual(compileProductPackage(raw).steps.find(s=>s.id==='elements').input.values,['纯色','口袋'])
 raw.product.attributes.fashionElements='纯色,口袋';assert.throws(()=>compileProductPackage(raw),/ELEMENTS_PLAN_INVALID/)
})

const profile=()=>({version:'pdd-freight-profile-v1',platform:'pdd',shopKey:'demo-shop-not-connected',profileKey:'demo-logistics-unverified',revision:1,confirmation:{confirmed:true,confirmedAt:'2026-09-09T00:00:00Z',reference:'仅隔离测试中的虚构确认'},freight:{mode:'other',templateName:'虚构运费模板',expectedGroups:['包邮配送区域 测试地区']}})
test('freight binding requires matching shop and profile; compilation never proves live configuration',()=>{
 const p=compileProductPackage(fixture(),{freightProfiles:[profile()]})
 assert.equal(p.steps.at(-1).id,'freight');assert.equal(p.steps.at(-1).input.productCode,'AUTO-PACKAGE-TEST')
 assert.ok(p.blockers.some(b=>b.reason==='freight_live_readback_required'))
 assert.ok(p.blockers.some(b=>b.reason==='live_shop_identity_unverified'));assert.equal(p.executable,false)
 for(const key of ['shopKey','profileKey','platform']){
  const wrong=profile();wrong[key]='another';const result=compileProductPackage(fixture(),{freightProfiles:[wrong]})
  assert.ok(!result.steps.some(s=>s.id==='freight'));assert.ok(result.blockers.some(b=>b.reason==='freight_effective_configuration_unverified'))
 }
})
test('ambiguous, unconfirmed, invalid, and scope-overriding freight profiles are rejected',()=>{
 assert.throws(()=>compileProductPackage(fixture(),{freightProfiles:[profile(),profile()]}),/AMBIGUOUS/)
 for(const mutate of [p=>p.confirmation.confirmed=false,p=>p.revision=0,p=>p.confirmation.confirmedAt='yesterday',p=>p.confirmation.reference='',p=>p.freight.expectedGroups=[],p=>p.freight.productCode='OTHER']){
  const p=profile();mutate(p);assert.throws(()=>compileProductPackage(fixture(),{freightProfiles:[p]}),/FREIGHT_/)
 }
})
test('external configuration is frozen and included in execution hash without changing product hash',()=>{
 const input=profile(),a=compileProductPackage(fixture(),{freightProfiles:[input]})
 input.freight.expectedGroups[0]='不配送区域 测试地区';input.revision=2
 const b=compileProductPackage(fixture(),{freightProfiles:[input]})
 assert.equal(a.sourceHash,b.sourceHash);assert.notEqual(a.executionHash,b.executionHash)
 assert.equal(a.bindings.freightProfile.revision,1)
 assert.throws(()=>a.bindings.freightProfile.freight.expectedGroups.push('changed'),TypeError)
 assert.equal(a.steps.at(-1).input.expectedGroups[0],'包邮配送区域 测试地区')
})

test('package pricing follows matrix with exact cents and rejects unsupported count or reference price',()=>{
 const raw=fixture(),p=compileProductPackage(raw),index=p.steps.findIndex(s=>s.id==='pricing')
 assert.equal(p.steps[index-1].id,'matrixAndSku');assert.equal(p.steps[index].input.referenceAmountMinor,100200)
 assert.ok(p.blockers.some(b=>b.reason==='pricing_live_readback_required'))
 raw.listing.pricing.multiItemDiscount.count=3;assert.throws(()=>compileProductPackage(raw),/PRICING_PLAN_INVALID/)
 raw.listing.pricing.multiItemDiscount.count=2;raw.listing.pricing.referenceAmountMinor=100100;assert.throws(()=>compileProductPackage(raw),/REFERENCE_PRICE/)
})

test('textile attributes retain platform range and yarn labels in unified plan',()=>{
 const raw=fixture();Object.assign(raw.product.attributes,{fleece:'不加绒',gramsPerSquareMeter:'160g/m²（含）—180g/m²（不含）',yarnCount:'32S'})
 const fields=compileProductPackage(raw).steps.find(s=>s.id==='attributes').input.fields
 assert.equal(fields.find(f=>f.key==='attributes.gramsPerSquareMeter').value,raw.product.attributes.gramsPerSquareMeter)
 assert.equal(fields.find(f=>f.key==='attributes.yarnCount').value,'32S')
 raw.product.attributes.gramsPerSquareMeter=170;assert.throws(()=>compileProductPackage(raw),/ATTRIBUTE_FIELD_UNSUPPORTED/)
})

test('unknown brand does not become no-brand and qualification remains explicit',()=>{
 const raw=fixture(),unknown=compileProductPackage(raw)
 assert.ok(!unknown.steps.some(s=>s.id==='brand'));assert.ok(unknown.blockers.some(b=>b.reason==='brand_configuration_missing'))
 raw.product.brand='无品牌/无注册商标';const explicit=compileProductPackage(raw)
 assert.equal(explicit.steps.find(s=>s.id==='brand').input.fields[0].value,raw.product.brand)
 assert.ok(explicit.blockers.some(b=>b.reason==='qualification_requirements_unverified'))
 raw.product.brand='';assert.throws(()=>compileProductPackage(raw),/ATTRIBUTE_FIELD_UNSUPPORTED/)
})

test('shop binding changes execution fingerprint but not product facts and is frozen',()=>{
 const raw=fixture(),binding={platform:'pdd',shopKey:raw.listing.shopKey,shopName:'测试店铺',mallId:'123'},options={shopBindings:[binding]}
 const a=compileProductPackage(raw),b=compileProductPackage(raw,options)
 assert.equal(a.sourceHash,b.sourceHash);assert.notEqual(a.executionHash,b.executionHash)
 binding.mallId='456';const c=compileProductPackage(raw,options)
 assert.notEqual(b.executionHash,c.executionHash);assert.equal(b.bindings.shopBinding.mallId,'123')
 assert.throws(()=>{b.bindings.shopBinding.mallId='789'},TypeError)
 assert.throws(()=>compileProductPackage(raw,{shopBindings:[]}),/SHOP_BINDING/)
 assert.ok(b.blockers.some(x=>x.reason==='live_shop_identity_unverified'))
})
test('platform image inference runs before authoritative attribute values',()=>{
 const raw=fixture();Object.assign(raw.product,{brand:'无品牌/无注册商标'});Object.assign(raw.product.attributes,{sleeveLength:'短袖',fit:'常规',garmentLength:'常规款',sleeveType:'常规'})
 const steps=compileProductPackage(raw).steps
 const state={}
 for(const step of steps){
  if(['carousel','skuImages','detail'].includes(step.id))Object.assign(state,{'attributes.sleeveLength':'长袖','attributes.fit':'宽松','attributes.garmentLength':'短款','attributes.sleeveType':'蝙蝠袖'})
  if(step.id==='attributes')for(const field of step.input.fields)state[field.key]=field.value
 }
 assert.deepEqual(Object.fromEntries(Object.keys(state).filter(k=>['attributes.sleeveLength','attributes.fit','attributes.garmentLength','attributes.sleeveType'].includes(k)).map(k=>[k,state[k]])),{'attributes.sleeveLength':'短袖','attributes.fit':'常规','attributes.garmentLength':'常规款','attributes.sleeveType':'常规'})
 assert.ok(steps.findIndex(s=>s.id==='matrixAndSku')<steps.findIndex(s=>s.id==='skuImages'))
})
