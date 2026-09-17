import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {observeDetail} from './pdd-detail-dom.mjs'
export function compileDetailRemoval(input){
 const urls=input?.beforeUrls
 if(input?.scope!=='pdd-tshirt-detail-remove-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||!Array.isArray(urls)||urls.length<2||new Set(urls).size!==urls.length||urls.some(u=>typeof u!=='string'||!/^https:\/\/(pfs\.pinduoduo\.com|img\.pddpic\.com)\//.test(u))||!urls.includes(input.removeUrl))throw new Error('DETAIL_REMOVAL_PLAN_INVALID')
 return Object.freeze({scope:input.scope,productCode:input.productCode,beforeUrls:Object.freeze([...urls]),removeUrl:input.removeUrl,afterUrls:Object.freeze(urls.filter(u=>u!==input.removeUrl))})
}
export function resolveDetailRemoveTarget({src}){
 const roots=[...document.querySelectorAll('.quick-decoration-container-v2')]
 if(roots.length!==1)throw new Error('DETAIL_REMOVE_REGION_AMBIGUOUS')
 const cards=[...roots[0].querySelectorAll('[class*=quick_decoration_v2_remarkImage__]')].filter(e=>[...e.querySelectorAll('img[data-tracking-click-viewid=el_preview_business_details]')].some(i=>(i.currentSrc||i.src)===src))
 if(cards.length!==1)throw new Error('DETAIL_REMOVE_IMAGE_AMBIGUOUS')
 const buttons=cards[0].querySelectorAll('[data-testid=beast-core-icon-close]')
 if(buttons.length!==1)throw new Error('DETAIL_REMOVE_CONTROL_AMBIGUOUS')
 return buttons[0]
}
export async function executeDetailRemoval(page,input,{dryRun=true,timeout=5000}={}){
 const plan=compileDetailRemoval(input),url=page.url()
 const guard=async()=>{if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page);if(await page.locator('[data-testid=beast-core-modal]:visible').count())throw new Error('BLOCKING_MODAL');const c=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible');if(await c.count()!==1||await c.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')}
 const read=async()=>{await guard();const state=await page.evaluate(observeDetail);if(state.count!==state.images.length||state.images.some(i=>!i.src||!i.loaded||i.pending))throw new Error('DETAIL_REMOVE_NOT_READY');return state}
 const before=await read(),urls=s=>s.images.map(i=>i.src),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
 if(!same(urls(before),plan.beforeUrls))throw new Error('DETAIL_REMOVE_BASELINE_MISMATCH')
 if(dryRun)return {status:'detail_removal_preflight',before,expected:plan,saved:false,published:false}
 let clicked=false
 try{
  if(!same(urls(await read()),plan.beforeUrls))throw new Error('DETAIL_REMOVE_CHANGED')
  const h=await page.evaluateHandle(resolveDetailRemoveTarget,{src:plan.removeUrl});try{await h.asElement().click({timeout});clicked=true}finally{await h.dispose()}
  const deadline=Date.now()+timeout;let observed
  do{observed=await read();if(same(urls(observed),plan.afterUrls))break;if(!same(urls(observed),plan.beforeUrls))throw new Error('DETAIL_REMOVE_UNEXPECTED_CHANGE');await page.waitForTimeout(100)}while(Date.now()<deadline)
  if(!same(urls(observed),plan.afterUrls))throw new Error('DETAIL_REMOVE_TIMEOUT')
  return {status:'detail_removal_subset_verified',before,observed,expected:plan,retainedUrlsVerified:true,saved:false,published:false,fullProductVerified:false}
 }catch(e){e.partialResult={status:'needs_inspection',reason:e.message,before,clicked,mayHaveChanged:true,saved:false,published:false};throw e}
}
