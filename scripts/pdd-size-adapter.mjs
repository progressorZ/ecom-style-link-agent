import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
import {resolveSizeDom} from './pdd-size-dom.mjs'

const measurementLabels={height:'身高(cm)',weight:'体重(kg)',shoulderWidth:'肩宽(cm)',chestCircumference:'胸围(cm)',waistCircumference:'腰围(cm)',hipCircumference:'臀围(cm)'}
export function compileSizePlan(input){
  if(input?.scope!=='pdd-tshirt-size-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||!['garment','body_recommendation'].includes(input.kind)||input.unit!==(input.kind==='garment'?'cm':'mixed')||!Array.isArray(input.rows)||!input.rows.length)throw new Error('SIZE_PLAN_INVALID')
  const keys=Object.keys(input.rows[0]?.measurements||{})
  if(!keys.length||keys.some(k=>!measurementLabels[k]||(['height','weight'].includes(k)!==(input.kind==='body_recommendation'))))throw new Error('SIZE_MEASUREMENT_UNSUPPORTED')
  const seen=new Set()
  const rows=input.rows.map(r=>{
    if(typeof r.size!=='string'||!r.size.trim()||r.size!==r.size.trim()||seen.has(r.size))throw new Error('SIZE_IDENTITY_INVALID')
    seen.add(r.size)
    if(!r.measurements||Object.keys(r.measurements).length!==keys.length)throw new Error('SIZE_MEASUREMENTS_INCOMPLETE')
    const values={}
    for(const k of keys){
      const v=r.measurements[k],range=v!==null&&typeof v==='object',first=input.rows[0].measurements[k]
      if(range!==(first!==null&&typeof first==='object'))throw new Error('SIZE_RANGE_MODE_INCONSISTENT')
      const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=300&&/^\d+(\.\d)?$/.test(String(n))
      if(range){if(Object.keys(v).length!==2||!valid(v.min)||!valid(v.max)||v.min>v.max)throw new Error('SIZE_VALUE_INVALID');values[measurementLabels[k]]={min:String(v.min),max:String(v.max)}}
      else {if(!valid(v))throw new Error('SIZE_VALUE_INVALID');values[measurementLabels[k]]=String(v)}
    }
    return Object.freeze({size:r.size,values:Object.freeze(values)})
  })
  return Object.freeze({scope:input.scope,productCode:input.productCode,columns:Object.freeze(keys.map(k=>measurementLabels[k])),rows:Object.freeze(rows)})
}
export function sizeDifferences(plan,state){return plan.rows.flatMap(r=>Object.entries(r.values).filter(([k,v])=>{const a=state.rows.find(x=>x.size===r.size)?.values[k];return typeof v==='object'?(!a||typeof a!=='object'||!a.min?.trim()||!a.max?.trim()||Number(a.min)!==Number(v.min)||Number(a.max)!==Number(v.max)):(typeof a!=='string'||!a.trim()||Number(a)!==Number(v))}).map(([measurement,expected])=>({size:r.size,measurement,expected,observed:state.rows.find(x=>x.size===r.size)?.values[measurement]??null})))}
export async function executeSizePlan(page,input,{dryRun=true}={}){
  const plan=compileSizePlan(input),initialUrl=page.url(),args={allowExtra:true,columns:plan.columns,sizes:plan.rows.map(r=>r.size)}
  const guard=async()=>{
    if(page.url()!==initialUrl)throw new Error('PAGE_CHANGED')
    await assertBasicScope(page)
    const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
    if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
  }
  const read=async()=>{await guard();return page.evaluate(resolveSizeDom,args)}
  const skuSnapshot=async()=>{
    const rows=await page.evaluate(resolveSkuDom,{})
    const skuSizes=[...new Set(rows.map(r=>r.size))]
    if(skuSizes.length!==args.sizes.length||skuSizes.some(s=>!args.sizes.includes(s)))throw new Error('SIZE_SKU_ROWSET_MISMATCH')
    return JSON.stringify(rows.map(r=>({key:r.key,values:r.values})).sort((a,b)=>a.key.localeCompare(b.key)))
  }
  const before=await read(),skuBefore=await skuSnapshot(),completed=[]
  const allowColumns=state=>{if((state.missing.length||state.extra.length)&&state.rows.some(r=>Object.values(r.values).some(v=>typeof v==='object'?v.min!==''||v.max!=='':v!=='')))throw new Error('SIZE_EXISTING_VALUES_BLOCK_COLUMN_CHANGE')}
  allowColumns(before)
  const unchanged=async()=>{if(await skuSnapshot()!==skuBefore)throw new Error('SIZE_SKU_CHANGED')}
  if(dryRun)return {status:'size_preflight_passed',before,expected:plan,missingColumns:before.missing,extraColumns:before.extra,saved:false,published:false,fullProductVerified:false}
  const act=async(target,value)=>{
    const handle=await page.evaluateHandle(resolveSizeDom,{...args,target})
    try{const el=handle.asElement();if(!el)throw new Error('SIZE_TARGET_NOT_ELEMENT');if(target.column||target.rangeColumn)await el.click({timeout:5000});else{await el.fill(value,{timeout:5000});await el.press('Tab',{timeout:5000})}}finally{await handle.dispose()}
  }
  try{
    for(const column of before.missing){const state=await read();allowColumns(state);await unchanged();if(!state.missing.includes(column))throw new Error('SIZE_COLUMNS_CHANGED');await act({column});const after=await read();await unchanged();if(after.missing.includes(column))throw new Error('SIZE_COLUMN_READBACK');completed.push({column})}
    // Add desired columns first so the platform never needs an empty selection.
    for(const column of before.extra){
      const state=await read();allowColumns(state);await unchanged()
      if(!state.extra.includes(column))throw new Error('SIZE_COLUMNS_CHANGED')
      await act({column});const after=await read();await unchanged()
      if(after.selected.includes(column))throw new Error('SIZE_COLUMN_READBACK')
      completed.push({removedColumn:column})
    }
    for(const column of plan.columns){
      const state=await read(),wanted=typeof plan.rows[0].values[column]==='object'
      if(state.ranges[column]!==wanted){
        if(state.rows.some(r=>Object.values(r.values).some(v=>typeof v==='object'?v.min!==''||v.max!=='':v!=='')))throw new Error('SIZE_EXISTING_VALUES_BLOCK_RANGE_CHANGE')
        await unchanged();await act({rangeColumn:column});const after=await read();await unchanged();if(after.ranges[column]!==wanted)throw new Error('SIZE_RANGE_READBACK_MISMATCH')
      }
    }
    for(const row of plan.rows)for(const [measurement,value] of Object.entries(row.values)){
      const state=await read();await unchanged();if(state.missing.length||state.extra.length)throw new Error('SIZE_COLUMNS_MISSING')
      if(typeof value==='object'){await act({size:row.size,measurement,bound:'min'},value.min);await read();await unchanged();await act({size:row.size,measurement,bound:'max'},value.max)}else await act({size:row.size,measurement},value)
      const observed=await read();await unchanged()
      if(sizeDifferences({rows:[{size:row.size,values:{[measurement]:value}}]},observed).length)throw new Error('SIZE_READBACK_MISMATCH')
      completed.push({size:row.size,measurement})
    }
    const observed=await read(),differences=sizeDifferences(plan,observed);await unchanged()
    if(differences.length||observed.missing.length||observed.extra.length)throw new Error('SIZE_FINAL_READBACK_MISMATCH')
    return {status:'size_subset_verified',expected:plan,observed,completed,differences,skuUnchanged:true,saved:false,published:false,fullProductVerified:false}
  }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,completed,saved:false,published:false,fullProductVerified:false};throw error}
}
