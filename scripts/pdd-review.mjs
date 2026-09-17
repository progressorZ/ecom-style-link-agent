import {createHash} from 'node:crypto'
export const reviewItems=['productAndImages','priceStockAndSizes','logisticsAndServices','brandAndQualifications']
export function createReview(job,data,plan,jobs=[]){
 const report=job?.result?.report
 if(job?.status!=='completed'||!report||!plan)throw new Error('REVIEW_REPORT_REQUIRED')
 if(report.sourceHash!==plan.sourceHash||report.executionHash!==plan.executionHash)throw new Error('REVIEW_INPUT_CHANGED_RECHECK')
 if(jobs.some(j=>j.id!==job.id&&j.productCode===job.productCode&&['fill','repair','save-draft'].includes(j.action)&&j.createdAt>job.createdAt))throw new Error('REVIEW_LATER_WRITE_RECHECK')
 if(!['accepted','rejected'].includes(data.decision))throw new Error('REVIEW_DECISION_INVALID')
 const note=typeof data.note==='string'?data.note.trim():''
 if(note.length>2000)throw new Error('REVIEW_NOTE_TOO_LONG')
 if(data.decision==='accepted'){
  if(report.shopIdentity?.status!=='matched'||!report.checks?.length||report.checks.some(c=>!['matched','unverified'].includes(c.status))||report.coverage?.errorSummaries?.length)throw new Error('REVIEW_DIFFERENCES_REQUIRE_CORRECTION')
  if(!reviewItems.every(k=>data.confirmations?.[k]===true))throw new Error('REVIEW_CONFIRMATIONS_REQUIRED')
 }else if(!note)throw new Error('REVIEW_REJECTION_REASON_REQUIRED')
 return {decision:data.decision,note,confirmations:Object.fromEntries(reviewItems.map(k=>[k,data.confirmations?.[k]===true])),jobId:job.id,sourceHash:report.sourceHash,executionHash:report.executionHash,reportHash:createHash('sha256').update(JSON.stringify(report)).digest('hex'),reviewedAt:new Date().toISOString(),actor:'local_operator',systemBlockers:report.blockers??[],fullProductVerified:false,publicationAuthorized:false}
}
