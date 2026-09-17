import test from 'node:test'
import assert from 'node:assert/strict'
import {assessMediaReadback} from './pdd-media-readback.mjs'
const step={id:'detail',input:{images:[{id:'a',path:'a.png'}]}}
test('same count and ready remote image never proves source identity',()=>{
 const r=assessMediaReadback(step,{count:1,images:[{src:'https://example.test/unknown.png',loaded:true}]})
 assert.equal(r.status,'unverified');assert.equal(r.contentVerified,false)
})
test('extra images, missing image nodes and pending upload remain mismatches',()=>{
 for(const observed of [{count:2,images:[{src:'a'},{src:'b'}]},{count:1,images:[]},{count:1,images:[{src:null,pending:true,loaded:false}]}])assert.equal(assessMediaReadback(step,observed).status,'mismatch')
})
test('SKU identity uses color-size keys and requires every intended binding including disabled rows',()=>{
 const sku={id:'skuImages',input:{bindings:[{color:'白色',size:'S',imageId:'a'},{color:'白色',size:'M',imageId:'a'}]}}
 const rows=[{key:'["白色","M"]',image:{src:null}},{key:'["白色","S"]',image:{src:'https://example.test/a'}}]
 const r=assessMediaReadback(sku,rows);assert.equal(r.status,'mismatch');assert.equal(r.differences[0].key,'["白色","M"]')
 rows[0].image.src='https://example.test/b';assert.equal(assessMediaReadback(sku,rows).status,'unverified')
})
