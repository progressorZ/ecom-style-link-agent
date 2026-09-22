import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createBoardShoesServer} from './board-shoes-server.mjs'

async function setup(){
 const root=await mkdtemp(join(tmpdir(),'board-shoes-server-')),app=createBoardShoesServer({root,launch:async()=>{throw new Error('browser should not start')}})
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve))
 const origin=`http://127.0.0.1:${app.server.address().port}`
 const post=(path,body={})=>fetch(origin+'/api/live/'+path,{method:'POST',headers:{origin:'http://127.0.0.1:5173','content-type':'application/json'},body:JSON.stringify(body)})
 return {root,app,origin,post,cleanup:async()=>{await app.close();await rm(root,{recursive:true,force:true})}}
}

test('board-shoes local API persists assets, product sequence and backups',async()=>{
 const fixture=await setup()
 try{
  const state=await(await fetch(fixture.origin+'/api/live/state')).json();assert.equal(state.mode,'board-shoes-draft')
  const first=await(await fixture.post('next-product-code')).json(),second=await(await fixture.post('next-product-code')).json()
  assert.match(first.productCode,/^A\d{8}-001$/);assert.match(second.productCode,/^A\d{8}-002$/)
  const bytes=await readFile(new URL('../examples/test-images/front.png',import.meta.url)),uploaded=await(await fixture.post('assets',{name:'front.png',data:bytes.toString('base64')})).json()
  assert.match(uploaded.assetId,/^[a-f\d-]{36}\.png$/);assert.equal((await fetch(fixture.origin+uploaded.preview)).status,200)
  const status=await(await fixture.post('assets-status',{assetIds:[uploaded.assetId,'00000000-0000-0000-0000-000000000000.jpg']})).json();assert.deepEqual(status.available,[uploaded.assetId]);assert.equal(status.missing.length,1)
  const backup=await(await fetch(fixture.origin+'/api/live/backup')).json();assert.equal(backup.format,'ecom-workbench-backup');assert.ok(backup.entries.some(entry=>entry.path.includes(uploaded.assetId)))
 }finally{await fixture.cleanup()}
})

test('board-shoes option catalog returns empty and can be cleared safely',async()=>{
 const fixture=await setup()
 try{assert.equal((await(await fixture.post('board-shoes-options',{action:'get'})).json()).report,null);assert.equal((await(await fixture.post('board-shoes-options',{action:'clear'})).json()).report,null)}finally{await fixture.cleanup()}
})
