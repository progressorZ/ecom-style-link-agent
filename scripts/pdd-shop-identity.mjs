// Identity is obtained through the visible header and its shop-home navigation.
// Never infer a shop ID from an editor's goods_id or from a display name.
export function parseShopHomeUrl(raw) {
 const url=new URL(raw)
 if(url.protocol!=='https:'||url.hostname!=='mobile.yangkeduo.com'||url.port||url.username||url.password||url.pathname!=='/mall_page.html')throw new Error('SHOP_HOME_URL_INVALID')
 const ids=url.searchParams.getAll('mall_id')
 if(ids.length!==1||! /^[1-9]\d*$/.test(ids[0]))throw new Error('SHOP_ID_INVALID')
 return {mallId:ids[0],shopHomeUrl:`https://mobile.yangkeduo.com/mall_page.html?mall_id=${ids[0]}`}
}
export function readShopHeader() {
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const names=[...document.querySelectorAll('#mms-header-next .user-name-name .user-name-text')].filter(visible)
 if(names.length!==1||!names[0].innerText.trim())throw new Error('SHOP_HEADER_AMBIGUOUS')
 return names[0].innerText.trim()
}
export function resolveShopBinding(shopKey,bindings) {
 if(!Array.isArray(bindings))throw new Error('SHOP_BINDINGS_INVALID')
 const matches=bindings.filter(b=>b?.platform==='pdd'&&b.shopKey===shopKey)
 if(matches.length!==1)throw new Error('SHOP_BINDING_MISSING_OR_AMBIGUOUS')
 const b=matches[0]
 if(typeof b.mallId!=='string'||! /^[1-9]\d*$/.test(b.mallId)||typeof b.shopName!=='string'||!b.shopName.trim()||b.shopName!==b.shopName.trim())throw new Error('SHOP_BINDING_INVALID')
 return {platform:'pdd',shopKey,mallId:b.mallId,shopName:b.shopName}
}
export function assertShopBinding(observed,binding) {
 if(observed.mallId!==binding.mallId||observed.shopName!==binding.shopName)throw new Error('SHOP_IDENTITY_MISMATCH')
 return {status:'matched',...binding,source:'visible_header_shop_home_navigation',observedAt:observed.observedAt}
}
export function isShopQrRendered(root) {
 const canvases=[...root.querySelectorAll('canvas')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'})
 if(canvases.length!==1)return false
 const c=canvases[0]
 if(c.width<20||c.height<20||c.width>2000||c.height>2000)return false
 const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data
 let dark=0,light=0
 for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<200)continue;if(pixels[i]<64&&pixels[i+1]<64&&pixels[i+2]<64)dark++;if(pixels[i]>192&&pixels[i+1]>192&&pixels[i+2]>192)light++}
 return dark>50&&light>50
}
export async function openVisibleShopQrEntry(header) {
 const qrEntry=header.getByText('店铺二维码',{exact:true})
 if(await qrEntry.count()!==1||!await qrEntry.isVisible())throw new Error('SHOP_QR_ENTRY_UNAVAILABLE')
 // Coordinate clicks can be intercepted by Pinduoduo's sticky section header.
 // This invokes only the uniquely resolved, visible entry's existing handler.
 await qrEntry.evaluate(element=>element.click())
}
export async function observeShopIdentity(page) {
 if(page.bringToFront)await page.bringToFront()
 const original=page.url()
 if(!original.startsWith('https://mms.pinduoduo.com/'))throw new Error('SHOP_ORIGIN_INVALID')
 if(await page.locator('[data-testid=beast-core-modal]:visible,[role=listbox]:visible').count())throw new Error('SHOP_CLOSE_POPUP_FIRST')
 const shopName=await page.evaluate(readShopHeader)
 const guard=async()=>{if(page.url()!==original)throw new Error('SHOP_PAGE_CHANGED');if(await page.evaluate(readShopHeader)!==shopName)throw new Error('SHOP_CHANGED')}
 const header=page.locator('#mms-header-next')
 let popup,ownedModal
 try {
  await header.locator('.user-name-name .user-name-text').hover({timeout:3000})
  await openVisibleShopQrEntry(header)
  ownedModal=page.locator('[data-testid=beast-core-modal]:visible').filter({has:page.getByRole('button',{name:'打开网页查看店铺',exact:true})})
  if(await ownedModal.count()!==1)throw new Error('SHOP_QR_MODAL_AMBIGUOUS')
  let qrReady=false
  for(let attempt=0;attempt<50;attempt++){
   await guard();qrReady=await ownedModal.evaluate(isShopQrRendered)
   if(qrReady)break
   await page.waitForTimeout(100)
  }
  if(!qrReady)throw new Error('SHOP_QR_NOT_READY')
  await guard()
  ;[popup]=await Promise.all([page.waitForEvent('popup',{timeout:10000}),ownedModal.getByRole('button',{name:'打开网页查看店铺',exact:true}).click()])
  let homeUrl='about:blank'
  for(let attempt=0;attempt<50;attempt++){
   homeUrl=await popup.evaluate(()=>location.href)
   if(homeUrl!=='about:blank')break
   await guard();await page.waitForTimeout(100)
  }
  if(homeUrl==='about:blank')throw new Error('SHOP_HOME_NAVIGATION_UNAVAILABLE')
  const home=await page.evaluate(parseShopHomeUrl,homeUrl)
  await guard()
  return {version:'pdd-shop-observation-v1',shopName,...home,observedAt:new Date().toISOString(),source:'visible_header_shop_home_navigation'}
 } finally {
  if(popup&&!popup.isClosed())await popup.close()
  if(ownedModal&&await ownedModal.count()===1){
   const close=ownedModal.locator('[data-testid=beast-core-modal-icon-close]')
   if(await close.count()!==1)throw new Error('SHOP_QR_CLOSE_UNAVAILABLE')
   await close.click()
  }
  await guard()
 }
}
