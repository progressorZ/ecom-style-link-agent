import {editorIdentity,reopenFromDraftList} from './pdd-draft-list.mjs'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {readbackProductPackage} from './pdd-readback.mjs'

export function recoveryReference(job,plan){
 if(!job||job.status==='running')throw new Error('RECOVERY_ORIGINAL_TASK_NOT_STOPPED')
 if(!['fill','repair','save-draft','reopen-draft','inspect','recover-draft'].includes(job.action))throw new Error('RECOVERY_ACTION_UNSUPPORTED')
 if(job.sourceHash!==plan.sourceHash||job.executionHash!==plan.executionHash)throw new Error('RECOVERY_INPUT_CHANGED_RELOAD_ORIGINAL')
 const identity=editorIdentity(job.editorUrl)
 return {sourceJobId:job.id,editorUrl:job.editorUrl,...identity}
}
// Reconciliation reads current persisted state. Finding a draft does not prove
// that an interrupted save wrote the latest values, nor authorize another save.
export async function reconcileDraft(context,raw,options,{reference,onProgress=()=>{},openDraft=reopenFromDraftList,read=readbackProductPackage}={}){
 const input=structuredClone(raw),config=structuredClone(options),plan=compileProductPackage(input,config)
 if(!plan.bindings.shopBinding)throw new Error('SHOP_BINDING_REQUIRED')
 editorIdentity(reference.editorUrl)
 onProgress({step:'reconcile-draft'})
 const {page,evidence}=await openDraft(context,{editorUrl:reference.editorUrl,shopBinding:plan.bindings.shopBinding,onProgress})
 const expand=page.getByText('展开修改',{exact:true})
 if(await expand.count()>1)throw new Error('SERVICE_EXPAND_AMBIGUOUS')
 if(await expand.count()===1&&await expand.isVisible())await expand.click()
 const report=await read(page,input,config)
 if(report.sourceHash!==plan.sourceHash||report.executionHash!==plan.executionHash)throw new Error('RECOVERY_REPORT_INPUT_MISMATCH')
 const differences=report.checks.filter(c=>!['matched','unverified'].includes(c.status))
 return {status:differences.length?'draft_reconciled_with_differences':'draft_reconciled_needs_review',reference,draftEvidence:evidence,report,reopenedUrl:page.url(),draftExists:true,saved:false,saveExecuted:false,published:false,originalSaveConfirmed:false,fullProductVerified:false,retryAllowed:false}
}
