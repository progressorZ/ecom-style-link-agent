import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {observeCarousel} from './pdd-image-dom.mjs'
import {prepareImageFiles,imageManifest} from './pdd-image-plan.mjs'

export async function preflightCarousel(page,input,options={}){
  const initialUrl=page.url()
  const guard=async()=>{
    if(page.url()!==initialUrl)throw new Error('PAGE_CHANGED')
    await assertBasicScope(page)
    const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
    if(await code.count()!==1||await code.inputValue()!==input.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
    const state=await page.evaluate(observeCarousel)
    if(state.count!==0||state.images.length!==0)throw new Error('CAROUSEL_EXISTING_IMAGES')
    if(state.capacity!==10)throw new Error('CAROUSEL_CAPACITY_CHANGED')
    return state
  }
  await guard()
  const {plan,files}=await prepareImageFiles(input,page.context(),options)
  const before=await guard()
  return {status:'carousel_preflight_passed',scope:plan.scope,productCode:plan.productCode,manifest:imageManifest(files),before,uploaded:false,saved:false,published:false,fullProductVerified:false,unverified:['uploadCompletion','remoteAssetIdentity','imageOrder','persistence']}
}

// Accepts files already decoded by prepareImageFiles; buffers pin the validated bytes.
export async function uploadPreparedCarousel(page,{plan,files},{timeout=30000}={}){
  const initialUrl=page.url(),completed=[]
  const read=async()=>{
    if(page.url()!==initialUrl)throw new Error('PAGE_CHANGED')
    await assertBasicScope(page)
    const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
    if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
    const state=await page.evaluate(observeCarousel)
    if(state.capacity!==10)throw new Error('CAROUSEL_CAPACITY_CHANGED')
    return state
  }
  const before=await read()
  if(before.count||before.images.length)throw new Error('CAROUSEL_EXISTING_IMAGES')
  // Main image was observed to undergo AI processing; later images retain PFS URLs.
  const readyUrl=url=>/^https:\/\/img\.pddpic\.com\/aid-image\/aid-sr\//.test(url||'')||(completed.length>0&&/^https:\/\/pfs\.pinduoduo\.com\//.test(url||''))
  const prefix=state=>state.images.slice(0,completed.length).every((image,i)=>image.src===completed[i].remoteUrl)
  try{
    for(const file of files){
      const state=await read()
      if(state.count!==completed.length||state.images.length!==completed.length||!prefix(state))throw new Error('CAROUSEL_CHANGED')
      const input=page.locator('[data-testid="beast-core-form-item"][id="basic.carousel_gallery"] input[type="file"][data-tracking-click-viewid="carousel_img_localfile_upload"]')
      await input.setInputFiles({name:file.name,mimeType:file.mime,buffer:file.buffer},{timeout:5000})
      // Poll observations, never retry the upload itself: a timeout may already have created an asset.
      const deadline=Date.now()+timeout
      let after
      while(Date.now()<deadline){
        after=await read()
        if(!prefix(after)||after.count>completed.length+1||after.images.length>completed.length+1)throw new Error('CAROUSEL_ORDER_CHANGED')
        if(after.count===completed.length+1&&after.images.length===after.count&&readyUrl(after.images.at(-1).src))break
        await page.waitForTimeout(200)
      }
      if(after?.count!==completed.length+1||after.images.length!==after.count||!readyUrl(after.images.at(-1)?.src))throw new Error('CAROUSEL_UPLOAD_TIMEOUT')
      completed.push({id:file.id,sha256:file.sha256,position:completed.length+1,remoteUrl:after.images.at(-1).src})
    }
    const observed=await read()
    if(observed.count!==files.length||observed.images.length!==files.length||!prefix(observed))throw new Error('CAROUSEL_FINAL_MISMATCH')
    return {status:'carousel_upload_observed',manifest:imageManifest(files),completed,observed,uploaded:true,contentVerified:false,saved:false,published:false,fullProductVerified:false}
  }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,completed,uploaded:completed.length>0,uploadMayHaveCompleted:true,saved:false,published:false,fullProductVerified:false};throw error}
}
export async function executeCarousel(page,input,options={}){
  if(options.dryRun!==false)return preflightCarousel(page,input,options)
  // Validate the page before reading assets, then pin and decode bytes before uploading.
  await preflightCarousel(page,input,options)
  const prepared=await prepareImageFiles(input,page.context(),options)
  return uploadPreparedCarousel(page,prepared,options)
}
