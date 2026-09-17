import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileStylePlan,executeStyle} from './pdd-style.mjs'
const plan={scope:'pdd-tshirt-style-v1',productCode:'STYLE-TEST',primaryStyle:'简约通勤',secondaryStyle:'简约'}
function setup(){
 window.childClicks=0
 const field=(label,value='')=>{const div=document.createElement('div');div.dataset.testid='beast-core-form-item';div.innerHTML='<label>'+label+'</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header"><input data-testid="beast-core-select-htmlInput"></div></div>';const input=div.querySelector('input');input.value=value;input.onclick=()=>{input.value='';const ul=document.createElement('ul');ul.setAttribute('role','listbox');const li=document.createElement('li');li.setAttribute('role','option');li.textContent=label==='重要主风格'?'简约通勤':window.missing?'韩版':'简约';li.onclick=()=>{input.value=li.textContent;ul.remove();if(label==='重要主风格'&&!document.querySelector('#child'))setTimeout(()=>{const child=field('风格');child.id='child'},50);if(label==='风格'){window.childClicks++;if(window.corrupt)document.querySelector('#parent input').value='甜美清新'}};ul.append(li);document.body.append(ul)};document.body.append(div);return div}
 field('重要主风格').id='parent';window.seed=()=>{document.querySelector('#parent input').value='其他';field('风格','简约').id='child'}
}
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="STYLE-TEST"></div><script>(${setup.toString()})()</script>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('preflight defers missing child and execution waits for it',async()=>{const p=await pageFor();try{assert.equal((await executeStyle(p,plan)).before.primaryStyle,'');const r=await executeStyle(p,plan,{dryRun:false});assert.equal(r.observed.secondaryStyle,'简约')}finally{await p.close()}})
test('parent change reselects child even when stale text matches',async()=>{const p=await pageFor();try{await p.evaluate(()=>window.seed());await executeStyle(p,plan,{dryRun:false});assert.equal(await p.evaluate(()=>window.childClicks),1)}finally{await p.close()}})
test('missing child option and parent corruption stop',async()=>{for(const mode of ['missing','corrupt']){const p=await pageFor();try{await p.evaluate(mode=>window[mode]=true,mode);await assert.rejects(()=>executeStyle(p,plan,{dryRun:false}),e=>e.partialResult.status==='needs_inspection')}finally{await p.close()}}})
test('both style values must be explicit',()=>assert.throws(()=>compileStylePlan({...plan,secondaryStyle:''}),/INVALID/))
