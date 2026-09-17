import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {compileSkuPlan,skuDifferences,parseMoney,moneyText} from './pdd-sku-adapter.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
export function compilePricingPlan(input){
 if(input?.scope!=='pdd-tshirt-pricing-v1'||!Number.isSafeInteger(input.referenceAmountMinor)||input.referenceAmountMinor<=0||input.multiItemDiscount?.count!==2||typeof input.multiItemDiscount.discount!=='number'||!/^([5-8](\.\d)?|9(\.[0-9])?)$/.test(String(input.multiItemDiscount.discount)))throw new Error('PRICING_PLAN_INVALID')
 const sku=compileSkuPlan({scope:'pdd-tshirt-sku-v1',productCode:input.productCode,variants:input.variants})
 if(sku.variants.some(v=>v.singlePriceMinor>=input.referenceAmountMinor))throw new Error('REFERENCE_PRICE_MUST_EXCEED_ALL_SINGLE_PRICES')
 return Object.freeze({scope:input.scope,productCode:sku.productCode,referenceAmountMinor:input.referenceAmountMinor,multiItemDiscount:Object.freeze({...input.multiItemDiscount}),variants:sku.variants})
}
// Page callback reads native values, not React state or prior execution output.
export function resolvePricingDom({target,allowSummary=false}={}){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const result={},targets={}
 for(const [key,label,placeholder] of [['referenceAmountMinor','商品参考价','应大于商品最大单买价'],['discount','满件折扣','5.0~9.9']]){
  const roots=[...document.querySelectorAll('[data-testid=beast-core-form-item]')].filter(e=>visible(e)&&[...e.querySelectorAll('label')].some(l=>l.textContent.trim()===label))
  if(roots.length!==1)throw new Error('PRICING_FIELD_AMBIGUOUS:'+key)
  const root=roots[0],inputs=[...root.querySelectorAll('input')].filter(visible)
  if(key==='discount'&&allowSummary&&!target&&inputs.length===0){
   const summary=[...root.querySelectorAll('.price-text')].filter(visible)
   const text=summary.length===1?summary[0].innerText.trim():''
   const match=/^满(\d+)件\s+([5-9](?:\.\d)?)\s*折\s*修改$/.exec(text)
   if(!match||[...root.querySelectorAll('[data-testid=beast-core-form-item-error]')].some(visible))throw new Error('PRICING_SUMMARY_UNSUPPORTED')
   result.count=Number(match[1]);result.discount=match[2];continue
  }
  if(inputs.length!==1||inputs[0].placeholder!==placeholder||inputs[0].disabled||inputs[0].readOnly)throw new Error('PRICING_CONTROL_UNSUPPORTED:'+key)
  const errors=[...root.querySelectorAll('[data-testid=beast-core-form-item-error]')].filter(visible).map(e=>e.innerText)
  if(errors.length)throw new Error('PRICING_FIELD_ERROR:'+key)
  result[key]=inputs[0].value;targets[key]=inputs[0]
  if(key==='discount'){
   const counts=[...root.querySelectorAll('span')].filter(e=>visible(e)&&/^满\d+件$/.test(e.textContent.trim()))
   if(counts.length!==1)throw new Error('DISCOUNT_COUNT_AMBIGUOUS')
   result.count=Number(counts[0].textContent.trim().slice(1,-1))
  }
 }
 if(target){if(!targets[target])throw new Error('PRICING_TARGET_INVALID');return targets[target]}
 return result
}
export async function executePricing(page,input,{dryRun=true}={}){
 const plan=compilePricingPlan(input),url=page.url(),completed=[],expectedKeys=plan.variants.map(v=>v.key)
 const guard=async()=>{if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page);const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible');if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')}
 const read=async()=>{
  await guard();const pricing=await page.evaluate(resolvePricingDom),rows=await page.evaluate(resolveSkuDom,{expectedKeys})
  if(pricing.count!==plan.multiItemDiscount.count)throw new Error('DISCOUNT_COUNT_MISMATCH')
  if(skuDifferences(plan,rows).length)throw new Error('PRICING_SKU_MISMATCH')
  return {pricing,rows}
 }
 const before=await read()
 if(dryRun)return {status:'pricing_preflight',before,expected:plan,saved:false,published:false,fullProductVerified:false}
 try{
  for(const [key,value] of [['referenceAmountMinor',moneyText(plan.referenceAmountMinor)],['discount',String(plan.multiItemDiscount.discount)]]){
   await read();const handle=await page.evaluateHandle(resolvePricingDom,{target:key}),element=handle.asElement()
   if(!element){await handle.dispose();throw new Error('PRICING_TARGET_NOT_ELEMENT')}
   try{await element.fill(value,{timeout:5000});await element.press('Tab',{timeout:5000})}finally{await handle.dispose()}
   completed.push(key)
  }
  const observed=await read()
  if(parseMoney(observed.pricing.referenceAmountMinor)!==plan.referenceAmountMinor||!/^(?:[5-8](?:\.\d)?|9(?:\.\d)?)$/.test(observed.pricing.discount)||Number(observed.pricing.discount)!==plan.multiItemDiscount.discount)throw new Error('PRICING_READBACK_MISMATCH')
  return {status:'pricing_subset_verified',before,observed,expected:plan,completed,saved:false,published:false,fullProductVerified:false}
 }catch(e){e.partialResult={status:'needs_inspection',reason:e.message,before,completed,saved:false,published:false,fullProductVerified:false};throw e}
}
