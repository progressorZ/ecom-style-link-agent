import test from 'node:test'
import assert from 'node:assert/strict'
import {createReview,reviewItems} from './pdd-review.mjs'
const plan={sourceHash:'s',executionHash:'e'}
const job={id:'job',productCode:'P',createdAt:'2026-09-10T00:00:00Z',status:'completed',result:{report:{...plan,shopIdentity:{status:'matched'},checks:[{id:'title',status:'matched'}],blockers:[{reason:'media_content_unverified'}]}}}
const data={decision:'accepted',confirmations:Object.fromEntries(reviewItems.map(k=>[k,true]))}
test('review retains system blockers and binds the exact report without granting publication',()=>{
 const r=createReview(job,data,plan)
 assert.equal(r.reportHash.length,64);assert.deepEqual(r.systemBlockers,job.result.report.blockers);assert.equal(r.fullProductVerified,false);assert.equal(r.publicationAuthorized,false)
})
test('input changes, later writes, unchecked facts and mismatches prevent acceptance',()=>{
 assert.throws(()=>createReview(job,data,{...plan,sourceHash:'changed'}),/INPUT_CHANGED/)
 assert.throws(()=>createReview(job,data,plan,[{id:'later',productCode:'P',createdAt:'2026-09-10T01:00:00Z',action:'fill'}]),/LATER_WRITE/)
 assert.throws(()=>createReview(job,{decision:'accepted'},plan),/CONFIRMATIONS/)
 const bad=structuredClone(job);bad.result.report.checks[0].status='mismatch';assert.throws(()=>createReview(bad,data,plan),/DIFFERENCES/)
})
test('rejection requires a correction note',()=>{
 assert.throws(()=>createReview(job,{decision:'rejected'},plan),/REASON/)
 assert.equal(createReview(job,{decision:'rejected',note:'主图颜色不准确'},plan).decision,'rejected')
})
