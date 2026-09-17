import {AsyncLocalStorage} from 'node:async_hooks'
import {editorIdentity,reopenFromDraftList} from './pdd-draft-list.mjs'

const scope=new AsyncLocalStorage()
export function hasVerifiedDraftScope(page){
 const granted=scope.getStore()
 return Boolean(granted&&granted.page===page&&granted.url===page.url())
}
export async function withVerifiedNewDraft(page,binding,action,{openDraft=reopenFromDraftList}={}){
 const url=page.url(),identity=editorIdentity(url)
 const verification=await openDraft(page.context(),{editorUrl:url,shopBinding:binding})
 try{
  const evidence=verification.evidence
  if(evidence.status!=='编辑中'||evidence.editType!=='发布'||evidence.goodsId!==identity.goodsId||evidence.draftId!==identity.draftId)throw new Error('NEW_DRAFT_WRITE_NOT_CONFIRMED')
  if(page.url()!==url)throw new Error('PAGE_CHANGED')
 }finally{if(verification.page!==page)await verification.page.close()}
 if(page.bringToFront)await page.bringToFront()
 return scope.run({page,url},action)
}
