// Visible DOM inventory only: absence of a star is not proof of optionality.
export function observePageCoverage(){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const modals=[...document.querySelectorAll('[data-testid=beast-core-modal]')].filter(visible)
 if(modals.length)return {status:'blocked_by_modal',modalCount:modals.length,fields:[],errorSummaries:[]}
 const roots=[...document.querySelectorAll('[data-testid=beast-core-form-item]')].filter(visible)
 const fields=roots.map(root=>{
  const own=e=>e.closest('[data-testid=beast-core-form-item]')===root
  const labels=[...root.querySelectorAll('label')].filter(e=>visible(e)&&own(e)&&!e.matches('[data-testid=beast-core-radio],[data-testid=beast-core-checkbox]'))
  const required=[...root.querySelectorAll('[class]')].filter(e=>visible(e)&&own(e)&&[...e.classList].some(c=>c.startsWith('Form_itemRequired_'))&&e.textContent.trim()==='*').length>0
  const ancestorRegionIds=[];for(let parent=root.parentElement;parent;parent=parent.parentElement)if(parent.matches('[data-testid=beast-core-form-item]')&&parent.id)ancestorRegionIds.push(parent.id)
  return {id:root.id||null,ancestorRegionIds,labels:labels.map(e=>e.textContent.trim()),requiredMarker:required,visibleControlCount:[...root.querySelectorAll('input,textarea,select')].filter(e=>visible(e)&&own(e)).length}
 })
 const errorSummaries=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&e.children.length===0&&/^\d+个错误项未处理$/.test(e.textContent.trim())).map(e=>e.textContent.trim())
 return {status:'observed',fields,errorSummaries}
}
export function assessPageCoverage(inventory,contract,checks){
 const regionReaders={
  'basic.carousel_gallery':['carousel'],newSpec:['sizeChart','listing.sizeConfiguration.syncChartToDetail'],sku:['variants','skuImages'],
  'service.goods_type':['services.goodsType'],'service.second_hand':['services.secondHand'],
  'service.is_customized':['services.customized'],'service.is_pre_sale':['services.presale'],
  'service.shipment_limit_second':['listing.logistics.shippingPromise'],
  'service.support_promise_delivery':['services.nearbySameDay'],
  'service.is_default_template_id':['listing.logistics.freight'],'service.cost_template_id':['listing.logistics.freight']
 }
 const entries=inventory.fields.map(field=>{
  const matches=field.labels.length===1?contract.fields.filter(f=>f.label===field.labels[0]):[]
  const key=matches.length===1?matches[0].key:null
  const checkId={'listing.referencePrice':'listing.pricing','listing.multiItemDiscount':'listing.pricing'}[key]??key
  const ancestor=(field.ancestorRegionIds??[]).find(id=>['newSpec','sku'].includes(id))
  const checkIds=checkId?[checkId]:regionReaders[field.id]??(ancestor?regionReaders[ancestor]:field.labels.length===1&&field.labels[0]==='拼单人数'?['services.groupSize']:[])
  const readers=checkIds.map(id=>({id,status:checks.find(c=>c.id===id)?.status??'missing'}))
  return {...field,key,checkIds,status:readers.length&&readers.every(r=>r.status!=='missing')?'reader_present':readers.length?'input_or_reader_missing':'unmapped_region',readers,readbackStatus:readers.length===1?readers[0].status:null}
 })
 return {status:inventory.status,entries,errorSummaries:inventory.errorSummaries,modalCount:inventory.modalCount??0,complete:false,notes:['visible_form_items_only','required_marker_absence_does_not_prove_optional']}
}
