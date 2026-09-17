// Only deterministic text/enum fields are eligible. Never treat unverified media
// as an instruction to upload it again, and never change product identity.
export function compileRepairSteps(plan,report){
 if(report.sourceHash!==plan.sourceHash||report.executionHash!==plan.executionHash)throw new Error('REPAIR_REPORT_INPUT_CHANGED')
 if(!Array.isArray(report.checks)||new Set(report.checks.map(c=>c.id)).size!==report.checks.length)throw new Error('REPAIR_CHECKS_INVALID')
 const changes=report.checks.filter(c=>c.status==='mismatch'),handled=new Set(),steps=[]
 for(const step of plan.steps.filter(s=>['basic','brand','attributes'].includes(s.id))){
  const fields=step.input.fields.filter(f=>{
   if(f.key==='product.productCode')return false
   const check=changes.find(c=>c.id===f.key)
   if(!check)return false
   if(check.expected!==f.value||typeof check.observed!=='string')throw new Error('REPAIR_FIELD_EVIDENCE_INVALID:'+f.key)
   handled.add(f.key);return true
  })
  if(fields.length)steps.push({...step,input:{...step.input,fields}})
 }
 return {steps,changedFields:[...handled],manualChecks:report.checks.filter(c=>['mismatch','unreadable','uncovered'].includes(c.status)&&!handled.has(c.id)).map(c=>c.id)}
}
