import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileElementsPlan,executeElements} from './pdd-elements.mjs'
const plan={scope:'pdd-tshirt-elements-v1',productCode:'MULTI-TEST',values:['纯色','口袋']}
function setup(){
 window.values=['条纹','印花','字母'];const root=document.querySelector('#multi'),input=root.querySelector('input')
 const render=()=>{root.querySelectorAll('[data-testid=beast-core-tagGroup-tag]').forEach(e=>e.remove());for(const value of window.values){const tag=document.createElement('span');tag.dataset.testid='beast-core-tagGroup-tag';tag.textContent=value;root.prepend(tag)}if(document.querySelector('[role=listbox]'))open()}
 const open=()=>{document.querySelector('[role=listbox]')?.remove();const ul=document.createElement('ul');ul.setAttribute('role','listbox');for(const value of ['条纹','印花','字母','纯色','口袋']){const li=document.createElement('li');li.setAttribute('role','option');li.textContent=value;li.dataset.checked=String(window.values.includes(value));li.dataset.disabled=String(window.values.length===3&&!window.values.includes(value));li.onclick=()=>{if(window.corrupt)return;window.values=window.values.includes(value)?window.values.filter(v=>v!==value):[...window.values,value];render()};ul.append(li)}document.body.append(ul)}
 input.onclick=open;document.querySelector('#label').onclick=()=>document.querySelector('[role=listbox]')?.remove();render()
}
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="MULTI-TEST"></div><div data-testid="beast-core-form-item"><label id="label">重要流行元素</label><div id="multi" data-testid="beast-core-select"><span class="ST_selectValueMultiple_fixture"><input data-testid="beast-core-select-htmlInput"></span></div>最多可勾选3个</div><script>(${setup.toString()})()</script>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('removes old full selection before adding and compares sets independently of order',async()=>{const p=await pageFor();try{const pre=await executeElements(p,plan);assert.equal(pre.remove.length,3);const r=await executeElements(p,plan,{dryRun:false});assert.equal(r.status,'elements_subset_verified');assert.deepEqual([...r.observed.values].sort(),[...plan.values].sort());assert.equal((await executeElements(p,plan,{dryRun:false})).completed.length,0)}finally{await p.close()}})
test('missing target options are rejected before any removal',async()=>{const p=await pageFor();try{await assert.rejects(()=>executeElements(p,{...plan,values:['不存在']},{dryRun:false}),/OPTION_MISSING/);assert.deepEqual(await p.evaluate(()=>window.values),['条纹','印花','字母'])}finally{await p.close()}})
test('ignoring a click is detected',async()=>{const p=await pageFor();try{await p.evaluate(()=>window.corrupt=true);await assert.rejects(()=>executeElements(p,plan,{dryRun:false}),/READBACK_MISMATCH/)}finally{await p.close()}})
test('rejects duplicate or over-limit requests',()=>{for(const values of [['纯色','纯色'],['1','2','3','4']])assert.throws(()=>compileElementsPlan({...plan,values}),/INVALID/)})
