import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {parseShopHomeUrl,resolveShopBinding,assertShopBinding,observeShopIdentity,openVisibleShopQrEntry} from './pdd-shop-identity.mjs'
const binding={platform:'pdd',shopKey:'test',mallId:'123',shopName:'测试店铺'}
test('shop ID requires exact public URL and a single numeric ID; tracking is discarded',()=>{
 assert.deepEqual(parseShopHomeUrl('https://mobile.yangkeduo.com/mall_page.html?mall_id=123&tracking=private'),{mallId:'123',shopHomeUrl:'https://mobile.yangkeduo.com/mall_page.html?mall_id=123'})
 for(const raw of ['https://evil.com/mall_page.html?mall_id=123','https://mobile.yangkeduo.com/mall_page.html?mall_id=1&mall_id=2','https://mms.pinduoduo.com/goods/goods_add/index?goods_id=123','http://mobile.yangkeduo.com/mall_page.html?mall_id=1'])assert.throws(()=>parseShopHomeUrl(raw))
})
test('binding is scoped, unique and requires both name and ID',()=>{
 assert.deepEqual(resolveShopBinding('test',[binding]),binding)
 for(const list of [[],[binding,binding],[{...binding,mallId:123}]])assert.throws(()=>resolveShopBinding('test',list))
 assert.throws(()=>assertShopBinding({...binding,mallId:'456'},binding),/MISMATCH/)
 assert.throws(()=>assertShopBinding({...binding,shopName:'其他店铺'},binding),/MISMATCH/)
})
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
async function fixture(){const context=await browser.newContext();await context.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><div id="mms-header-next"><div class="user-name-name"><span class="user-name-text">测试店铺</span></div><div><span class="user-name-text">主账号</span></div><button onclick="document.getElementById('qr').style.display='block'">店铺二维码</button></div><input id="product" value="保留商品"><div id="qr" data-testid="beast-core-modal" style="display:none"><canvas id="qr-canvas" width="40" height="40"></canvas><script>const ctx=document.getElementById("qr-canvas").getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,40,40);ctx.fillStyle="black";ctx.fillRect(0,0,20,20);</script><button onclick="window.open('https://mobile.yangkeduo.com/mall_page.html?mall_id=123')">打开网页查看店铺</button><button data-testid="beast-core-modal-icon-close" onclick="document.getElementById('qr').style.display='none'">关闭</button></div>`}));const page=await context.newPage();await page.goto('https://mms.pinduoduo.com/goods/goods_add/index?type=add');return {context,page}}
test('observes current browser identity and cleans up only its popup/modal',async()=>{const {context,page}=await fixture();try{const url=page.url(),result=await observeShopIdentity(page);assert.equal(result.mallId,'123');assert.equal(result.shopName,'测试店铺');assert.equal(context.pages().length,1);assert.equal(page.url(),url);assert.equal(await page.locator('#product').inputValue(),'保留商品');assert.equal(await page.locator('#qr').isVisible(),false)}finally{await context.close()}})
test('opens the resolved QR entry when a sticky overlay intercepts coordinate clicks',async()=>{const {context,page}=await fixture();try{
 const header=page.locator('#mms-header-next')
 await page.evaluate(()=>{const blocker=document.createElement('div');blocker.id='sticky-blocker';blocker.style.cssText='position:fixed;inset:0 0 auto 0;height:30px;z-index:999999;background:white';document.body.append(blocker)})
 await openVisibleShopQrEntry(header)
 assert.equal(await page.locator('#qr').isVisible(),true)
}finally{await context.close()}})
test('existing modal is preserved and prevents identity navigation',async()=>{const {context,page}=await fixture();try{await page.locator('#qr').evaluate(e=>e.style.display='block');await assert.rejects(()=>observeShopIdentity(page),/CLOSE_POPUP/);assert.equal(await page.locator('#qr').isVisible(),true);assert.equal(context.pages().length,1)}finally{await context.close()}})

test('blank shop-home popup times out and is cleaned up without claiming identity',async()=>{const {context,page}=await fixture();try{
 await page.locator('#qr button').first().evaluate(e=>e.setAttribute('onclick',"window.open('about:blank')"))
 await assert.rejects(()=>observeShopIdentity(page),/SHOP_HOME_NAVIGATION_UNAVAILABLE/)
 assert.equal(context.pages().length,1);assert.equal(await page.locator('#qr').isVisible(),false)
}finally{await context.close()}})

test('waits for visible QR pixels before clicking the already-enabled home button',async()=>{const {context,page}=await fixture();try{
 await page.evaluate(()=>{
  const c=document.getElementById('qr-canvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,40,40)
  document.querySelector('#qr button').setAttribute('onclick',"window.open(document.getElementById('qr-canvas').getContext('2d').getImageData(0,0,1,1).data[3] ? 'https://mobile.yangkeduo.com/mall_page.html?mall_id=123' : 'about:blank')")
  setTimeout(()=>{ctx.fillStyle='white';ctx.fillRect(0,0,40,40);ctx.fillStyle='black';ctx.fillRect(0,0,20,20)},350)
 })
 assert.equal((await observeShopIdentity(page)).mallId,'123')
 assert.equal(context.pages().length,1)
}finally{await context.close()}})
