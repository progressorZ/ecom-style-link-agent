import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {resolveShippingDom} from './pdd-shipping-dom.mjs'
export function compileShippingPlan(input){
 if(input?.scope!=='pdd-tshirt-shipping-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||input.productCode.trim()!==input.productCode||![24,48].includes(input.shipmentHours))throw new Error('SHIPPING_PLAN_INVALID')
 if(Object.keys(input).some(k=>!['scope','productCode','shipmentHours'].includes(k)))throw new Error('SHIPPING_FIELD_UNSUPPORTED')
 return Object.freeze({scope:input.scope,productCode:input.productCode,shipmentHours:input.shipmentHours})
}
export async function executeShipping(page,input,{dryRun=true}={}){
 const plan=compileShippingPlan(input),url=page.url()
 const read=async()=>{
  if(page.url()!==url)throw new Error('PAGE_CHANGED')
  await assertBasicScope(page)
  const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
  if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
  const state=await page.evaluate(resolveShippingDom)
  if(!state.options.some(o=>o.name===`${plan.shipmentHours}小时发货及揽收`&&!o.disabled))throw new Error('SHIPPING_TARGET_UNAVAILABLE')
  return state
 }
 const before=await read(),expected=`${plan.shipmentHours}小时发货及揽收`
 if(dryRun)return {status:'shipping_preflight_passed',expected:plan,before,willChange:before.selected!==expected,saved:false,published:false,fullProductVerified:false}
 let changed=false
 try{
  const current=await read()
  if(current.selected!==expected){
   const handle=await page.evaluateHandle(resolveShippingDom,{targetHours:plan.shipmentHours})
   try{const el=handle.asElement();if(!el)throw new Error('SHIPPING_TARGET_MISSING');await el.click({timeout:5000});changed=true}finally{await handle.dispose()}
  }
  const observed=await read()
  if(observed.selected!==expected)throw new Error('SHIPPING_READBACK_MISMATCH')
  const final=await read()
  if(final.selected!==expected)throw new Error('SHIPPING_FINAL_MISMATCH')
  return {status:'shipping_subset_verified',expected:plan,before,observed:final,changed,saved:false,published:false,fullProductVerified:false,unverified:['freightTemplate','otherServicePromises','wholeForm','persistence']}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,changed,interactionMayHaveOccurred:true,saved:false,published:false,fullProductVerified:false};throw error}
}
