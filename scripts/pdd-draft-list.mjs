import {assertPddEditorUrl} from './pdd-locator-contract.mjs'
import {observeShopIdentity,assertShopBinding} from './pdd-shop-identity.mjs'

export function editorIdentity(raw){
 assertPddEditorUrl(raw)
 const u=new URL(raw)
 const read=key=>{const values=u.searchParams.getAll(key);if(values.length!==1||!/^\d+$/.test(values[0]))throw new Error('EDITOR_ID_INVALID:'+key);return values[0]}
 return {draftId:read('id'),goodsId:read('goods_id')}
}
// Read rendered table cells, never infer publication from the “编辑类型: 发布” column.
export function readDraftRow({goodsId}){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const tables=[...document.querySelectorAll('table')].filter(t=>visible(t)&&[...t.querySelectorAll('th')].some(h=>h.textContent.trim()==='编辑类型'))
 if(tables.length!==1)throw new Error('DRAFT_TABLE_AMBIGUOUS')
 const headers=[...tables[0].querySelectorAll('th')].map(h=>h.textContent.trim())
 const rows=[...tables[0].querySelectorAll('tr')].filter(r=>[...r.querySelectorAll('td')].some(c=>new RegExp('ID:\\s*'+goodsId+'(?!\\d)').test(c.textContent)))
 if(rows.length!==1)throw new Error('DRAFT_ROW_NOT_UNIQUE')
 const cells=[...rows[0].querySelectorAll('td')].map(c=>c.innerText.trim())
 const status=cells[headers.indexOf('状态')]
 if(status!=='编辑中')throw new Error('DRAFT_STATUS_UNSUPPORTED:'+status)
 return {goodsId,status,information:cells[headers.indexOf('商品信息')],editType:cells[headers.indexOf('编辑类型')],published:false}
}
export async function reopenFromDraftList(context,{editorUrl,shopBinding,onProgress=()=>{}}){
 const identity=editorIdentity(editorUrl),list=await context.newPage()
 try{
  await list.goto('https://mms.pinduoduo.com/goods/goods_list?msfrom=mms_sidenav&activeKeyNew=key_7',{waitUntil:'domcontentloaded'})
  await list.getByRole('columnheader',{name:'编辑类型',exact:true}).waitFor({state:'visible',timeout:20000})
  assertShopBinding(await observeShopIdentity(list),shopBinding)
  // Scope the goods-ID search by its visible label; the merchant-code field shares its placeholder.
  const label=list.getByText('商品ID',{exact:true})
  if(await label.count()!==1)throw new Error('DRAFT_ID_FILTER_AMBIGUOUS')
  const field=label.locator('..').locator('input')
  if(await field.count()!==1)throw new Error('DRAFT_ID_INPUT_AMBIGUOUS')
  await field.fill(identity.goodsId)
  await list.getByRole('button',{name:'查询',exact:true}).click()
  const row=list.getByRole('row').filter({hasText:new RegExp('ID:\\s*'+identity.goodsId+'(?!\\d)')})
  await row.waitFor({state:'visible',timeout:20000})
  const evidence=await list.evaluate(readDraftRow,{goodsId:identity.goodsId})
  const edit=row.getByRole('link',{name:'编辑',exact:true})
  if(await edit.count()!==1)throw new Error('DRAFT_EDIT_AMBIGUOUS')
  onProgress({step:'open-matching-draft',goodsId:identity.goodsId})
  const [page]=await Promise.all([list.waitForEvent('popup',{timeout:20000}),edit.click()])
  await page.waitForURL(u=>u.hostname==='mms.pinduoduo.com'&&u.pathname==='/goods/goods_add/index',{timeout:20000})
  if(JSON.stringify(editorIdentity(page.url()))!==JSON.stringify(identity))throw new Error('DRAFT_REOPEN_ID_MISMATCH')
  await page.getByRole('button',{name:'保存草稿',exact:true}).waitFor({state:'visible',timeout:20000})
  assertShopBinding(await observeShopIdentity(page),shopBinding)
  return {page,evidence:{...evidence,draftId:identity.draftId,source:'draft_list',editorUrl:page.url(),observedAt:new Date().toISOString()}}
 }finally{await list.close()}
}
