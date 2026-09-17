import {findExactVisibleOption} from './pdd-select-option.mjs'
import {assertBasicScope} from './pdd-basic-adapter.mjs'
import {tshirtLocatorContract} from './pdd-locator-contract.mjs'
export const supportedAttributeKeys=Object.freeze(['attributes.sleeveLength','attributes.fit','attributes.garmentLength','attributes.collar','attributes.sleeveType','attributes.ageRange','attributes.listingSeason','attributes.fleece','attributes.gramsPerSquareMeter','attributes.yarnCount'])
const supported=new Set([...supportedAttributeKeys,'product.brand'])
export function compileAttributePlan(input){
 if(input?.scope!=='pdd-tshirt-attributes-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||!Array.isArray(input.fields)||!input.fields.length)throw new Error('ATTRIBUTE_PLAN_INVALID')
 const seen=new Set()
 return Object.freeze({scope:input.scope,productCode:input.productCode,fields:Object.freeze(input.fields.map(f=>{if(!supported.has(f.key)||seen.has(f.key)||typeof f.value!=='string'||!f.value.trim()||f.value.trim()!==f.value)throw new Error('ATTRIBUTE_FIELD_UNSUPPORTED');seen.add(f.key);return Object.freeze({key:f.key,value:f.value,label:tshirtLocatorContract.fields.find(x=>x.key===f.key).label})}))})
}
export function resolveAttributeDom({label,target=false,allowReadOnly=false}){
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const labels=[...document.querySelectorAll('label')].filter(e=>visible(e)&&e.textContent.trim()===label)
 if(labels.length!==1)throw new Error('ATTRIBUTE_LABEL_AMBIGUOUS')
 const root=labels[0].closest('[data-testid=beast-core-form-item]')
 if(!root)throw new Error('ATTRIBUTE_ROOT_MISSING')
 const inputs=[...root.querySelectorAll('input')].filter(visible)
 if(inputs.length!==1)throw new Error('ATTRIBUTE_INPUT_AMBIGUOUS')
 const input=inputs[0],select=input.closest('[data-testid=beast-core-select]')
 if(!select||!root.contains(select)||input.dataset.testid!=='beast-core-select-htmlInput'||!select.querySelector('[data-testid=beast-core-select-header]')||[...select.querySelectorAll('[class]')].some(e=>[...e.classList].some(c=>c.startsWith('ST_selectValueMultiple_'))))throw new Error('ATTRIBUTE_COMPONENT_UNSUPPORTED')
 if((input.disabled||input.readOnly)&&(!allowReadOnly||target))throw new Error('ATTRIBUTE_NOT_WRITABLE')
 if(target)return input
 return {value:input.value}
}
export async function executeAttributes(page,input,{dryRun=true}={}){
 const plan=compileAttributePlan(input),url=page.url(),completed=[]
 const guard=async()=>{
 if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page)
 const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
 if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
 }
 const read=async()=>{await guard();if(await page.locator('[role=listbox]:visible').count())throw new Error('ATTRIBUTE_CLOSE_EXISTING_POPUP');const values=[];for(const f of plan.fields)values.push({key:f.key,...await page.evaluate(resolveAttributeDom,{label:f.label})});return values}
 const before=await read()
 if(dryRun)return {status:'attributes_preflight_passed',before,expected:plan.fields,saved:false,published:false,fullProductVerified:false,optionsVerified:false}
 try{
 for(const field of plan.fields){
 const current=await read();if(field.key!=='product.brand'&&current.find(x=>x.key===field.key).value===field.value)continue
 const h=await page.evaluateHandle(resolveAttributeDom,{label:field.label,target:true})
 try{await h.asElement().click({timeout:5000})}finally{await h.dispose()}
 await guard()
 const panel=page.locator('[role=listbox]:visible');await panel.waitFor({state:'visible',timeout:5000})
 if(await panel.count()!==1)throw new Error('ATTRIBUTE_POPUP_AMBIGUOUS')
 const option=await findExactVisibleOption(page,field.value,guard)
 if(await option.count()!==1||await option.getAttribute('data-disabled')==='true'||await option.getAttribute('aria-disabled')==='true')throw new Error('ATTRIBUTE_OPTION_UNAVAILABLE')
 await option.click({timeout:5000});await panel.waitFor({state:'hidden',timeout:5000})
 const after=await read();if(after.find(x=>x.key===field.key).value!==field.value)throw new Error('ATTRIBUTE_READBACK_MISMATCH')
 completed.push(field.key)
 }
 const observed=await read();if(plan.fields.some(f=>observed.find(o=>o.key===f.key)?.value!==f.value))throw new Error('ATTRIBUTE_FINAL_MISMATCH')
 return {status:'attributes_subset_verified',expected:plan.fields,before,observed,completed,saved:false,published:false,fullProductVerified:false}
 }catch(error){error.partialResult={status:'needs_inspection',reason:error.message,before,completed,saved:false,published:false,fullProductVerified:false};throw error}
}
