import {editorIdentity} from './pdd-draft-list.mjs'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'

// Receipts must originate in the upload worker. This verifier does not establish
// their authenticity, shop authorization, or visual equivalence of transformed images.
export async function verifyMediaBindings({plan,step,editorUrl,observed,receipts}){
 if(!Array.isArray(receipts))throw new Error('MEDIA_RECEIPTS_INVALID')
 const matching=receipts.filter(r=>r?.stepId===step.id)
 if(!matching.length)return {status:'missing',differences:[],reason:'upload_receipt_missing'}
 if(matching.length!==1)throw new Error('MEDIA_RECEIPT_AMBIGUOUS')
 const receipt=structuredClone(matching[0])
 let sameEditor=receipt.editorUrl===editorUrl
 if(!sameEditor){try{sameEditor=JSON.stringify(editorIdentity(receipt.editorUrl))===JSON.stringify(editorIdentity(editorUrl))}catch{}}
 const reopenedEditor=sameEditor&&receipt.editorUrl!==editorUrl
 if(receipt.version!=='pdd-media-receipt-v1'||receipt.sourceHash!==plan.sourceHash||receipt.executionHash!==plan.executionHash||receipt.shopKey!==plan.identity.shopKey||receipt.productCode!==plan.identity.productCode||!sameEditor||!Array.isArray(receipt.entries))throw new Error('MEDIA_RECEIPT_SCOPE_MISMATCH')
 const targets=step.id==='skuImages'?step.input.bindings.map(b=>({assetId:b.imageId,target:JSON.stringify([b.color,b.size])})):step.input.images.map((a,i)=>({assetId:a.id,target:String(i+1)}))
 if(receipt.entries.length!==targets.length||new Set(receipt.entries.map(e=>e?.target)).size!==targets.length)throw new Error('MEDIA_RECEIPT_TARGETS_INVALID')
 const digests=new Map(),differences=[]
 for(const target of targets){
  const entry=receipt.entries.find(e=>e.target===target.target)
  if(!entry||entry.assetId!==target.assetId||typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256)||typeof entry.remoteUrl!=='string'||!entry.remoteUrl.startsWith('https://'))throw new Error('MEDIA_RECEIPT_ENTRY_INVALID')
  if(!digests.has(target.assetId)){
   const asset=step.input.images.find(a=>a.id===target.assetId)
   if(!asset)throw new Error('MEDIA_SOURCE_ASSET_MISSING')
   digests.set(target.assetId,createHash('sha256').update(await readFile(asset.path)).digest('hex'))
  }
  if(digests.get(target.assetId)!==entry.sha256)differences.push({target:target.target,field:'sourceSha256',expected:entry.sha256,observed:digests.get(target.assetId)})
  const url=step.id==='skuImages'?observed.find(r=>r.key===target.target)?.image?.src:observed.images[Number(target.target)-1]?.src
  if(url!==entry.remoteUrl)differences.push({target:target.target,field:'remoteUrl',expected:entry.remoteUrl,observed:url??null})
 }
 const referenceChangesOnly=reopenedEditor&&differences.length>0&&differences.every(d=>d.field==='remoteUrl'&&d.observed)
 return {status:differences.length?(referenceChangesOnly?'references_changed':'mismatch'):'references_matched',differences,sourceDigests:Object.fromEntries(digests),contentVerified:false}
}
