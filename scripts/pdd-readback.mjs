import {assessReadbackBlockers} from './pdd-readback-blockers.mjs'
import {observeShopIdentity,resolveShopBinding,assertShopBinding,readShopHeader} from './pdd-shop-identity.mjs'
import {resolveSizeSyncDom} from './pdd-size-sync.mjs'
import {observePageCoverage,assessPageCoverage} from './pdd-page-coverage.mjs'
import {verifyMediaBindings} from './pdd-media-bindings.mjs'
import {observeCarousel} from './pdd-image-dom.mjs'
import {observeDetail} from './pdd-detail-dom.mjs'
import {assessMediaReadback} from './pdd-media-readback.mjs'
import {compileSizePlan} from './pdd-size-adapter.mjs'
import {resolveSizeDom} from './pdd-size-dom.mjs'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {assertReadbackScope} from './pdd-basic-adapter.mjs'
import {tshirtLocatorContract} from './pdd-locator-contract.mjs'
import {resolveAttributeDom} from './pdd-attributes.mjs'
import {resolveElementsDom} from './pdd-elements.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
import {compileSkuPlan,parseMoney} from './pdd-sku-adapter.mjs'
import {resolvePricingDom} from './pdd-pricing.mjs'
import {observeServices} from './pdd-services.mjs'
import {resolveShippingDom} from './pdd-shipping-dom.mjs'
import {observeFreight,freightBusinessValues} from './pdd-freight.mjs'

export function readBasicField({label}){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const labels=[...document.querySelectorAll('label')].filter(e=>visible(e)&&e.textContent.trim()===label)
 if(labels.length!==1)throw new Error('READBACK_LABEL_AMBIGUOUS:'+label)
 const root=labels[0].closest('[data-testid=beast-core-form-item]')
 const controls=root?[...root.querySelectorAll('input,textarea')].filter(visible):[]
 if(controls.length!==1)throw new Error('READBACK_CONTROL_AMBIGUOUS:'+label)
 return controls[0].value
}
// Recompile and snapshot source inputs; never consume prior execution success reports.
export async function readbackProductPackage(page,raw,options={}){
 const context=structuredClone(options),plan=compileProductPackage(raw,context),url=page.url(),checks=[]
 const guard=async()=>{
  if(page.url()!==url)throw new Error('PAGE_CHANGED')
  await assertReadbackScope(page)
  if(context.shopBindings){const binding=resolveShopBinding(plan.identity.shopKey,context.shopBindings);if(await page.evaluate(readShopHeader)!==binding.shopName)throw new Error('SHOP_IDENTITY_MISMATCH')}
  if(await page.locator('[data-testid=beast-core-modal]:visible').count())throw new Error('READBACK_BLOCKING_MODAL')
  if(await page.locator('[role=listbox]:visible').count())throw new Error('READBACK_CLOSE_POPUP')
  if(await page.evaluate(readBasicField,{label:'商品货号'})!==plan.identity.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
 }
 await guard()
 const shopBinding=context.shopBindings?resolveShopBinding(plan.identity.shopKey,context.shopBindings):null
 const shopIdentity=shopBinding?assertShopBinding(await observeShopIdentity(page),shopBinding):{status:'unverified',reason:'shop_binding_missing'}
 const check=async(id,expected,reader)=>{
  await guard()
  let result
  try{
   const observed=await reader()
   result={id,status:JSON.stringify(expected)===JSON.stringify(observed)?'matched':'mismatch',expected,observed}
  }catch(error){result={id,status:'unreadable',reason:error.message,expected}}
  await guard();checks.push(result)
 }
 const attribute=async(key,value)=>{
  const label=tshirtLocatorContract.fields.find(f=>f.key===key)?.label
  await check(key,value,async()=>{if(!label)throw new Error('READBACK_CONTRACT_MISSING');return (await page.evaluate(resolveAttributeDom,{label,allowReadOnly:true})).value})
 }
 for(const step of plan.steps){
  const input=step.input
  if(step.id==='basic')for(const f of input.fields)await check(f.key,f.value,()=>page.evaluate(readBasicField,{label:tshirtLocatorContract.fields.find(x=>x.key===f.key).label}))
  else if(['attributes','brand'].includes(step.id))for(const f of input.fields)await attribute(f.key,f.value)
  else if(step.id==='fabric')for(const key of ['fabricName','material','composition'])await attribute('attributes.'+key,input[key])
  else if(step.id==='style')for(const key of ['primaryStyle','secondaryStyle'])await attribute('attributes.'+key,input[key])
  else if(step.id==='elements')await check('attributes.fashionElements',[...input.values].sort(),async()=>[...(await page.evaluate(resolveElementsDom)).values].sort())
  else if(step.id==='matrixAndSku'){
   const sku=compileSkuPlan({scope:'pdd-tshirt-sku-v1',productCode:input.productCode,variants:input.variants})
   await check('variants',sku.variants,async()=>{const rows=await page.evaluate(resolveSkuDom,{expectedKeys:sku.variants.map(v=>v.key)});return sku.variants.map(v=>{const r=rows.find(x=>x.key===v.key);return {key:r.key,color:r.color,size:r.size,stock:/^\d+$/.test(r.values.stock)?Number(r.values.stock):null,groupPriceMinor:parseMoney(r.values.groupPriceMinor),singlePriceMinor:parseMoney(r.values.singlePriceMinor),merchantSku:r.values.merchantSku,enabled:r.values.enabled}})})
  }
  else if(step.id==='size'){
   const size=compileSizePlan(input)
   const number=v=>typeof v==='string'&&/^\d+(\.\d)?$/.test(v)?Number(v):null
   const normalized=rows=>rows.map(r=>({size:r?.size,values:Object.fromEntries(size.columns.map(c=>{const v=r?.values?.[c];return [c,v&&typeof v==='object'?{min:number(v.min),max:number(v.max)}:number(v)]}))}))
   await check('sizeChart',{columns:size.columns,rows:normalized(size.rows)},async()=>{const state=await page.evaluate(resolveSizeDom,{columns:size.columns,sizes:size.rows.map(r=>r.size)});return {columns:size.columns.filter(c=>state.selected.includes(c)),rows:normalized(size.rows.map(r=>state.rows.find(x=>x.size===r.size)))}})
  }
  else if(step.id==='sizeSync')await check('listing.sizeConfiguration.syncChartToDetail',input.enabled,async()=>(await page.evaluate(resolveSizeSyncDom)).enabled)
  else if(step.id==='pricing')await check('listing.pricing',{referenceAmountMinor:input.referenceAmountMinor,count:input.multiItemDiscount.count,discount:input.multiItemDiscount.discount},async()=>{const p=await page.evaluate(resolvePricingDom,{allowSummary:true});return {referenceAmountMinor:parseMoney(p.referenceAmountMinor),count:p.count,discount:/^\d+(\.\d)?$/.test(p.discount)?Number(p.discount):null}})
  else if(step.id==='shipping')await check('listing.logistics.shippingPromise',`${input.shipmentHours}小时发货及揽收`,async()=>(await page.evaluate(resolveShippingDom)).selected)
  else if(step.id==='services')for(const [key,value] of Object.entries(input.expected))await check('services.'+key,value,async()=>(await page.evaluate(observeServices)).values[key])
  else if(step.id==='freight'){
   let observedMode
   await check('listing.logistics.freight',{deliveryType:'shipping',templateName:input.templateName,groups:input.expectedGroups},async()=>{const f=await page.evaluate(observeFreight);observedMode=f.mode;return freightBusinessValues(f)})
   checks.at(-1).presentation={expectedSelectionMode:input.mode,observedSelectionMode:observedMode??null}
  }
  else if(['carousel','detail','skuImages'].includes(step.id)){
   await guard();let media
   try{const observed=step.id==='carousel'?await page.evaluate(observeCarousel):step.id==='detail'?await page.evaluate(observeDetail):await page.evaluate(resolveSkuDom,{includeImages:true,expectedKeys:input.bindings.map(b=>JSON.stringify([b.color,b.size]))});media=assessMediaReadback(step,observed);media.binding=await verifyMediaBindings({plan,step,editorUrl:url,observed,receipts:context.mediaReceipts??[]});if(media.binding.status==='mismatch')media.status='mismatch';else if(media.binding.status==='references_changed'&&media.status==='unverified')media.reason='persisted_image_references_changed_visual_review_required';else if(media.binding.status==='references_matched'&&media.status==='unverified')media.reason='references_matched_visual_review_required'}catch(error){media={id:step.id,status:'unreadable',reason:error.message}}
   await guard();checks.push(media)
  }
  else checks.push({id:step.id,status:'uncovered',reason:'independent_reader_not_integrated'})
 }
 await guard()
 const coverage=assessPageCoverage(await page.evaluate(observePageCoverage),tshirtLocatorContract,checks)
 await guard()
 if(shopBinding)assertShopBinding(await observeShopIdentity(page),shopBinding)
 await guard()
 const assessment=assessReadbackBlockers(plan,checks,shopIdentity)
 return {...assessment,shopIdentity,coverage,version:'pdd-readback-v1',status:'incomplete',identity:plan.identity,sourceHash:plan.sourceHash,executionHash:plan.executionHash,observedAt:new Date().toISOString(),checks,counts:Object.fromEntries(['matched','mismatch','unreadable','uncovered','unverified'].map(s=>[s,checks.filter(c=>c.status===s).length])),readOnly:true,fullProductVerified:false,saved:false,published:false}
}
