import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {verifyMediaBindings} from './pdd-media-bindings.mjs'
let dir,base
const digest=createHash('sha256').update('original-file').digest('hex')
test.before(async()=>{dir=await mkdtemp(join(tmpdir(),'pdd-receipt-'));await writeFile(join(dir,'a.png'),'original-file');base={plan:{sourceHash:'source-v1',executionHash:'execution-v1',identity:{shopKey:'shop1',productCode:'TEST'}},step:{id:'carousel',input:{images:[{id:'a',path:join(dir,'a.png')}]}},editorUrl:'https://mms.pinduoduo.com/goods/goods_add/index?type=add&id=1',observed:{images:[{src:'https://example.test/remote.png'}]}}})
test.after(async()=>rm(dir,{recursive:true,force:true}))
const receipt=()=>({version:'pdd-media-receipt-v1',sourceHash:'source-v1',executionHash:'execution-v1',shopKey:'shop1',productCode:'TEST',editorUrl:base.editorUrl,stepId:'carousel',entries:[{assetId:'a',target:'1',sha256:digest,remoteUrl:'https://example.test/remote.png'}]})
test('valid scope, file hash and remote reference match without claiming visual verification',async()=>{const r=await verifyMediaBindings({...base,receipts:[receipt()]});assert.equal(r.status,'references_matched');assert.equal(r.contentVerified,false);assert.equal((await verifyMediaBindings({...base,receipts:[]})).status,'missing')})
test('cross-shop, stale version, another editor and duplicate receipts cannot match',async()=>{
 for(const key of ['shopKey','sourceHash','executionHash','productCode','editorUrl']){const r=receipt();r[key]='different';await assert.rejects(()=>verifyMediaBindings({...base,receipts:[r]}),/SCOPE_MISMATCH/)}
 await assert.rejects(()=>verifyMediaBindings({...base,receipts:[receipt(),receipt()]}),/AMBIGUOUS/)
})
test('same file path with replaced contents and changed remote references are detected',async()=>{
 await writeFile(join(dir,'a.png'),'changed');try{const r=await verifyMediaBindings({...base,observed:{images:[{src:'https://example.test/other.png'}]},receipts:[receipt()]});assert.equal(r.status,'mismatch');assert.deepEqual(r.differences.map(d=>d.field),['sourceSha256','remoteUrl'])}finally{await writeFile(join(dir,'a.png'),'original-file')}
})
test('same draft reopened in edit mode keeps changed image URLs pending visual review',async()=>{
 const r=receipt();r.editorUrl=base.editorUrl+'&goods_id=34'
 const editorUrl='https://mms.pinduoduo.com/goods/goods_add/index?id=1&goods_id=34&type=edit'
 const result=await verifyMediaBindings({...base,editorUrl,receipts:[r],observed:{images:[{src:'https://example.test/transcoded.jpeg'}]}})
 assert.equal(result.status,'references_changed');assert.equal(result.contentVerified,false);assert.equal(result.differences[0].field,'remoteUrl')
 await assert.rejects(()=>verifyMediaBindings({...base,editorUrl:editorUrl.replace('goods_id=34','goods_id=35'),receipts:[r]}),/SCOPE_MISMATCH/)
})
