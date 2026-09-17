import {assertBasicScope} from './pdd-basic-adapter.mjs'
export function compileServicesPlan(input){
 const e=input?.expected
 const constants={goodsType:'普通商品',secondHand:'非二手',customized:'非定制',presale:'非预售',inventoryDeduction:'payment_success',groupSize:2,sevenDayReturns:true}
 const keys=[...Object.keys(constants),'nearbySameDay','authenticityPromise']
 if(input?.scope!=='pdd-tshirt-services-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||input.productCode.trim()!==input.productCode||!e||Object.keys(e).length!==keys.length||Object.keys(e).some(k=>!keys.includes(k))||Object.entries(constants).some(([k,v])=>e[k]!==v)||typeof e.nearbySameDay!=='boolean'||typeof e.authenticityPromise!=='boolean')throw new Error('SERVICES_PLAN_INVALID')
 return Object.freeze({scope:input.scope,productCode:input.productCode,expected:Object.freeze({...e})})
}
export function observeServices(){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const one=(es,key)=>{if(es.length!==1)throw new Error('SERVICE_AMBIGUOUS:'+key);return es[0]}
 const root=id=>one([...document.querySelectorAll('[data-testid=beast-core-form-item]')].filter(e=>e.id===id&&visible(e)),id)
 const values={},controls={}
 for(const [key,id,label] of [['goodsType','service.goods_type','商品类型'],['secondHand','service.second_hand','是否二手'],['customized','service.is_customized','是否定制'],['presale','service.is_pre_sale','是否预售']]){
  const r=root(id);one([...r.querySelectorAll('label')].filter(e=>e.textContent.trim()===label),label)
  const options=[...r.querySelectorAll('label[data-testid=beast-core-radio]')].filter(visible)
  const checked=options.filter(e=>e.querySelector('input[type=radio]')?.checked)
  const selected=one(checked,key)
  values[key]=selected.textContent.trim();controls[key]={disabled:selected.querySelector('input').disabled}
 }
 const checkbox=(r,label,key)=>{
  const wrapper=one([...r.querySelectorAll('label[data-testid=beast-core-checkbox]')].filter(e=>visible(e)&&e.textContent.replace(/推荐\s*$/,'').trim()===label),key)
  const input=one([...wrapper.querySelectorAll('input[type=checkbox]')],key)
  if(input.indeterminate)throw new Error('SERVICE_INDETERMINATE:'+key)
  values[key]=input.checked;controls[key]={disabled:input.disabled}
 }
 checkbox(root('service.support_promise_delivery'),'周边区域提前至当天发货及揽收，享发货享时效权益','nearbySameDay')
 checkbox(document,'7天无理由退货','sevenDayReturns');checkbox(document,'假一赔十','authenticityPromise')
 const inventory=one([...document.querySelectorAll('#goods_pattern')].filter(visible),'inventoryDeduction')
 one([...inventory.querySelectorAll('.pattern-left')].filter(e=>e.textContent.trim()==='库存扣减方式'),'inventoryLabel')
 const text=one([...inventory.querySelectorAll('.pattern-right')].filter(visible),'inventoryValue').textContent.trim()
 values.inventoryDeduction=text==='支付成功减库存'?'payment_success':text
 const group=one([...document.querySelectorAll('[data-testid=beast-core-form-item]')].filter(e=>visible(e)&&[...e.querySelectorAll('label')].some(l=>l.textContent.trim()==='拼单人数')),'groupSize')
 if(group.querySelector('input,select'))throw new Error('GROUP_SIZE_CONTROL_UNSUPPORTED')
 const groupText=group.innerText.replace('拼单人数','').trim()
 if(!/^\d+$/.test(groupText))throw new Error('GROUP_SIZE_UNKNOWN')
 values.groupSize=Number(groupText)
 return {values,controls}
}
export async function verifyServices(page,input){
 const plan=compileServicesPlan(input),url=page.url()
 const guard=async()=>{if(page.url()!==url)throw new Error('PAGE_CHANGED');await assertBasicScope(page);const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible');if(await code.count()!==1||await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')}
 await guard();const observed=await page.evaluate(observeServices);await guard()
 const differences=Object.entries(plan.expected).filter(([k,v])=>observed.values[k]!==v).map(([field,expected])=>({field,expected,observed:observed.values[field]}))
 return {status:differences.length?'services_mismatch':'services_subset_verified',expected:plan.expected,observed,differences,readOnly:true,saved:false,published:false,fullProductVerified:false}
}
