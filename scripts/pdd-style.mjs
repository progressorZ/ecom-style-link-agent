import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {resolveAttributeDom} from './pdd-attributes.mjs'
export function compileStylePlan(input){
 if(input?.scope!=='pdd-tshirt-style-v1'||!['productCode','primaryStyle','secondaryStyle'].every(k=>typeof input[k]==='string'&&input[k].trim()===input[k]&&input[k].length)||Object.keys(input).some(k=>!['scope','productCode','primaryStyle','secondaryStyle'].includes(k)))throw new Error('STYLE_PLAN_INVALID')
 return Object.freeze({...input})
}
export async function executeStyle(page,input,{dryRun=true}={}){
 const plan=compileStylePlan(input),url=page.url(),completed=[]
 const guard=async()=>{
 if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page)
 const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
 if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
 }
 const read=async(label,allowReadOnly=false)=>{await guard();if(await page.locator('[role=listbox]:visible').count())throw new Error('STYLE_CLOSE_EXISTING_POPUP');return (await page.evaluate(resolveAttributeDom,{label,allowReadOnly})).value}
 const before={primaryStyle:await read('重要主风格')}
 for(const [key,label] of [['secondaryStyle','风格']]){
  const labels=page.locator('label:visible').filter({hasText:new RegExp(`^${label}$`)})
  if(await labels.count())before[key]=await read(label,false)
 }
 if(dryRun)return {status:'style_preflight_passed',before,expected:plan,deferred:['dependentFieldAppearance','secondaryOptions'],saved:false,published:false,fullProductVerified:false}
 const select=async(label,value,force=false)=>{
  if(await read(label)===value&&!force)return
  const h=await page.evaluateHandle(resolveAttributeDom,{label,target:true})
  try{await h.asElement().click({timeout:5000})}finally{await h.dispose()}
  await guard();const panel=page.locator('[role=listbox]:visible');await panel.waitFor({state:'visible',timeout:5000})
  const option=panel.getByRole('option',{name:value,exact:true})
  if(await panel.count()!==1||await option.count()!==1||await option.getAttribute('data-disabled')==='true'||await option.getAttribute('aria-disabled')==='true')throw new Error('STYLE_OPTION_UNAVAILABLE')
  await option.click({timeout:5000});await panel.waitFor({state:'hidden',timeout:5000})
  if(await read(label)!==value)throw new Error('STYLE_READBACK_MISMATCH')
  completed.push(label)
 }
 try{
  await select('重要主风格',plan.primaryStyle)
  for(const label of ['风格'])await page.locator('label').filter({hasText:new RegExp(`^${label}$`)}).waitFor({state:'visible',timeout:5000})
  await select('风格',plan.secondaryStyle,before.primaryStyle!==plan.primaryStyle)
  const observed={primaryStyle:await read('重要主风格'),secondaryStyle:await read('风格')}
  if(['primaryStyle','secondaryStyle'].some(k=>observed[k]!==plan[k]))throw new Error('STYLE_FINAL_MISMATCH')
  return {status:'style_subset_verified',before,expected:plan,observed,completed,saved:false,published:false,fullProductVerified:false}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,completed,saved:false,published:false,fullProductVerified:false};throw error}
}
