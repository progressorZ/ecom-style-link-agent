import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
import {prepareImageFiles,imageManifest,compileImagePlan} from './pdd-image-plan.mjs'

export function compileSkuImagePlan(input){
  if(input?.scope!=='pdd-tshirt-sku-images-v1'||!Array.isArray(input.bindings)||!input.bindings.length)throw new Error('SKU_IMAGE_PLAN_INVALID')
  // Assets are unique; bindings may explicitly reuse one image for multiple sizes.
  const assets=compileImagePlan({scope:'pdd-tshirt-carousel-v1',productCode:input.productCode,images:input.images})
  const ids=new Set(assets.images.map(i=>i.id)),keys=new Set(),used=new Set()
  const bindings=input.bindings.map(b=>{
    if(!['color','size','imageId'].every(k=>typeof b?.[k]==='string'&&b[k].trim()===b[k]&&b[k].length))throw new Error('SKU_IMAGE_BINDING_INVALID')
    const key=JSON.stringify([b.color,b.size])
    if(keys.has(key)||!ids.has(b.imageId))throw new Error('SKU_IMAGE_BINDING_INVALID')
    keys.add(key);used.add(b.imageId)
    return Object.freeze({key,color:b.color,size:b.size,imageId:b.imageId})
  })
  if(used.size!==ids.size)throw new Error('SKU_IMAGE_UNUSED_ASSET')
  return Object.freeze({scope:input.scope,productCode:assets.productCode,assets,bindings:Object.freeze(bindings)})
}
export async function executeSkuImages(page,input,{dryRun=true,baseDir,timeout=30000}={}){
  const plan=compileSkuImagePlan(input),initialUrl=page.url()
  const read=async()=>{
    if(page.url()!==initialUrl)throw new Error('PAGE_CHANGED')
    await assertBasicScope(page)
    const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
    if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
    return page.evaluate(resolveSkuDom,{includeImages:true})
  }
  const before=await read()
  for(const b of plan.bindings){const row=before.find(r=>r.key===b.key);if(!row||row.image.src||!row.image.uploadAvailable)throw new Error('SKU_IMAGE_TARGET_NOT_EMPTY:'+b.key)}
  const prepared=await prepareImageFiles(plan.assets,page.context(),{baseDir,allowShared:true})
  return executePreparedSkuImages(page,plan,prepared.files,before,{dryRun,timeout,initialUrl})
}
// Internal execution core; the public entrypoint validates and decodes all assets first.
export async function executePreparedSkuImages(page,plan,files,before,{dryRun=true,timeout=30000,initialUrl=page.url()}={}){
  const expectedKeys=before.map(r=>r.key),completed=[],baseline=JSON.stringify(before.map(r=>({key:r.key,values:r.values})).sort((a,b)=>a.key.localeCompare(b.key)))
  const expectedImages=new Map(before.map(r=>[r.key,r.image.src]))
  const read=async()=>{
    if(page.url()!==initialUrl)throw new Error('PAGE_CHANGED')
    await assertBasicScope(page)
    const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
    if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
    const rows=await page.evaluate(resolveSkuDom,{includeImages:true,expectedKeys})
    if(JSON.stringify(rows.map(r=>({key:r.key,values:r.values})).sort((a,b)=>a.key.localeCompare(b.key)))!==baseline)throw new Error('SKU_IMAGE_VALUES_CHANGED')
    return rows
  }
  const preserve=(rows,active)=>{if(rows.some(r=>r.key!==active&&r.image.src!==expectedImages.get(r.key)))throw new Error('SKU_IMAGE_OTHER_ROW_CHANGED')}
  const current=await read();preserve(current)
  for(const b of plan.bindings){const row=current.find(r=>r.key===b.key);if(!row||row.image.src||!row.image.uploadAvailable||files.filter(f=>f.id===b.imageId).length!==1)throw new Error('SKU_IMAGE_TARGET_NOT_EMPTY')}
  if(dryRun)return {status:'sku_images_preflight_passed',manifest:imageManifest(files),bindings:plan.bindings,saved:false,published:false,uploaded:false,fullProductVerified:false}
  try{
    for(const binding of plan.bindings){
      const rows=await read();preserve(rows)
      const target=rows.find(r=>r.key===binding.key)
      if(target.image.src||!target.image.uploadAvailable)throw new Error('SKU_IMAGE_TARGET_CHANGED')
      const file=files.find(f=>f.id===binding.imageId)
      const handle=await page.evaluateHandle(resolveSkuDom,{expectedKeys,includeImages:true,target:{key:binding.key,field:'image'}})
      try{const el=handle.asElement();if(!el)throw new Error('SKU_IMAGE_INPUT_MISSING');await el.setInputFiles({name:file.name,mimeType:file.mime,buffer:file.buffer},{timeout:5000})}finally{await handle.dispose()}
      const deadline=Date.now()+timeout
      let url
      while(Date.now()<deadline){const after=await read();preserve(after,binding.key);url=after.find(r=>r.key===binding.key).image.src;if(url&&/^https:\/\/(?:pfs\.pinduoduo\.com|img\.pddpic\.com)\//.test(url))break;await page.waitForTimeout(200)}
      if(!url||!/^https:\/\/(?:pfs\.pinduoduo\.com|img\.pddpic\.com)\//.test(url))throw new Error('SKU_IMAGE_UPLOAD_TIMEOUT')
      expectedImages.set(binding.key,url);completed.push({key:binding.key,imageId:binding.imageId,sha256:file.sha256,remoteUrl:url})
    }
    const observed=await read();preserve(observed)
    return {status:'sku_images_upload_observed',manifest:imageManifest(files),completed,observed:observed.map(r=>({key:r.key,image:r.image})),skuValuesUnchanged:true,contentVerified:false,saved:false,published:false,uploaded:true,fullProductVerified:false}
  }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,completed,uploadMayHaveCompleted:true,saved:false,published:false,fullProductVerified:false};throw error}
}
