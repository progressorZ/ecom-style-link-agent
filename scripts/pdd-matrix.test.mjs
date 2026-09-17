import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {compileMatrixPlan,assessMatrix,prepareSkuMatrix,validateColorOptions} from './pdd-matrix-adapter.mjs'
const input={scope:'pdd-tshirt-matrix-v1',sizeSystem:'中国码',productCode:'MATRIX-001',variants:[{color:'白色',size:'S',stock:1,groupPriceMinor:12900,singlePriceMinor:13900,merchantSku:'MATRIX-S',enabled:true},{color:'白色',size:'M',stock:0,groupPriceMinor:12900,singlePriceMinor:13900,merchantSku:'MATRIX-M',enabled:false}]}
const state={colors:[],system:['通用'],sizes:[],hasSkuData:false,hasSizeData:false,colorPanelCount:0}
test('rejects sparse matrices and preserves existing populated data',()=>{
 const plan=compileMatrixPlan(input)
 assert.equal(assessMatrix(plan,state).reuse,false)
 assert.throws(()=>compileMatrixPlan({...input,variants:[...input.variants,{...input.variants[1],color:'黑色',merchantSku:'B-M'}]}),/SPARSE/)
 assert.throws(()=>assessMatrix(plan,{...state,hasSkuData:true}),/EXISTING_VALUES/)
 assert.throws(()=>assessMatrix(plan,{...state,colors:['黑色']}),/EXTRA/)
 assert.equal(assessMatrix(plan,{...state,colors:['白色'],system:['中国码'],sizes:[{name:'S',checked:true},{name:'M',checked:true}],hasSkuData:true}).reuse,true)
})
function fixture(){return `<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="MATRIX-001"></div><div data-testid="beast-core-form-item" id="newSpec"><div id="colors"><input placeholder="选择或输入主色" onclick="openColors()"></div><label data-testid="beast-core-radio"><input type="radio" name="system" checked>通用</label><label data-testid="beast-core-radio"><input type="radio" name="system" onclick="showSizes()">中国码</label><div id="sizes"></div></div><div data-testid="beast-core-form-item" id="sku"><input value="全部颜色分类"><table><thead><tr>${['颜色分类','尺码','库存','拼单价(元)','单买价(元)','规格编码','状态'].map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody></tbody></table></div><button onclick="window.saved=true">保存草稿</button><button onclick="window.published=true">提交并上架</button><script>(${setup.toString()})()</script>`}
let browser
test.before(async()=>{browser=await chromium.launch({headless:true})})
test.after(async()=>{await browser?.close()})
async function pageFor(){const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture()}));await page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return page}
test('creates a blank matrix and chains SKU filling; a second run reuses the same matrix',async()=>{
 const page=await pageFor();try{
  assert.equal((await prepareSkuMatrix(page,input)).status,'matrix_preflight_passed');assert.equal(await page.locator('tbody tr').count(),0)
  assert.equal((await prepareSkuMatrix(page,input,{dryRun:false})).status,'matrix_and_sku_verified')
  assert.equal(await page.locator('tbody tr').count(),2)
  assert.equal((await prepareSkuMatrix(page,input,{dryRun:false})).matrix.steps.length,0)
  assert.equal(await page.evaluate(()=>!!window.saved||!!window.published),false)
 }finally{await page.close()}
})
test('missing color and unavailable size stop without filling prices or saving',async()=>{
 for(const field of ['color','size']){const page=await pageFor();try{
  const bad=structuredClone(input);for(const v of bad.variants)v[field]=field==='color'?'不存在的颜色':v.size==='S'?'XXS':v.size
  await assert.rejects(()=>prepareSkuMatrix(page,bad,{dryRun:false}),e=>e.partialResult.status==='needs_inspection')
  assert.equal(await page.locator('tbody tr').count(),0)
 }finally{await page.close()}}
})
test('rejects a changed plan over existing filled rows before deleting or rebuilding anything',async()=>{
 const page=await pageFor();try{
  await prepareSkuMatrix(page,input,{dryRun:false})
  const before=await page.locator('tbody input').evaluateAll(es=>es.map(e=>e.value))
  const changed={...input,variants:[...input.variants,{...input.variants[0],size:'L',merchantSku:'MATRIX-L'}]}
  await assert.rejects(()=>prepareSkuMatrix(page,changed,{dryRun:false}),/EXISTING_VALUES/)
  assert.deepEqual(await page.locator('tbody input').evaluateAll(es=>es.map(e=>e.value)),before)
 }finally{await page.close()}
})

function setup(){
  let colors=[],sizes=[],pending=[]
  window.showSizes=()=>{
    const root=document.querySelector('#sizes');root.replaceChildren()
    for(const name of ['S','M']){
      const label=document.createElement('label');label.dataset.testid='beast-core-checkbox'
      const box=document.createElement('input');box.type='checkbox'
      box.onchange=()=>{sizes=box.checked?[...sizes,name]:sizes.filter(s=>s!==name);render()}
      const span=document.createElement('span');span.className='check-wrapper';span.textContent=name
      label.append(box,span);root.append(label)
    }
  }
  window.openColors=()=>{
    pending=[];const wrap=document.createElement('div');wrap.id='popup'
    const panel=document.createElement('div');panel.setAttribute('data-tracking-impr-viewid','el_color_selection_panel')
    const title=document.createElement('div');title.textContent='白色';panel.append(title)
    const option=document.createElement('div');option.setAttribute('data-tracking-click-viewid','el_color_selection_panel');option.className='colorV2_colorOption__test';option.textContent='白色'
    option.onclick=()=>{option.classList.add('colorV2_selected__test');pending=['白色']};panel.append(option)
    const confirm=document.createElement('button');confirm.textContent='确认';confirm.onclick=()=>{
      colors.push(...pending);const root=document.querySelector('#colors');root.replaceChildren()
      for(const name of [...colors,'']){const box=document.createElement('input');box.placeholder='选择或输入主色';box.value=name;if(!name)box.onclick=window.openColors;root.append(box)}
      wrap.remove();render()
    };wrap.append(panel,confirm);document.body.append(wrap)
  }
  function render(){
    const body=document.querySelector('tbody');body.replaceChildren()
    for(const color of colors)for(const size of sizes){
      const row=document.createElement('tr')
      for(const value of [color,size]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}
      const inputs=[]
      for(let i=0;i<4;i++){const cell=document.createElement('td'),box=document.createElement('input');inputs.push(box);cell.append(box);row.append(cell)}
      const cell=document.createElement('td'),word=document.createElement('span'),toggle=document.createElement('div');word.textContent='已启用';toggle.dataset.testid='beast-core-switch';toggle.style.cssText='width:20px;height:20px;background:#aaa'
      toggle.onclick=()=>{const off=word.textContent==='已启用';word.textContent=off?'已停用':'已启用';inputs[0].disabled=off;if(off)inputs[0].value='0'}
      cell.append(word,toggle);row.append(cell);body.append(row)
    }
  }
}

test('color diagnostics distinguish unreadable, missing, duplicate and disabled options',()=>{
 assert.throws(()=>validateColorOptions(['白色'],{colorOptions:[]}),/COLOR_OPTIONS_NOT_READABLE/)
 const white={name:'白色',disabled:false},pink={name:'粉红色',disabled:false}
 assert.doesNotThrow(()=>validateColorOptions(['白色'],{colorOptions:[white,pink]}))
 assert.throws(()=>validateColorOptions(['粉色'],{colorOptions:[white,pink]}),e=>e.message.startsWith('COLOR_OPTION_MISSING:')&&JSON.parse(e.message.split(':').slice(1).join(':')).color==='粉色'&&e.message.includes('粉红色'))
 assert.throws(()=>validateColorOptions(['白色'],{colorOptions:[white,white]}),/COLOR_OPTION_AMBIGUOUS:/)
 assert.throws(()=>validateColorOptions(['白色'],{colorOptions:[{...white,disabled:true}]}),/COLOR_OPTION_DISABLED:/)
})
