// Structural checks are not proof of asset identity or visual content.
export function assessMediaReadback(step,observed){
 const differences=[]
 if(step.id==='skuImages'){
  const expectedKeys=step.input.bindings.map(b=>JSON.stringify([b.color,b.size]))
  const keys=observed.map(r=>r.key)
  if(new Set(keys).size!==keys.length||keys.length!==expectedKeys.length||keys.some(k=>!expectedKeys.includes(k)))differences.push({field:'rowset',expected:expectedKeys,observed:keys})
  for(const b of step.input.bindings){const key=JSON.stringify([b.color,b.size]),row=observed.find(r=>r.key===key);if(!row?.image?.src)differences.push({field:'skuImage',key,expectedAssetId:b.imageId,observed:row?.image?.src??null})}
 }else{
  const count=step.input.images.length
  if(observed.count!==count||observed.images.length!==count)differences.push({field:'count',expected:count,observed:observed.count,visibleImages:observed.images.length})
  observed.images.forEach((image,index)=>{if(!image.src||image.pending||image.loaded===false)differences.push({field:'imageReady',position:index+1,observed:image})})
 }
 return {id:step.id,status:differences.length?'mismatch':'unverified',expected:step.input,observed,differences,reason:'asset_remote_binding_and_content_verification_required',contentVerified:false}
}
