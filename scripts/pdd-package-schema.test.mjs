import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {assertProductPackageSchema} from './pdd-package-schema.mjs'
import {compileProductPackage} from './pdd-package-plan.mjs'
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/product-package-tshirt.json',import.meta.url)))
test('runtime schema accepts fixture without mutating input or adding defaults',()=>{
 const raw=fixture(),before=structuredClone(raw);assertProductPackageSchema(raw);assert.deepEqual(raw,before)
})
test('unknown structural fields, malformed date and explicit null service cannot silently compile',()=>{
 for(const change of [p=>p.listing.inventoryConfirmedAt='yesterday',p=>p.listing.services=null,p=>p.listing.pricing.typoPrice=10,p=>p.product.attributes=null,p=>delete p.product.name]){
  const raw=fixture();change(raw);assert.throws(()=>compileProductPackage(raw),e=>e.message==='PACKAGE_SCHEMA_INVALID'&&e.validationErrors.length>0)
 }
})
test('schema does not coerce stock strings and reports safe field paths',()=>{
 const raw=fixture();raw.listing.offers[0].stock='1';assert.throws(()=>assertProductPackageSchema(raw),e=>e.validationErrors.some(x=>x.path==='/listing/offers/0/stock'&&x.keyword==='type'))
 assert.equal(raw.listing.offers[0].stock,'1')
})
test('unmapped attribute remains visible and blocking with escaped pointer path',()=>{
 const raw=fixture();raw.product.attributes['supplier/color~code']='P-1'
 const plan=compileProductPackage(raw)
 assert.ok(plan.attributeCoverage.some(x=>x.path==='/product/attributes/supplier~1color~0code'&&x.status==='unhandled'))
 assert.ok(plan.blockers.some(x=>x.path==='/product/attributes/supplier~1color~0code'&&x.reason==='attribute_not_mapped'))
 assert.equal(plan.executable,false)
})
