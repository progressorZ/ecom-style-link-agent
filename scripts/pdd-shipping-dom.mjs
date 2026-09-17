export function resolveShippingDom({targetHours}={}){
 const visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
 const roots=[...document.querySelectorAll('[data-testid="beast-core-form-item"][id="service.shipment_limit_second"]')].filter(visible)
 if(roots.length!==1)throw new Error('SHIPPING_REGION_AMBIGUOUS')
 const labels=[...roots[0].querySelectorAll('label[data-testid="beast-core-radio"]')].filter(visible)
 const options=labels.map(label=>{
  const inputs=[...label.querySelectorAll('input[type=radio]')]
  if(inputs.length!==1)throw new Error('SHIPPING_CONTROL_AMBIGUOUS')
  // Remove only the exact promotion text observed next to the 24-hour option.
  const name=label.textContent.replace('获额外流量扶持','').replace(/\s+/g,'').trim()
  return {name,checked:inputs[0].checked,disabled:inputs[0].disabled||label.getAttribute('aria-disabled')==='true',label}
 })
 if(options.filter(o=>o.checked).length!==1||new Set(options.map(o=>o.name)).size!==options.length)throw new Error('SHIPPING_STATE_AMBIGUOUS')
 const supported=['48小时发货及揽收','24小时发货及揽收','当日发货及揽收']
 if(options.some(o=>!supported.includes(o.name)))throw new Error('SHIPPING_OPTIONS_CHANGED')
 if(targetHours!==undefined){
  if(![24,48].includes(targetHours))throw new Error('SHIPPING_HOURS_UNSUPPORTED')
  const matched=options.filter(o=>o.name===`${targetHours}小时发货及揽收`)
  if(matched.length!==1||matched[0].disabled)throw new Error('SHIPPING_TARGET_UNAVAILABLE')
  return matched[0].label
 }
 const freight=[...document.querySelectorAll('[data-testid="beast-core-form-item"][id="service.is_default_template_id"]')]
 return {selected:options.find(o=>o.checked).name,options:options.map(({label,...o})=>o),freight:{status:freight.length===1?(visible(freight[0])?'visible_unverified':'hidden_unverified'):freight.length?'ambiguous':'missing',verified:false}}
}
