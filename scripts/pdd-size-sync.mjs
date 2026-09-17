import {assertBasicScope} from './pdd-basic-adapter.mjs'
export function compileSizeSyncPlan(input){
 if(input?.scope!=='pdd-tshirt-size-sync-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||typeof input.enabled!=='boolean')throw new Error('SIZE_SYNC_PLAN_INVALID')
 return Object.freeze({scope:input.scope,productCode:input.productCode,enabled:input.enabled})
}
export function resolveSizeSyncDom({target=false}={}){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const roots=[...document.querySelectorAll('[data-testid=beast-core-form-item][id=newSpec]')].filter(visible)
 if(roots.length!==1)throw new Error('SIZE_SYNC_ROOT_AMBIGUOUS')
 const wrappers=[...roots[0].querySelectorAll('[class*=sizeChart_sizeSpecSyncDetailCheckWrapper__]')].filter(visible)
 if(wrappers.length!==1||!wrappers[0].textContent.includes('尺码表同步添加至「商品详情」'))throw new Error('SIZE_SYNC_LABEL_UNCONFIRMED')
 const inputs=[...wrappers[0].querySelectorAll('input[type=checkbox]')]
 if(inputs.length!==1||inputs[0].indeterminate)throw new Error('SIZE_SYNC_CONTROL_AMBIGUOUS')
 if(target){if(inputs[0].disabled)throw new Error('SIZE_SYNC_DISABLED');const label=inputs[0].closest('label[data-testid=beast-core-checkbox]');if(!label||!wrappers[0].contains(label)||!visible(label))throw new Error('SIZE_SYNC_CLICK_TARGET_UNAVAILABLE');return label}
 return {enabled:inputs[0].checked,disabled:inputs[0].disabled}
}
export async function executeSizeSync(page,input,{dryRun=true}={}){
 const plan=compileSizeSyncPlan(input),url=page.url()
 const guard=async()=>{if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page);if(await page.locator('[data-testid=beast-core-modal]:visible').count())throw new Error('BLOCKING_MODAL');const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible');if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')}
 const read=async()=>{await guard();return page.evaluate(resolveSizeSyncDom)}
 const before=await read()
 if(dryRun)return {status:'size_sync_preflight',expected:plan,before,saved:false,published:false,fullProductVerified:false}
 let changed=false
 try{
 if(before.enabled!==plan.enabled){const handle=await page.evaluateHandle(resolveSizeSyncDom,{target:true});try{await handle.asElement().click({timeout:5000});changed=true}finally{await handle.dispose()}}
 const observed=await read();if(observed.enabled!==plan.enabled)throw new Error('SIZE_SYNC_READBACK_MISMATCH')
 return {status:'size_sync_subset_verified',expected:plan,before,observed,changed,detailEffectsVerified:false,saved:false,published:false,fullProductVerified:false}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,changed,saved:false,published:false};throw error}
}
