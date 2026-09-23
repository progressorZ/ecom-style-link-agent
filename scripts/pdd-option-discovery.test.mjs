import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {discoverPddSelectOptions} from './pdd-option-discovery.mjs'

test('只读采集下拉选项且不改变原值',async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage()
 try{
  await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
   <div data-testid="beast-core-form-item"><label>鞋面材质</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header" onclick="document.querySelector('[role=listbox]').style.display='block'">选择</div><input value="网布"></div></div>
   <ul role="listbox" style="display:none"><li role="option">网布</li><li role="option">牛皮</li></ul>
   <script>addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('[role=listbox]').style.display='none'})</script>`}))
  await page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add')
  const report=await discoverPddSelectOptions(page,{labels:['鞋面材质','不存在字段']})
  assert.deepEqual(report.results[0],{label:'鞋面材质',status:'collected',currentValue:'网布',options:['网布','牛皮']})
  assert.equal(report.results[1].status,'unreadable')
  assert.equal(await page.locator('input').inputValue(),'网布')
 }finally{await browser.close()}
})

test('禁用下拉框不点击且明确标记等待依赖条件',async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage()
 try{
  await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
   <div data-testid="beast-core-form-item"><label>适用年龄段</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header" onclick="window.discoveryClicked=true">选择</div><input disabled value=""></div></div>`}))
  await page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add')
  const report=await discoverPddSelectOptions(page,{labels:['适用年龄段']})
  assert.deepEqual(report.results,[{label:'适用年龄段',status:'disabled',options:[]}])
  assert.notEqual(await page.evaluate(()=>window.discoveryClicked),true)
 }finally{await browser.close()}
})

test('重复字段和空选项列表均安全停止并保留原值',async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage()
 try{
  await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
   <div data-testid="beast-core-form-item"><label>鞋底材质</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header">选择</div><input value="橡胶"></div></div>
   <div data-testid="beast-core-form-item"><label>鞋底材质</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header">选择</div><input value="TPR"></div></div>
   <div data-testid="beast-core-form-item"><label>闭合方式</label><div data-testid="beast-core-select"><div data-testid="beast-core-select-header" onclick="document.querySelector('[role=listbox]').style.display='block'">选择</div><input value="系带"></div></div>
   <ul role="listbox" style="display:none;width:100px;height:40px"></ul>
   <script>addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('[role=listbox]').style.display='none'})</script>`}))
  await page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add')
  const report=await discoverPddSelectOptions(page,{labels:['鞋底材质','闭合方式']})
  assert.equal(report.results[0].status,'unreadable')
  assert.equal(report.results[0].reason,'LABEL_AMBIGUOUS')
  assert.equal(report.results[1].status,'unreadable')
  assert.equal(report.results[1].reason,'LISTBOX_OPTIONS_EMPTY')
  assert.deepEqual(await page.locator('input').evaluateAll(inputs=>inputs.map(input=>input.value)),['橡胶','TPR','系带'])
 }finally{await browser.close()}
})
