import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {executeFreight} from './pdd-freight.mjs'
const plan={scope:'pdd-tshirt-freight-v1',productCode:'FREIGHT-TEST',mode:'other',templateName:'测试模板',expectedGroups:['包邮配送区域 北京','不配送区域 新疆']}
function setup(){
 const root=document.querySelector('#cost_template_id');document.querySelector('#expand').onclick=()=>root.style.display='block'
 const radios=root.querySelectorAll('input');radios[1].onchange=()=>document.querySelector('#select').style.display='block'
 document.querySelector('#select').onclick=()=>{const ul=document.createElement('ul');ul.setAttribute('role','listbox');const li=document.createElement('li');li.setAttribute('role','option');li.textContent='测试模板';li.onclick=()=>{document.querySelector('#select').textContent='测试模板';ul.remove();if(window.corrupt)document.querySelector('.template-group').textContent='包邮配送区域 上海'};ul.append(li);document.body.append(ul)}
}
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="FREIGHT-TEST"></div><button id="expand">展开修改</button><div id="cost_template_id" style="display:none"><div id="service.is_default_template_id"><label data-testid="beast-core-radio"><input type="radio" name="freight" checked>默认模板</label><label data-testid="beast-core-radio"><input type="radio" name="freight">其他模板</label></div><div id="select" data-testid="beast-core-select-header" style="display:none">默认模板</div><div class="template-group">包邮配送区域 北京</div><div class="template-group">不配送区域 新疆</div></div><script>(${setup.toString()})()</script>`}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('preflight reports collapsed; apply expands and reads template plus rules',async()=>{const p=await pageFor();try{assert.equal((await executeFreight(p,plan)).requiresExpansion,true);const r=await executeFreight(p,plan,{dryRun:false});assert.equal(r.status,'freight_subset_verified');assert.deepEqual(r.completed,['expand','mode','template'])}finally{await p.close()}})
test('same template name with changed delivery rules is rejected',async()=>{const p=await pageFor();try{await p.evaluate(()=>window.corrupt=true);await assert.rejects(()=>executeFreight(p,plan,{dryRun:false}),/READBACK_MISMATCH/)}finally{await p.close()}})
test('missing template does not choose another option',async()=>{const p=await pageFor();try{await assert.rejects(()=>executeFreight(p,{...plan,templateName:'不存在'},{dryRun:false}),/OPTION_UNAVAILABLE/)}finally{await p.close()}})

test('saved selector normalization does not hide changed delivery rules or same-city shipping',async()=>{
 const {freightBusinessValues}=await import('./pdd-freight.mjs')
 const state={status:'visible',mode:'other',templateName:'测试模板',groups:['包邮配送区域 北京','买家付运费区域 西藏 28.00元']}
 assert.deepEqual(freightBusinessValues(state),freightBusinessValues({...state,mode:'default'}))
 assert.notDeepEqual(freightBusinessValues(state),freightBusinessValues({...state,groups:['包邮配送区域 北京','买家付运费区域 西藏 25.00元']}))
 assert.notDeepEqual(freightBusinessValues(state),freightBusinessValues({...state,mode:'same_city'}))
 assert.throws(()=>freightBusinessValues({...state,groups:[]}),/UNSUPPORTED/)
})
