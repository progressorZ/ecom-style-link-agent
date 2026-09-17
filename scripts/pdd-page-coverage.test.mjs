import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {observePageCoverage,assessPageCoverage} from './pdd-page-coverage.mjs'
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
test('visible required field omitted by input is distinct from matched field and unknown region',async()=>{
 const p=await browser.newPage();try{
 await p.setContent('<div data-testid="beast-core-form-item"><span class="Form_itemRequired_fixture">*</span><label>袖长</label><input></div><div data-testid="beast-core-form-item"><label>标题</label><input></div><div data-testid="beast-core-form-item"><label>新字段</label><input></div><div>1个错误项未处理</div>')
 const before=await p.content(),inventory=await p.evaluate(observePageCoverage)
 const coverage=assessPageCoverage(inventory,{fields:[{label:'袖长',key:'sleeve'},{label:'标题',key:'title'}]},[{id:'title',status:'matched'}])
 assert.equal(coverage.entries[0].requiredMarker,true);assert.equal(coverage.entries[0].status,'input_or_reader_missing');assert.equal(coverage.entries[1].status,'reader_present');assert.equal(coverage.entries[2].status,'unmapped_region');assert.deepEqual(coverage.errorSummaries,['1个错误项未处理']);assert.equal(coverage.complete,false);assert.equal(await p.content(),before)
 }finally{await p.close()}
})
test('modal blocks inventory rather than presenting covered stale fields',async()=>{const p=await browser.newPage();try{await p.setContent('<div data-testid="beast-core-modal">建议刷新</div><div data-testid="beast-core-form-item"><label>标题</label><input></div>');const r=await p.evaluate(observePageCoverage);assert.equal(r.status,'blocked_by_modal');assert.deepEqual(r.fields,[])}finally{await p.close()}})

test('service and nested matrix regions map to explicit readers without promoting mismatch to success',()=>{
 const inventory={status:'observed',errorSummaries:[],fields:[{id:'service.goods_type',labels:['商品类型']},{id:'nested-cell',ancestorRegionIds:['newSpec'],labels:[]},{id:'sku',labels:[]},{id:'basic.pack_label_image',labels:['包装标签图']}]}
 const coverage=assessPageCoverage(inventory,{fields:[]},[{id:'services.goodsType',status:'matched'},{id:'sizeChart',status:'mismatch'},{id:'variants',status:'matched'}])
 assert.equal(coverage.entries[0].status,'reader_present');assert.equal(coverage.entries[1].readers[0].status,'mismatch');assert.equal(coverage.entries[1].status,'input_or_reader_missing')
 assert.equal(coverage.entries[2].status,'input_or_reader_missing');assert.equal(coverage.entries[2].readers[1].id,'skuImages')
 assert.equal(coverage.entries[3].status,'unmapped_region');assert.equal(coverage.complete,false)
})
