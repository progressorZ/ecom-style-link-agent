import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileFabricPlan,executeFabric} from './pdd-fabric.mjs'
const plan={scope:'pdd-tshirt-fabric-v1',productCode:'FABRIC-TEST',fabricName:'棉',material:'棉',composition:'95%及以上'}
function setup(){
 const field=(label,value='',locked=false)=>{const div=document.createElement('div');div.dataset.testid='beast-core-form-item';div.innerHTML='<label>'+label+'</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header"><input data-testid="beast-core-select-htmlInput"></div></div>';const input=div.querySelector('input');input.value=value;input.disabled=locked;input.readOnly=locked;input.onclick=()=>{input.value='';const ul=document.createElement('ul');ul.setAttribute('role','listbox');const li=document.createElement('li');li.setAttribute('role','option');li.textContent=label==='重要面料俗称'?'棉':'95%及以上';li.onclick=()=>{input.value=li.textContent;ul.remove();if(label==='重要面料俗称')setTimeout(()=>{field('材质',window.wrongMaterial?'麻':'棉',true);field('成分含量')},50);else if(window.corrupt)document.querySelector('input:disabled').value='麻'};ul.append(li);document.body.append(ul)};document.body.append(div)}
 field('重要面料俗称')
}
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="FABRIC-TEST"></div><script>(${setup.toString()})()</script>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('waits for dependent fields and reads locked material without writing it',async()=>{const p=await pageFor();try{assert.equal((await executeFabric(p,plan)).before.fabricName,'');const r=await executeFabric(p,plan,{dryRun:false});assert.equal(r.observed.material,'棉');assert.equal(r.observed.composition,'95%及以上');assert.equal(await p.locator('input:disabled').count(),1)}finally{await p.close()}})
test('derived mismatch and later corruption are rejected',async()=>{for(const mode of ['wrongMaterial','corrupt']){const p=await pageFor();try{await p.evaluate(mode=>window[mode]=true,mode);await assert.rejects(()=>executeFabric(p,plan,{dryRun:false}),e=>e.partialResult.status==='needs_inspection'&&/MISMATCH/.test(e.message))}finally{await p.close()}}})
test('requires explicit material and composition',()=>{assert.throws(()=>compileFabricPlan({...plan,material:''}),/INVALID/);assert.throws(()=>compileFabricPlan({...plan,unknown:true}),/INVALID/)})
