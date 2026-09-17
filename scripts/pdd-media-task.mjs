import {verifyMediaBindings} from './pdd-media-bindings.mjs'
import {assessMediaReadback} from './pdd-media-readback.mjs'
import {observeCarousel} from './pdd-image-dom.mjs'
import {observeDetail} from './pdd-detail-dom.mjs'
import {resolveSkuDom} from './pdd-sku-dom.mjs'
import {observeShopIdentity,assertShopBinding,readShopHeader} from './pdd-shop-identity.mjs'
import {mkdir,open} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {readBasicField} from './pdd-readback.mjs'
import {executeCarousel} from './pdd-image-adapter.mjs'
import {executeDetailImages} from './pdd-detail-adapter.mjs'
import {executeSkuImages} from './pdd-sku-image-adapter.mjs'
const executors={carousel:executeCarousel,detail:executeDetailImages,skuImages:executeSkuImages}
const statuses={carousel:'carousel_upload_observed',detail:'detail_images_upload_observed',skuImages:'sku_images_upload_observed'}

export function createMediaReceipt(plan,step,editorUrl,result){
 if(result.status!==statuses[step.id]||!Array.isArray(result.completed))throw new Error('MEDIA_UPLOAD_NOT_CONFIRMED')
 const targets=step.id==='skuImages'?step.input.bindings.map(b=>({assetId:b.imageId,target:JSON.stringify([b.color,b.size])})):step.input.images.map((a,i)=>({assetId:a.id,target:String(i+1)}))
 const entries=result.completed.map(c=>({assetId:c.imageId??c.id,target:step.id==='skuImages'?c.key:String(c.position),sha256:c.sha256,remoteUrl:c.remoteUrl}))
 if(entries.length!==targets.length||new Set(entries.map(e=>e.target)).size!==targets.length||entries.some(e=>!targets.some(t=>t.target===e.target&&t.assetId===e.assetId)||!/^[a-f0-9]{64}$/.test(e.sha256)||typeof e.remoteUrl!=='string'||!e.remoteUrl.startsWith('https://')))throw new Error('MEDIA_UPLOAD_RECEIPT_INCOMPLETE')
 return {version:'pdd-media-receipt-v1',sourceHash:plan.sourceHash,executionHash:plan.executionHash,shopKey:plan.identity.shopKey,productCode:plan.identity.productCode,editorUrl,stepId:step.id,createdAt:new Date().toISOString(),entries,contentVerified:false}
}
async function durableWrite(path,value){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2));await f.sync()}finally{await f.close()}}
// Claim is retained on every terminal path. Re-running an unknown browser side
// effect requires reconciliation, never deleting this claim automatically.
export async function runMediaJournal(root,scope,intent,action,{onExisting}={}){
 const base=resolve(root),key=createHash('sha256').update(JSON.stringify(scope)).digest('hex')
 await mkdir(base,{recursive:true});const dir=join(base,key)
 try{await mkdir(dir)}catch(e){if(e.code==='EEXIST'){if(onExisting)return onExisting(dir);throw new Error('MEDIA_TASK_EXISTS_RECONCILE_REQUIRED')};throw e}
 await durableWrite(join(dir,'intent.json'),intent)
 try{const result=await action();await durableWrite(join(dir,'result.json'),result);return {directory:dir,...result}}
 catch(error){await durableWrite(join(dir,'failure.json'),{status:'needs_inspection',reason:error.message,partialResult:error.partialResult??null,mayHaveUploaded:true,saved:false,published:false});throw error}
}
export async function executePackageMedia(page,raw,{stepId,dryRun=true,journalRoot='output/media-tasks',freightProfiles=[],shopBindings}={}){
 const plan=compileProductPackage(raw,{freightProfiles,shopBindings}),step=plan.steps.find(s=>s.id===stepId),url=page.url()
 const binding=plan.bindings.shopBinding
 if(!dryRun&&!binding)throw new Error('SHOP_BINDING_REQUIRED_FOR_WRITE')
 if(!Object.hasOwn(executors,stepId)||!step)throw new Error('MEDIA_STEP_UNSUPPORTED')
 const guard=async()=>{if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page);if(binding&&await page.evaluate(readShopHeader)!==binding.shopName)throw new Error('SHOP_IDENTITY_MISMATCH');if(await page.evaluate(readBasicField,{label:'商品货号'})!==plan.identity.productCode)throw new Error('PRODUCT_CODE_MISMATCH')}
 await guard()
 const shopIdentity=binding?assertShopBinding(await observeShopIdentity(page),binding):null
 await guard()
 if(dryRun)return executors[stepId](page,step.input,{dryRun:true})
 return runMediaJournal(journalRoot,{shopKey:plan.identity.shopKey,editorUrl:url,stepId},{version:'pdd-media-intent-v1',createdAt:new Date().toISOString(),plan,editorUrl:url,stepId,shopIdentity,status:'intent_recorded'},async()=>{
  await guard();assertShopBinding(await observeShopIdentity(page),binding);await guard();const report=await executors[stepId](page,step.input,{dryRun:false})
  let shopIdentityAfter
  try{await guard();shopIdentityAfter=assertShopBinding(await observeShopIdentity(page),binding);await guard()}catch(error){error.partialResult=report;throw error}
  let receipt
  try{receipt=createMediaReceipt(plan,step,url,report)}catch(error){error.partialResult=report;throw error}
  return {status:'media_upload_recorded',shopIdentity,shopIdentityAfter,report,receipt,saved:false,published:false,fullProductVerified:false}
 },{onExisting:async directory=>{
  await guard();assertShopBinding(await observeShopIdentity(page),binding);await guard()
  const {inspectMediaJournal}=await import('./pdd-media-journal-read.mjs')
  const previous=await inspectMediaJournal(directory)
  if(previous.status!=='recorded')throw new Error('MEDIA_PREVIOUS_UPLOAD_INCOMPLETE')
  // Rebind only after checking the exact current targets, file digests and remote URLs.
  // Changes to unrelated product fields must not force an identical image upload.
  const original=previous.receipt
  if(original.shopKey!==plan.identity.shopKey||original.productCode!==plan.identity.productCode||original.editorUrl!==url||original.stepId!==stepId)throw new Error('MEDIA_RECEIPT_SCOPE_MISMATCH')
  const receipt={...original,sourceHash:plan.sourceHash,executionHash:plan.executionHash}
  const observed=stepId==='carousel'?await page.evaluate(observeCarousel):stepId==='detail'?await page.evaluate(observeDetail):await page.evaluate(resolveSkuDom,{includeImages:true,expectedKeys:step.input.bindings.map(b=>JSON.stringify([b.color,b.size]))})
  const structure=assessMediaReadback(step,observed)
  const verified=await verifyMediaBindings({plan,step,editorUrl:url,observed,receipts:[receipt]})
  if(structure.status==='mismatch'||verified.status!=='references_matched')throw new Error('MEDIA_PREVIOUS_UPLOAD_CHANGED')
  await guard();assertShopBinding(await observeShopIdentity(page),binding);await guard()
  return {status:'media_upload_reused',directory,receipt,verification:verified,saved:false,published:false,contentVerified:false}
 }})
}
