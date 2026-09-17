import {assertBasicScope} from './pdd-basic-adapter.mjs'
export function compileElementsPlan(input){
 if(input?.scope!=='pdd-tshirt-elements-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||!Array.isArray(input.values)||input.values.length>3||input.values.some(v=>typeof v!=='string'||!v.trim()||v.trim()!==v)||new Set(input.values).size!==input.values.length)throw new Error('ELEMENTS_PLAN_INVALID')
 return Object.freeze({scope:input.scope,productCode:input.productCode,values:Object.freeze([...input.values])})
}
export function resolveElementsDom({target=false}={}){
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const labels=[...document.querySelectorAll('label')].filter(e=>visible(e)&&e.textContent.trim()==='重要流行元素')
 if(labels.length!==1)throw new Error('ELEMENTS_LABEL_AMBIGUOUS')
 const root=labels[0].closest('[data-testid=beast-core-form-item]')
 if(!root||!root.textContent.includes('最多可勾选3个'))throw new Error('ELEMENTS_LIMIT_UNCONFIRMED')
 const selects=[...root.querySelectorAll('[data-testid=beast-core-select]')].filter(visible)
 if(selects.length!==1||selects[0].querySelectorAll('[class*=ST_selectValueMultiple_]').length!==1)throw new Error('ELEMENTS_COMPONENT_UNCONFIRMED')
 const inputs=[...selects[0].querySelectorAll('input[data-testid=beast-core-select-htmlInput]')].filter(visible)
 if(inputs.length!==1||inputs[0].disabled||inputs[0].readOnly)throw new Error('ELEMENTS_INPUT_UNAVAILABLE')
 const values=[...selects[0].querySelectorAll('[data-testid=beast-core-tagGroup-tag]')].map(e=>e.textContent.trim())
 if(values.some(v=>!v)||values.length>3||new Set(values).size!==values.length)throw new Error('ELEMENTS_TAGS_INVALID')
 if(target)return inputs[0]
 return {values}
}
const same=(a,b)=>a.length===b.length&&a.every(v=>b.includes(v))
export async function executeElements(page,input,{dryRun=true}={}){
 const plan=compileElementsPlan(input),url=page.url(),completed=[]
 const read=async()=>{
 if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page)
 const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
 if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
 return page.evaluate(resolveElementsDom)
 }
 if(await page.locator('[role=listbox]:visible').count())throw new Error('ELEMENTS_CLOSE_EXISTING_POPUP')
 const before=await read(),remove=before.values.filter(v=>!plan.values.includes(v)),add=plan.values.filter(v=>!before.values.includes(v))
 if(dryRun)return {status:'elements_preflight_passed',before,expected:plan.values,remove,add,optionsVerified:false,saved:false,published:false,fullProductVerified:false}
 try{
 if(remove.length||add.length){
 const h=await page.evaluateHandle(resolveElementsDom,{target:true});try{await h.asElement().click({timeout:5000})}finally{await h.dispose()}
 const panel=page.locator('[role=listbox]:visible');await panel.waitFor({state:'visible',timeout:5000})
 if(await panel.count()!==1)throw new Error('ELEMENTS_POPUP_AMBIGUOUS')
 for(const value of [...remove,...add])if(await panel.getByRole('option',{name:value,exact:true}).count()!==1)throw new Error('ELEMENTS_OPTION_MISSING')
 let expected=[...before.values]
 for(const value of [...remove,...add]){
 const current=await read();if(!same(current.values,expected))throw new Error('ELEMENTS_CHANGED')
 const option=panel.getByRole('option',{name:value,exact:true})
 const checked=await option.getAttribute('data-checked')
 if(!['true','false'].includes(checked)||(checked==='true')!==expected.includes(value)||await option.getAttribute('data-disabled')==='true'||await option.getAttribute('aria-disabled')==='true')throw new Error('ELEMENTS_OPTION_STATE_MISMATCH')
 await option.click({timeout:5000});expected=expected.includes(value)?expected.filter(v=>v!==value):[...expected,value]
 if(!same((await read()).values,expected))throw new Error('ELEMENTS_READBACK_MISMATCH')
 completed.push(value)
 }
 await page.locator('label').filter({hasText:/^重要流行元素$/}).click();await panel.waitFor({state:'hidden',timeout:5000})
 }
 const observed=await read();if(!same(observed.values,plan.values))throw new Error('ELEMENTS_FINAL_MISMATCH')
 return {status:'elements_subset_verified',before,expected:plan.values,observed,completed,saved:false,published:false,fullProductVerified:false}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,completed,saved:false,published:false,fullProductVerified:false};throw error}
}
