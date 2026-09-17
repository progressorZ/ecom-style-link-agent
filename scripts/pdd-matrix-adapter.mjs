import {compileSkuPlan,compileSkuPlanFromPackage,executeSkuPlan} from './pdd-sku-adapter.mjs'
import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
import {resolveMatrixDom} from './pdd-matrix-dom.mjs'

export function compileMatrixPlan(input){
  const sku=input?.schemaVersion?compileSkuPlanFromPackage(input):compileSkuPlan({...input,scope:input?.scope==='pdd-tshirt-matrix-v1'?'pdd-tshirt-sku-v1':null})
  const system=input.schemaVersion?(input.listing.sizeConfiguration?.system==='cn'?'中国码':null):input.sizeSystem
  if(system!=='中国码')throw new Error('SIZE_SYSTEM_UNSUPPORTED')
  const colors=[...new Set(sku.variants.map(v=>v.color))],sizes=[...new Set(sku.variants.map(v=>v.size))]
  if(colors.length*sizes.length!==sku.variants.length)throw new Error('SPARSE_MATRIX_UNSUPPORTED')
  return Object.freeze({scope:'pdd-tshirt-matrix-v1',sizeSystem:system,colors:Object.freeze(colors),sizes:Object.freeze(sizes),sku})
}
const sameSet=(a,b)=>a.length===b.length&&new Set(a).size===a.length&&a.every(v=>b.includes(v))
export function assessMatrix(plan,current){
  if(current.colorPanelCount)throw new Error('CLOSE_EXISTING_COLOR_PANEL')
  const chosen=current.sizes.filter(s=>s.checked).map(s=>s.name)
  if(sameSet(current.colors,plan.colors)&&sameSet(chosen,plan.sizes)&&sameSet(current.system,[plan.sizeSystem]))return {reuse:true,addColors:[],addSizes:[]}
  if(current.hasSkuData||current.hasSizeData)throw new Error('EXISTING_VALUES_BLOCK_MATRIX_CHANGE')
  if(current.colors.some(c=>!plan.colors.includes(c)) || chosen.some(s=>!plan.sizes.includes(s)))throw new Error('EXTRA_SPECIFICATIONS_BLOCK_MATRIX_CHANGE')
  if(!sameSet(current.system,[plan.sizeSystem])&&(chosen.length||current.colors.length))throw new Error('SIZE_SYSTEM_CHANGE_REQUIRES_EMPTY_SPECIFICATIONS')
  if(sameSet(current.system,[plan.sizeSystem]) && plan.sizes.some(s=>!current.sizes.some(o=>o.name===s&&!o.disabled)))throw new Error('SIZE_OPTION_MISSING_OR_DISABLED')
  return {reuse:false,addColors:plan.colors.filter(c=>!current.colors.includes(c)),addSizes:plan.sizes.filter(s=>!chosen.includes(s))}
}
export function validateColorOptions(colors,menu){
  if(!menu.colorOptions.length)throw new Error('COLOR_OPTIONS_NOT_READABLE')
  for(const color of colors){
    const matches=menu.colorOptions.filter(o=>o.name===color)
    const code=matches.length===0?'COLOR_OPTION_MISSING':matches.length>1?'COLOR_OPTION_AMBIGUOUS':matches[0].disabled?'COLOR_OPTION_DISABLED':null
    if(code)throw new Error(code+':'+JSON.stringify({color,available:[...new Set(menu.colorOptions.filter(o=>!o.disabled).map(o=>o.name))]}))
  }
}
export async function executeMatrixPlan(page,input,{dryRun=true}={}){
  const plan=compileMatrixPlan(input),url=page.url(),steps=[]
  const guard=async()=>{if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page);const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible');if(await code.count()!==1||await code.inputValue()!==plan.sku.productCode)throw new Error('PRODUCT_CODE_MISMATCH')}
  const read=async()=>{await guard();return page.evaluate(resolveMatrixDom)}
  const before=await read(),assessment=assessMatrix(plan,before)
  if(dryRun)return {status:'matrix_preflight_passed',plan,assessment,before,unverified:assessment.reuse?[]:['colorOptions','postSystemSizeOptions','generatedRows'],saved:false,published:false}
  const click=async args=>{await guard();const live=await page.evaluate(resolveMatrixDom);if(live.hasSkuData||live.hasSizeData)throw new Error('VALUES_APPEARED_DURING_MATRIX_CHANGE');const h=await page.evaluateHandle(resolveMatrixDom,args);try{const e=h.asElement();if(!e)throw new Error('MATRIX_TARGET_MISSING');await e.click({timeout:5000})}finally{await h.dispose()}}
  try{
    if(!assessment.reuse){
      if(!sameSet(before.system,[plan.sizeSystem])){await click({target:'system'});steps.push('system');const s=await read();if(!sameSet(s.system,[plan.sizeSystem]))throw new Error('SYSTEM_READBACK_MISMATCH')}
      const afterSystem=await read()
      if(plan.sizes.some(s=>!afterSystem.sizes.some(o=>o.name===s&&!o.disabled)))throw new Error('SIZE_OPTION_MISSING_OR_DISABLED')
      if(assessment.addColors.length){
        await click({target:'emptyColor'})
        const menu=await read()
        if(menu.colorPanelCount!==1||menu.colorOptions.some(o=>o.selected))throw new Error('COLOR_PANEL_NOT_EMPTY')
        validateColorOptions(assessment.addColors,menu)
        for(const color of assessment.addColors){await click({target:'color',color});const checked=(await read()).colorOptions.filter(o=>o.name===color);if(checked.length!==1||!checked[0].selected)throw new Error('COLOR_SELECTION_NOT_CONFIRMED')}
        const selected=(await read()).colorOptions.filter(o=>o.selected).map(o=>o.name)
        if(!sameSet(selected,assessment.addColors))throw new Error('COLOR_SELECTION_MISMATCH')
        await click({target:'confirmColors'});steps.push('colors')
        if(!sameSet((await read()).colors,plan.colors))throw new Error('COLORS_READBACK_MISMATCH')
      }
      for(const size of assessment.addSizes){await click({target:'size',size});steps.push(`size:${size}`);if(!(await read()).sizes.some(o=>o.name===size&&o.checked))throw new Error('SIZE_READBACK_MISMATCH')}
    }
    const after=await read()
    if(!sameSet(after.colors,plan.colors)||!sameSet(after.sizes.filter(s=>s.checked).map(s=>s.name),plan.sizes)||!sameSet(after.system,[plan.sizeSystem]))throw new Error('MATRIX_READBACK_MISMATCH')
    const rows=await page.evaluate(resolveSkuDom,{expectedKeys:plan.sku.variants.map(v=>v.key)})
    // Matrix creation must not silently discard data of an existing matrix.
    return {status:'matrix_verified',steps,rows,plan:plan.sku,saved:false,published:false,fullProductVerified:false}
  }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,steps,before,saved:false,published:false,fullProductVerified:false};throw error}
}
export async function prepareSkuMatrix(page,input,{dryRun=true}={}){
  const matrix=await executeMatrixPlan(page,input,{dryRun})
  if(dryRun)return matrix
  try{return {matrix,sku:await executeSkuPlan(page,matrix.plan,{dryRun:false}),saved:false,published:false,fullProductVerified:false,status:'matrix_and_sku_verified'}}
  catch(error){error.partialResult={...error.partialResult,matrix};throw error}
}
