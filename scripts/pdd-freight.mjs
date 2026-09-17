import {assertBasicScope} from './pdd-basic-adapter.mjs'
export function compileFreightPlan(input){
 if(input?.scope!=='pdd-tshirt-freight-v1'||!['productCode','templateName'].every(k=>typeof input[k]==='string'&&input[k].trim()===input[k]&&input[k].length)||!['default','other'].includes(input.mode)||!Array.isArray(input.expectedGroups)||!input.expectedGroups.length||input.expectedGroups.some(x=>typeof x!=='string'||!x.trim()))throw new Error('FREIGHT_PLAN_INVALID')
 return Object.freeze({...input,expectedGroups:Object.freeze(input.expectedGroups.map(x=>x.replace(/\s+/g,' ').trim()))})
}
export function observeFreight(){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const roots=[...document.querySelectorAll('#cost_template_id')]
 if(roots.length!==1)throw new Error('FREIGHT_ROOT_AMBIGUOUS')
 const root=roots[0];if(!visible(root))return {status:'collapsed'}
 const radios=[...root.querySelectorAll('[id="service.is_default_template_id"] label[data-testid=beast-core-radio]')].filter(visible).map(e=>({label:e.textContent.replace('推荐','').trim(),checked:e.querySelector('input')?.checked}))
 if(radios.filter(r=>r.checked).length!==1)throw new Error('FREIGHT_MODE_AMBIGUOUS')
 const selected=radios.find(r=>r.checked).label
 const headers=[...root.querySelectorAll('[data-testid=beast-core-select-header]')].filter(visible)
 const name=selected==='其他模板'?(headers.length===1?headers[0].innerText.trim():null):selected
 if(!name)throw new Error('FREIGHT_TEMPLATE_UNCONFIRMED')
 const groups=[...root.querySelectorAll('.template-group')].filter(visible).map(e=>e.innerText.replace(/\s+/g,' ').trim())
 if(!groups.length)throw new Error('FREIGHT_RULES_MISSING')
 return {status:'visible',mode:selected==='其他模板'?'other':selected==='同城配送'?'same_city':'default',templateName:name,groups}
}
export async function executeFreight(page,input,{dryRun=true}={}){
 const plan=compileFreightPlan(input),url=page.url(),completed=[]
 const guard=async()=>{if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page);const c=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible');if(await c.count()!==1||await c.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')}
 const read=async()=>{await guard();return page.evaluate(observeFreight)}
 const before=await read()
 if(dryRun)return {status:'freight_preflight',before,expected:plan,requiresExpansion:before.status==='collapsed',saved:false,published:false,fullProductVerified:false}
 try{
 if(before.status==='collapsed'){
 const expand=page.getByText('展开修改',{exact:true});if(await expand.count()!==1)throw new Error('FREIGHT_EXPAND_AMBIGUOUS');await expand.click();await page.locator('#cost_template_id').waitFor({state:'visible',timeout:5000});completed.push('expand')
 }
 if(await page.locator('[role=listbox]:visible').count())throw new Error('FREIGHT_CLOSE_POPUP')
 const current=await read(),label=plan.mode==='other'?'其他模板':plan.templateName
 if(current.mode!==plan.mode||plan.mode==='default'&&current.templateName!==plan.templateName){
 const radio=page.locator('#cost_template_id [id="service.is_default_template_id"] label[data-testid=beast-core-radio]').filter({hasText:label})
 if(await radio.count()!==1||(await radio.innerText()).replace('推荐','').trim()!==label)throw new Error('FREIGHT_RADIO_AMBIGUOUS')
 await guard();await radio.click({timeout:5000});completed.push('mode')
 }
 if(plan.mode==='other'){
 const header=page.locator('#cost_template_id [data-testid=beast-core-select-header]');await header.waitFor({state:'visible',timeout:5000});await guard();await header.click()
 const panel=page.locator('[role=listbox]:visible');await panel.waitFor({state:'visible',timeout:5000});const option=panel.getByRole('option',{name:plan.templateName,exact:true})
 if(await panel.count()!==1||await option.count()!==1||await option.getAttribute('data-disabled')==='true')throw new Error('FREIGHT_OPTION_UNAVAILABLE')
 await option.click();await panel.waitFor({state:'hidden',timeout:5000});completed.push('template')
 }
 const observed=await read()
 if(observed.mode!==plan.mode||observed.templateName!==plan.templateName||JSON.stringify(observed.groups)!==JSON.stringify(plan.expectedGroups))throw new Error('FREIGHT_READBACK_MISMATCH')
 return {status:'freight_subset_verified',before,expected:plan,observed,completed,saved:false,published:false,fullProductVerified:false}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,completed,saved:false,published:false,fullProductVerified:false};throw error}
}

// The selector branch may normalize from other to default after a draft save.
// Compare delivery semantics while retaining the original branch in diagnostics.
export function freightBusinessValues(state){
 if(state.status!=='visible')throw new Error('FREIGHT_NOT_VISIBLE')
 if(!['default','other','same_city'].includes(state.mode)||typeof state.templateName!=='string'||!state.templateName||!Array.isArray(state.groups)||!state.groups.length||state.groups.some(g=>typeof g!=='string'||!g))throw new Error('FREIGHT_STATE_UNSUPPORTED')
 return {deliveryType:state.mode==='same_city'?'same_city':'shipping',templateName:state.templateName,groups:[...state.groups]}
}
