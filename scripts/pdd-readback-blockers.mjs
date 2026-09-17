// Diagnostic reduction of compile-time live checks. This is not a publication gate
// and must only consume the current independently collected readback report.
export function assessReadbackBlockers(plan,checks,shopIdentity) {
 const matched=id=>{
  const entries=checks.filter(c=>c.id===id)
  return entries.length===1&&entries[0].status==='matched'&&Object.hasOwn(entries[0],'expected')&&Object.hasOwn(entries[0],'observed')&&
   JSON.stringify(entries[0].expected)===JSON.stringify(entries[0].observed)
 }
 const services=plan.steps.find(s=>s.id==='services')
 const evidence={
  pricing_live_readback_required:['listing.pricing'],
  freight_live_readback_required:['listing.logistics.freight'],
  size_detail_sync_live_readback_required:['listing.sizeConfiguration.syncChartToDetail'],
  inventory_deduction_unverified:['services.inventoryDeduction'],
  services_live_readback_required:services?Object.keys(services.input.expected).map(k=>'services.'+k):[]
 }
 const binding=plan.bindings.shopBinding
 const shopMatched=binding&&shopIdentity?.status==='matched'&&['platform','shopKey','mallId','shopName'].every(k=>shopIdentity[k]===binding[k])
 const blockers=[],resolvedBlockers=[]
 for(const blocker of plan.blockers){
  const ids=evidence[blocker.reason]
  const resolved=blocker.reason==='live_shop_identity_unverified'?shopMatched:ids?.length>0&&ids.every(matched)
  if(resolved)resolvedBlockers.push({...blocker,evidence:ids??['shopIdentity']})
  else blockers.push(blocker)
 }
 return {blockers,resolvedBlockers}
}
