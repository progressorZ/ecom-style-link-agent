import {readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createMediaReceipt} from './pdd-media-task.mjs'
const read=async path=>{try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
// Read-only reconciliation aid. Never releases a claim or restarts an upload.
export async function inspectMediaJournal(directory){
 const dir=resolve(directory)
 const intent=await read(join(dir,'intent.json'))
 if(!intent)return {directory:dir,status:'unknown',reason:'intent_missing',retryAllowed:false}
 const failure=await read(join(dir,'failure.json')),result=await read(join(dir,'result.json'))
 if(failure)return {directory:dir,status:'needs_inspection',reason:failure.reason,failure,retryAllowed:false}
 if(!result)return {directory:dir,status:'unknown',reason:'result_missing_may_be_running_or_interrupted',retryAllowed:false}
 const step=intent.plan?.steps?.find(s=>s.id===intent.stepId)
 if(result.status!=='media_upload_recorded'||!step)throw new Error('MEDIA_JOURNAL_RESULT_INVALID')
 const regenerated=createMediaReceipt(intent.plan,step,intent.editorUrl,result.report)
 const {createdAt:ignored,...expected}=regenerated
 const {createdAt:recordedAt,...actual}=result.receipt??{}
 if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('MEDIA_JOURNAL_RECEIPT_MISMATCH')
 return {directory:dir,status:'recorded',receipt:result.receipt,retryAllowed:false,contentVerified:false}
}
