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
