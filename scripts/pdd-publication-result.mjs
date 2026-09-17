import {editorIdentity} from './pdd-draft-list.mjs'
import {observeShopIdentity,assertShopBinding} from './pdd-shop-identity.mjs'

export function validateProductLink(raw,goodsId){
 const u=new URL(raw)
 if(u.protocol!=='https:'||u.hostname!=='mobile.yangkeduo.com'||u.port||u.username||u.password||u.pathname!=='/goods.html'||u.searchParams.getAll('goods_id').length!==1||u.searchParams.get('goods_id')!==goodsId)throw new Error('PRODUCT_LINK_ID_MISMATCH')
 return u.href
}
export function readOnSaleRow({goodsId}){
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const rows=[...document.querySelectorAll('tr')].filter(r=>visible(r)&&[...r.querySelectorAll('td')].some(c=>new RegExp('ID:\\s*'+goodsId+'(?!\\d)').test(c.textContent)))
 if(rows.length!==1)throw new Error('PRODUCT_RESULT_ROW_AMBIGUOUS')
 const row=rows[0],text=row.innerText
 if(!/销售中/.test(text)||![...row.querySelectorAll('a,span')].some(e=>e.textContent.trim()==='下架'))throw new Error('PRODUCT_NOT_CONFIRMED_ON_SALE')
 return {goodsId,status:'on_sale',information:row.querySelectorAll('td')[1]?.innerText??text,source:'visible_merchant_product_list'}
}
export async function collectPublicationResult(context,{editorUrl,shopBinding,onProgress=()=>{}}){
 const {goodsId}=editorIdentity(editorUrl),page=await context.newPage()
 try{
  onProgress({step:'lookup-publication-result'})
  await page.goto('https://mms.pinduoduo.com/goods/goods_list?msfrom=mms_sidenav',{waitUntil:'domcontentloaded'})
  await page.getByText('商品ID',{exact:true}).waitFor({state:'visible',timeout:20000})
  assertShopBinding(await observeShopIdentity(page),shopBinding)
  const label=page.getByText('商品ID',{exact:true}),input=label.locator('..').locator('input')
  if(await label.count()!==1||await input.count()!==1)throw new Error('PRODUCT_ID_FILTER_AMBIGUOUS')
  await input.fill(goodsId);await page.getByRole('button',{name:'查询',exact:true}).click()
  const row=page.getByRole('row').filter({hasText:new RegExp('ID:\\s*'+goodsId+'(?!\\d)')})
  try{await row.waitFor({state:'visible',timeout:10000})}catch(e){if(e.name!=='TimeoutError')throw e;return {status:'not_confirmed_on_sale',goodsId,productUrl:null,published:false,reason:'商品列表未找到对应在售商品；可能仍为草稿、审核中或筛选未完成',observedAt:new Date().toISOString()}}
  const evidence=await page.evaluate(readOnSaleRow,{goodsId})
  const share=row.getByText('二维码/链接',{exact:true})
  if(await share.count()!==1)throw new Error('PRODUCT_SHARE_AMBIGUOUS')
  await share.click()
  const link=page.locator('.optHoverShare:visible .opt-share-url-txt')
  await link.waitFor({state:'visible',timeout:10000})
  if(await link.count()!==1)throw new Error('PRODUCT_LINK_AMBIGUOUS')
  const productUrl=validateProductLink((await link.innerText()).trim(),goodsId)
  const after=await page.evaluate(readOnSaleRow,{goodsId})
  if(JSON.stringify(after)!==JSON.stringify(evidence))throw new Error('PRODUCT_STATUS_CHANGED')
  await page.getByText('商品ID',{exact:true}).click()
  assertShopBinding(await observeShopIdentity(page),shopBinding)
  // This observes an existing publication; it never submits a product.
  return {...evidence,productUrl,published:true,publicationExecuted:false,shopKey:shopBinding.shopKey,mallId:shopBinding.mallId,observedAt:new Date().toISOString()}
 }finally{await page.close()}
}
