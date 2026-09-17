import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileAttributePlan,executeAttributes} from './pdd-attributes.mjs'
const input={scope:'pdd-tshirt-attributes-v1',productCode:'ATTR-TEST',fields:[{key:'attributes.sleeveLength',value:'短袖'}]}
const html=`<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="ATTR-TEST"></div><div data-testid="beast-core-form-item"><label>重要袖长</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header"><input id="attr" data-testid="beast-core-select-htmlInput" value="长袖"></div></div></div><script>attr.onclick=()=>{attr.placeholder=attr.value;attr.value='';const ul=document.createElement('ul');ul.setAttribute('role','listbox');for(const value of ['长袖','短袖']){const li=document.createElement('li');li.setAttribute('role','option');li.textContent=value;li.onclick=()=>{attr.value=window.corrupt?'长袖':value;ul.remove()};ul.append(li)}document.body.append(ul)}</script>`
let browser
test.before(async()=>{browser=await chromium.launch({headless:true})});test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('preflight is read-only and selection uses closed value rather than placeholder',async()=>{const p=await pageFor();try{assert.equal((await executeAttributes(p,input)).before[0].value,'长袖');const r=await executeAttributes(p,input,{dryRun:false});assert.equal(r.observed[0].value,'短袖')}finally{await p.close()}})
test('unavailable exact option stops without inventing a selection',async()=>{const p=await pageFor();try{await assert.rejects(()=>executeAttributes(p,{...input,fields:[{key:'attributes.sleeveLength',value:'不存在'}]},{dryRun:false}),/OPTION_UNAVAILABLE/)}finally{await p.close()}})
test('locked input and page normalization are rejected',async()=>{for(const mode of ['disabled','corrupt']){const p=await pageFor();try{await p.evaluate(mode=>{if(mode==='disabled')attr.disabled=true;else window.corrupt=true},mode);await assert.rejects(()=>executeAttributes(p,input,{dryRun:false}),/NOT_WRITABLE|MISMATCH/)}finally{await p.close()}}})
test('dependent fabric and multi-select plans cannot enter independent adapter',()=>{assert.throws(()=>compileAttributePlan({...input,fields:[{key:'attributes.fabricName',value:'棉'}]}),/UNSUPPORTED/)})

test('brand text matching expected still requires an actual option selection',async()=>{
 const p=await pageFor();try{
 await p.getByText('重要袖长',{exact:true}).evaluate(e=>e.textContent='品牌');await p.locator('#attr').fill('短袖')
 const result=await executeAttributes(p,{...input,fields:[{key:'product.brand',value:'短袖'}]},{dryRun:false})
 assert.deepEqual(result.completed,['product.brand'])
 }finally{await p.close()}
})
