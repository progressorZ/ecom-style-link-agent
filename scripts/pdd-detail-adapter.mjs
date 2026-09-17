import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {observeDetail} from './pdd-detail-dom.mjs'
import {compileImagePlan,prepareImageFiles,imageManifest} from './pdd-image-plan.mjs'
export function compileDetailPlan(input){
 if(input?.scope!=='pdd-tshirt-detail-images-v1')throw new Error('DETAIL_PLAN_INVALID')
 const assets=compileImagePlan({...input,scope:'pdd-tshirt-carousel-v1'})
 return Object.freeze({scope:input.scope,productCode:assets.productCode,assets})
}
export async function executeDetailImages(page,input,{dryRun=true,baseDir,timeout=30000}={}){
 const plan=compileDetailPlan(input),url=page.url()
 await assertBasicScope(page)
 const before=await page.evaluate(observeDetail)
 if(before.count||before.images.length||!before.emptyEditorConfirmed)throw new Error('DETAIL_EXISTING_CONTENT')
 const {files}=await prepareImageFiles(plan.assets,page.context(),{baseDir})
 return uploadPreparedDetail(page,plan,files,{dryRun,timeout,initialUrl:url})
}
export async function uploadPreparedDetail(page,plan,files,{dryRun=true,timeout=30000,initialUrl=page.url()}={}){
 const completed=[]
 const read=async()=>{
  if(page.url()!==initialUrl)throw new Error('PAGE_CHANGED')
  await assertBasicScope(page)
  const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
  if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
  return page.evaluate(observeDetail)
 }
 const before=await read()
 if(before.count||before.images.length||!before.emptyEditorConfirmed)throw new Error('DETAIL_EXISTING_CONTENT')
 if(dryRun)return {status:'detail_images_preflight_passed',manifest:imageManifest(files),uploaded:false,saved:false,published:false,fullProductVerified:false}
 const prefix=state=>state.images.length>=completed.length&&completed.every((c,i)=>state.images[i].src===c.remoteUrl)
 try{
  for(const file of files){
   const current=await read()
   if(current.count!==completed.length||current.images.length!==completed.length||!prefix(current))throw new Error('DETAIL_CHANGED')
   await page.locator('.quick-decoration-container-v2 [class*="quick_decoration_v2_sortableWrapper__"] input[type=file][data-tracking-click-viewid=detail_img_localfile_upload]').setInputFiles({name:file.name,mimeType:file.mime,buffer:file.buffer},{timeout:5000})
   const deadline=Date.now()+timeout
   let after,ready=false
   while(Date.now()<deadline){
    after=await read()
    if(!prefix(after)||after.count>completed.length+1||after.images.length>completed.length+1)throw new Error('DETAIL_ORDER_CHANGED')
    const last=after.images.at(-1)
    ready=after.count===completed.length+1&&after.images.length===after.count&&last.loaded&&/^https:\/\/(?:pfs\.pinduoduo\.com|img\.pddpic\.com)\//.test(last.src)
    if(ready)break
    await page.waitForTimeout(200)
   }
   if(!ready)throw new Error('DETAIL_UPLOAD_TIMEOUT')
   completed.push({id:file.id,sha256:file.sha256,position:completed.length+1,remoteUrl:after.images.at(-1).src})
  }
  const observed=await read()
  if(observed.count!==files.length||observed.images.length!==files.length||!prefix(observed)||observed.images.some(i=>!i.loaded))throw new Error('DETAIL_FINAL_MISMATCH')
  return {status:'detail_images_upload_observed',manifest:imageManifest(files),completed,observed,uploaded:true,contentVerified:false,saved:false,published:false,fullProductVerified:false}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,completed,uploadMayHaveCompleted:true,saved:false,published:false,fullProductVerified:false};throw error}
}
