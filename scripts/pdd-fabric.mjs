import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {resolveAttributeDom} from './pdd-attributes.mjs'
export function compileFabricPlan(input){
 if(input?.scope!=='pdd-tshirt-fabric-v1'||!['productCode','fabricName','material','composition'].every(k=>typeof input[k]==='string'&&input[k].trim()===input[k]&&input[k].length)||Object.keys(input).some(k=>!['scope','productCode','fabricName','material','composition'].includes(k)))throw new Error('FABRIC_PLAN_INVALID')
 return Object.freeze({...input})
}
export async function executeFabric(page,input,{dryRun=true}={}){
 const plan=compileFabricPlan(input),url=page.url(),completed=[]
 const guard=async()=>{
 if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page)
 const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
 if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
 }
 const read=async(label,allowReadOnly=false)=>{await guard();if(await page.locator('[role=listbox]:visible').count())throw new Error('FABRIC_CLOSE_EXISTING_POPUP');return (await page.evaluate(resolveAttributeDom,{label,allowReadOnly})).value}
 const before={fabricName:await read('重要面料俗称')}
 for(const [key,label] of [['material','材质'],['composition','成分含量']]){
  const labels=page.locator('label:visible').filter({hasText:new RegExp(`^${label}$`)})
  if(await labels.count())before[key]=await read(label,key==='material')
 }
 if(dryRun)return {status:'fabric_preflight_passed',before,expected:plan,deferred:['dependentFieldAppearance','materialDerivation','compositionOptions'],saved:false,published:false,fullProductVerified:false}
 const select=async(label,value)=>{
  if(await read(label)===value)return
  const h=await page.evaluateHandle(resolveAttributeDom,{label,target:true})
  try{await h.asElement().click({timeout:5000})}finally{await h.dispose()}
  await guard();const panel=page.locator('[role=listbox]:visible');await panel.waitFor({state:'visible',timeout:5000})
  const option=panel.getByRole('option',{name:value,exact:true})
  if(await panel.count()!==1||await option.count()!==1||await option.getAttribute('data-disabled')==='true'||await option.getAttribute('aria-disabled')==='true')throw new Error('FABRIC_OPTION_UNAVAILABLE')
  await option.click({timeout:5000});await panel.waitFor({state:'hidden',timeout:5000})
  if(await read(label)!==value)throw new Error('FABRIC_READBACK_MISMATCH')
  completed.push(label)
 }
 try{
  await select('重要面料俗称',plan.fabricName)
  for(const label of ['材质','成分含量'])await page.locator('label').filter({hasText:new RegExp(`^${label}$`)}).waitFor({state:'visible',timeout:5000})
  if(await read('材质',true)!==plan.material)throw new Error('FABRIC_DERIVED_MATERIAL_MISMATCH')
  await select('成分含量',plan.composition)
  const observed={fabricName:await read('重要面料俗称'),material:await read('材质',true),composition:await read('成分含量')}
  if(['fabricName','material','composition'].some(k=>observed[k]!==plan[k]))throw new Error('FABRIC_FINAL_MISMATCH')
  return {status:'fabric_subset_verified',before,expected:plan,observed,completed,saved:false,published:false,fullProductVerified:false}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,completed,saved:false,published:false,fullProductVerified:false};throw error}
}
