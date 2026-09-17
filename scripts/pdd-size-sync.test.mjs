import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {executeSizeSync,compileSizeSyncPlan} from './pdd-size-sync.mjs'
const plan={scope:'pdd-tshirt-size-sync-v1',productCode:'SYNC-TEST',enabled:false}
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function pageFor(){const p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><div>女装/女士精品 &gt; T恤 &gt; T恤</div><div data-testid="beast-core-form-item"><label>商品货号</label><input value="SYNC-TEST"></div><div data-testid="beast-core-form-item" id="newSpec"><div class="sizeChart_sizeSpecSyncDetailCheckWrapper__fixture"><label data-testid="beast-core-checkbox" style="display:inline-block;width:20px;height:20px"><input id="sync" type="checkbox" checked style="display:none"></label><span>尺码表同步添加至「商品详情」</span></div></div>'}));await p.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return p}
test('explicit boolean required',()=>{assert.throws(()=>compileSizeSyncPlan({...plan,enabled:'false'}),/INVALID/)})
test('preflight preserves checked state, apply unchecks and does not claim detail effects',async()=>{const p=await pageFor();try{assert.equal((await executeSizeSync(p,plan)).before.enabled,true);assert.equal(await p.locator('#sync').isChecked(),true);const r=await executeSizeSync(p,plan,{dryRun:false});assert.equal(r.observed.enabled,false);assert.equal(r.detailEffectsVerified,false);assert.equal((await executeSizeSync(p,plan,{dryRun:false})).changed,false)}finally{await p.close()}})
test('disabled and ambiguous controls cannot be changed',async()=>{for(const mode of ['disabled','duplicate']){const p=await pageFor();try{await p.locator('#sync').evaluate((e,mode)=>{if(mode==='disabled')e.disabled=true;else e.after(e.cloneNode(true))},mode);await assert.rejects(()=>executeSizeSync(p,plan,{dryRun:false}));assert.equal(await p.locator('#sync').first().isChecked(),true)}finally{await p.close()}}})
