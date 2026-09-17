import {collectPublicationResult} from './pdd-publication-result.mjs'
import {withVerifiedNewDraft} from './pdd-draft-write-scope.mjs'
import {compileRepairSteps} from './pdd-repair-plan.mjs'
import {reopenFromDraftList} from './pdd-draft-list.mjs'
import {mkdir,open} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {readbackProductPackage,readBasicField} from './pdd-readback.mjs'
import {observeShopIdentity,assertShopBinding,readShopHeader} from './pdd-shop-identity.mjs'
import {assertBasicScope,assertReadbackScope,executeBasicPlan} from './pdd-basic-adapter.mjs'
import {executeAttributes} from './pdd-attributes.mjs'
import {executeElements} from './pdd-elements.mjs'
import {executeStyle} from './pdd-style.mjs'
import {executeFabric} from './pdd-fabric.mjs'
import {prepareSkuMatrix} from './pdd-matrix-adapter.mjs'
import {executePricing} from './pdd-pricing.mjs'
import {executeSizePlan} from './pdd-size-adapter.mjs'
import {executeSizeSync} from './pdd-size-sync.mjs'
import {executeShipping} from './pdd-shipping-adapter.mjs'
import {executeFreight} from './pdd-freight.mjs'
import {verifyServices} from './pdd-services.mjs'
import {executePackageMedia} from './pdd-media-task.mjs'
const executors={basic:executeBasicPlan,brand:executeAttributes,attributes:executeAttributes,elements:executeElements,style:executeStyle,fabric:executeFabric,matrixAndSku:prepareSkuMatrix,pricing:executePricing,size:executeSizePlan,sizeSync:executeSizeSync,shipping:executeShipping,freight:executeFreight,services:verifyServices}
async function writeOnce(path,value){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2));await f.sync()}finally{await f.close()}}
export async function runSingleJournal(root,scope,action){
 const dir=join(resolve(root),createHash('sha256').update(JSON.stringify(scope)).digest('hex'))
 await mkdir(resolve(root),{recursive:true})
 try{await mkdir(dir)}catch(e){if(e.code==='EEXIST')throw new Error('SINGLE_TASK_EXISTS_INSPECT_BEFORE_RETRY:'+dir);throw e}
 await writeOnce(join(dir,'intent.json'),{...scope,createdAt:new Date().toISOString(),published:false})
 try{const result=await action((name,value)=>writeOnce(join(dir,name+'.json'),value));await writeOnce(join(dir,'result.json'),result);return {...result,directory:dir}}
 catch(e){await writeOnce(join(dir,'failure.json'),{status:'needs_inspection',reason:e.message,partialResult:e.partialResult??null,published:false,retryAllowed:false});throw e}
}
export async function expandServiceSection(page){
 const expand=page.getByText('展开修改',{exact:true})
 if(await expand.count()>1)throw new Error('SERVICE_EXPAND_AMBIGUOUS')
 if(await expand.count()===1&&await expand.isVisible())await expand.click()
}
export function assertDraftReadback(report){
 if(report.shopIdentity?.status!=='matched'||!Array.isArray(report.checks)||!report.checks.length)throw new Error('DRAFT_IDENTITY_OR_READBACK_MISSING')
 if(new Set(report.checks.map(c=>c.id)).size!==report.checks.length||report.checks.some(c=>!['matched','unverified'].includes(c.status)))throw new Error('DRAFT_READBACK_HAS_DIFFERENCES')
 // Incomplete drafts may be stored for review. Never turn this into publication approval.
 for(const check of report.checks){
  if(check.status==='matched'&&(!Object.hasOwn(check,'expected')||!Object.hasOwn(check,'observed')||JSON.stringify(check.expected)!==JSON.stringify(check.observed)))throw new Error('DRAFT_CHECK_INCONSISTENT')
  if(check.status==='unverified'&&(!['carousel','skuImages','detail'].includes(check.id)||check.differences?.length))throw new Error('DRAFT_UNVERIFIED_FIELD_UNSUPPORTED')
 }
 if(report.coverage?.errorSummaries?.length)throw new Error('DRAFT_PAGE_ERRORS')
}
export async function runSingleWorkflow(page,raw,options,settings={}){
 const action=settings.action??'inspect'
 if(!['inspect','reopen-draft','publication-result','fill','repair','save-draft'].includes(action))throw new Error('SINGLE_ACTION_UNSUPPORTED')
 if(['repair','save-draft'].includes(action)&&/[?&]type=edit(?:&|$)/.test(page.url())){
  const plan=compileProductPackage(raw,options)
  if(!plan.bindings.shopBinding)throw new Error('SHOP_BINDING_REQUIRED')
  return withVerifiedNewDraft(page,plan.bindings.shopBinding,()=>runSingleWorkflowInternal(page,raw,options,settings))
 }
 return runSingleWorkflowInternal(page,raw,options,settings)
}
async function runSingleWorkflowInternal(page,raw,options,{action='inspect',journalRoot='output/single-tasks',onProgress=()=>{}}={}){
 const source=structuredClone(raw),context=structuredClone(options),plan=compileProductPackage(source,context),url=page.url(),binding=plan.bindings.shopBinding
 if(!binding)throw new Error('SHOP_BINDING_REQUIRED')
 const guard=async(allowBlank=false)=>{
  if(page.url()!==url)throw new Error('PAGE_CHANGED')
  await (['inspect','reopen-draft','publication-result'].includes(action)?assertReadbackScope:assertBasicScope)(page)
  if(await page.evaluate(readShopHeader)!==binding.shopName)throw new Error('SHOP_IDENTITY_MISMATCH')
  const code=await page.evaluate(readBasicField,{label:'商品货号'})
  if(code!==plan.identity.productCode&&!(allowBlank&&code===''))throw new Error('PRODUCT_CODE_MISMATCH')
 }
 await guard(action==='fill')
 assertShopBinding(await observeShopIdentity(page),binding)
 const read=async target=>{await expandServiceSection(target);return readbackProductPackage(target,source,context)}
 if(action==='publication-result'){
  const result=await collectPublicationResult(page.context(),{editorUrl:url,shopBinding:binding,onProgress})
  return {...result,saved:false}
 }
 if(action==='reopen-draft'){
  const reopened=await reopenFromDraftList(page.context(),{editorUrl:url,shopBinding:binding,onProgress})
  const report=await read(reopened.page)
  return {status:'draft_reopened_needs_review',draftEvidence:reopened.evidence,reopenedUrl:reopened.page.url(),report,saved:false,published:false}
 }
 if(action==='inspect')return {status:'inspected',report:await read(page),saved:false,published:false}
 if(action==='repair'){
  const before=await read(page),repair=compileRepairSteps(plan,before)
  if(!repair.steps.length)return {status:'no_supported_differences',report:before,repair,saved:false,published:false}
  const stateHash=createHash('sha256').update(JSON.stringify(before.checks.map(c=>({id:c.id,status:c.status,observed:c.observed})))).digest('hex')
  return runSingleJournal(journalRoot,{version:'pdd-repair-v1',editorUrl:url,executionHash:plan.executionHash,stateHash},async record=>{
   await record('before',before);await record('repair-plan',repair)
   for(const step of repair.steps){
    await guard();onProgress({step:'repair-'+step.id})
    await record('step-'+step.id,await executors[step.id](page,step.input,{dryRun:false}))
   }
   await guard();const report=await read(page)
   return {status:'repaired_needs_review',repair,report,saved:false,published:false,fullProductVerified:false}
  })
 }
 return runSingleJournal(journalRoot,{version:'pdd-single-task-v1',action,editorUrl:url,shopKey:binding.shopKey,executionHash:plan.executionHash,...(action==='fill'?{attemptId:randomUUID()}:{})},async record=>{
  await record('plan',plan)
  if(action==='fill'){
   await expandServiceSection(page)
   for(const [index,step] of plan.steps.entries()){
    await guard(step.id==='basic');onProgress({step:step.id,index:index+1,total:plan.steps.length})
    let result
    if(['carousel','skuImages','detail'].includes(step.id)){
     result=await executePackageMedia(page,source,{...context,stepId:step.id,dryRun:false,journalRoot:join(journalRoot,'media')})
     context.mediaReceipts=[...(context.mediaReceipts??[]),result.receipt]
    }else{
     if(!executors[step.id])throw new Error('SINGLE_STEP_UNSUPPORTED:'+step.id)
     result=await executors[step.id](page,step.input,{dryRun:false})
    }
    await record(`step-${String(index).padStart(2,'0')}-${step.id}`,result)
    if(result.status==='services_mismatch'){const error=new Error('SERVICES_REQUIRE_MANUAL_CORRECTION:'+JSON.stringify(result.differences));error.partialResult=result;throw error}
    await guard()
   }
   assertShopBinding(await observeShopIdentity(page),binding)
   const report=await read(page);await record('readback-context',context)
   return {status:'filled_needs_review',report,saved:false,published:false,fullProductVerified:false}
  }
  return saveAndReopenDraft(page,{read,guard,record,onProgress,productCode:plan.identity.productCode,reopen:()=>reopenFromDraftList(page.context(),{editorUrl:url,shopBinding:binding,onProgress})})
 })
}

export async function saveAndReopenDraft(page,{read,guard,record,onProgress=()=>{},productCode,reopen}){
 const url=page.url()
  const before=await read(page);await record('before',before);assertDraftReadback(before)
  await guard()
  if(await page.getByRole('heading',{name:'保存成功!',exact:true}).count())throw new Error('DRAFT_STALE_SUCCESS_DIALOG')
  const button=page.getByRole('button',{name:'保存草稿',exact:true})
  if(await button.count()!==1||!await button.isEnabled())throw new Error('DRAFT_SAVE_BUTTON_UNAVAILABLE')
  await record('save-intent',{editorUrl:url,productCode:productCode,published:false})
  try{
   await button.click()
   await page.getByRole('heading',{name:'保存成功!',exact:true}).waitFor({state:'visible',timeout:20000})
   await guard();await record('save-observed',{saved:true,published:false,message:'保存成功!',observedAt:new Date().toISOString()})
  }catch(e){e.partialResult={saved:'unknown',published:false,saveClicks:1};throw e}
  let reopened
  try{
   onProgress({step:'reopen-and-readback'})
   if(reopen){const result=await reopen();reopened=result.page;await record('draft-list-evidence',result.evidence)}
   else{reopened=await page.context().newPage();await reopened.goto(url,{waitUntil:'domcontentloaded'})}
   await reopened.getByRole('button',{name:'保存草稿',exact:true}).waitFor({state:'visible',timeout:20000})
   const after=await read(reopened);await record('reopened',after)
   if(before.sourceHash!==after.sourceHash||before.executionHash!==after.executionHash)throw new Error('DRAFT_INPUT_CHANGED')
   assertDraftReadback(after)
   return {status:'draft_saved_reopened_needs_review',saved:true,reopened:true,reopenedUrl:reopened.url(),report:after,published:false,fullProductVerified:false,mediaContentVerified:false}
  }catch(e){e.partialResult={saved:true,reopenedUrl:reopened?.url()??null,published:false};throw e}

}
