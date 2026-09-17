import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileSizePlan,executeSizePlan} from './pdd-size-adapter.mjs'
const input={scope:'pdd-tshirt-size-v1',productCode:'SIZE-TEST',kind:'garment',unit:'cm',rows:[{size:'S',measurements:{shoulderWidth:37.5,chestCircumference:86}},{size:'M',measurements:{shoulderWidth:38.5,chestCircumference:90}}]}
const columns=['肩宽(cm)','胸围(cm)']
function table(selected){return `<div data-testid="beast-core-table"><div data-testid="beast-core-table-middle-header"><table><thead><tr><th>尺码</th>${selected.map(n=>`<th>${n}<label>区间值<input type="checkbox"></label></th>`).join('')}<th>操作</th></tr></thead></table></div><div data-testid="beast-core-table-middle-body"><table><tbody>${['M','S'].map(s=>`<tr><td>${s}</td>${selected.map(()=>'<td><input></td>').join('')}<td>上移下移</td></tr>`).join('')}</tbody></table></div></div>`}
function fixture(selected=columns){return `<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="SIZE-TEST"></div><div data-testid="beast-core-form-item" id="newSpec">${columns.map(n=>`<label data-testid="beast-core-checkbox"><input type="checkbox" ${selected.includes(n)?'checked':''}>${n}</label>`).join('')}<section>${table(selected)}</section><div data-testid="beast-core-table"><table><thead><tr><th>尺码</th><th>肩宽(cm)</th></tr></thead><tbody><tr><td>S</td><td>预览</td></tr></tbody></table></div></div><div data-testid="beast-core-form-item" id="sku"><table><thead><tr>${['颜色分类','尺码','库存','拼单价(元)','单买价(元)','规格编码','状态'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${['S','M'].map(s=>`<tr><td>白色</td><td>${s}</td><td><input value="1"></td><td><input value="1000"></td><td><input value="1001"></td><td><input value="CODE-${s}"></td><td><button data-testid="beast-core-switch">已启用</button></td></tr>`).join('')}</tbody></table></div><button onclick="window.saved=true">保存草稿</button><button onclick="window.published=true">提交并上架</button>`}
let browser
test.before(async()=>{browser=await chromium.launch({headless:true})})
test.after(async()=>{await browser.close()})
async function pageFor(selected){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture(selected)}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('rejects inferred body ranges, invalid measurements and duplicate sizes',()=>{
 for(const changed of [{kind:'body'},{unit:'inch'},{rows:[input.rows[0],input.rows[0]]},{rows:[{size:'S',measurements:{shoulderWidth:0}}]},{rows:[{size:'S',measurements:{height:160}}]}])assert.throws(()=>compileSizePlan({...input,...changed}))
})
test('read-only preflight and semantic fill with reversed rows/columns excludes preview',async()=>{
 const p=await pageFor([...columns].reverse());try{
 assert.equal((await executeSizePlan(p,input)).status,'size_preflight_passed')
 assert.equal(await p.locator('#newSpec tbody input').first().inputValue(),'')
 const r=await executeSizePlan(p,input,{dryRun:false});assert.equal(r.status,'size_subset_verified');assert.equal(r.skuUnchanged,true)
 assert.equal(r.observed.rows.find(r=>r.size==='S').values['胸围(cm)'],'86')
 assert.equal(await p.evaluate(()=>!!window.saved||!!window.published),false)
 }finally{await p.close()}
})
test('selects missing columns on an empty chart then fills',async()=>{
 const p=await pageFor([]);try{
 await p.exposeFunction('renderSize',table)
 await p.evaluate(()=>{for(const label of document.querySelectorAll('#newSpec > label'))label.querySelector('input').onchange=async()=>{const selected=[...document.querySelectorAll('#newSpec > label')].filter(l=>l.querySelector('input').checked).map(l=>l.textContent);document.querySelector('section').innerHTML=await window.renderSize(selected)}})
 const r=await executeSizePlan(p,input,{dryRun:false});assert.equal(r.completed.filter(s=>s.column).length,2)
 }finally{await p.close()}
})
test('range mode, extra row, ambiguous editor and disabled cell stop before writes',async()=>{
 for(const mode of ['range','row','table','disabled']){const p=await pageFor();try{
 await p.evaluate(mode=>{const section=document.querySelector('section');if(mode==='range')section.querySelector('th input').checked=true;if(mode==='row')section.querySelector('tbody').append(section.querySelector('tbody tr').cloneNode(true));if(mode==='table')section.append(section.firstElementChild.cloneNode(true));if(mode==='disabled')section.querySelector('tbody input').disabled=true},mode)
 await assert.rejects(()=>executeSizePlan(p,input,{dryRun:false}),/SIZE_/)
 assert.equal(await p.locator('#newSpec tbody input').first().inputValue(),'')
 }finally{await p.close()}}
})
test('detects changes to an earlier dimension and SKU after blur',async()=>{
 for(const mode of ['dimension','sku']){const p=await pageFor();try{
 await p.evaluate(mode=>{const inputs=[...document.querySelectorAll('section tbody input')];inputs[1].onblur=()=>{if(mode==='sku')document.querySelector('#sku tbody input').value='999';else inputs[2].value='999'}},mode)
 await assert.rejects(()=>executeSizePlan(p,input,{dryRun:false}),e=>e.partialResult.status==='needs_inspection'&&/MISMATCH|SKU_CHANGED/.test(e.message))
 }finally{await p.close()}}
})
test('refuses new columns over existing measurements and a chart inconsistent with SKUs',async()=>{
 for(const mode of ['populated','sku']){const p=await pageFor(mode==='populated'?[columns[0]]:columns);try{
 await p.evaluate(mode=>{if(mode==='populated')document.querySelector('section tbody input').value='37';else document.querySelector('#sku tbody tr td:nth-child(2)').textContent='XL'},mode)
 await assert.rejects(()=>executeSizePlan(p,input,{dryRun:false}),/SIZE_EXISTING_VALUES|SIZE_SKU_ROWSET/)
 }finally{await p.close()}}
})

test('replaces extra columns only on an empty chart without changing sales specifications',async()=>{
 for(const populated of [false,true]){
 const p=await pageFor(['臀围(cm)']);try{
  await p.exposeFunction('renderSize',table)
  await p.evaluate(populated=>{
   const root=document.querySelector('#newSpec'),label=document.createElement('label')
   label.dataset.testid='beast-core-checkbox';label.innerHTML='<input type="checkbox" checked>臀围(cm)';root.prepend(label)
   if(populated)root.querySelector('section tbody input').value='90'
   for(const label of root.querySelectorAll(':scope > label'))label.querySelector('input').onchange=async()=>{const selected=[...root.querySelectorAll(':scope > label')].filter(l=>l.querySelector('input').checked).map(l=>l.textContent);root.querySelector('section').innerHTML=await window.renderSize(selected)}
  },populated)
  if(populated){await assert.rejects(()=>executeSizePlan(p,input,{dryRun:false}),/SIZE_EXISTING_VALUES_BLOCK_COLUMN_CHANGE/);assert.equal(await p.locator('#newSpec section tbody input').first().inputValue(),'90')}
  else {const result=await executeSizePlan(p,input,{dryRun:false});assert.equal(result.status,'size_subset_verified');assert.equal(result.skuUnchanged,true);assert.deepEqual(result.observed.extra,[]);assert.ok(result.completed.some(s=>s.removedColumn==='臀围(cm)'))}
 }finally{await p.close()}
 }
})
