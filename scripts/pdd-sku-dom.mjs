// Runs atomically in the page: resolve by current table headers and business keys.
// When target is supplied, returns the current DOM control for Playwright to act on.
export function resolveSkuDom({ expectedKeys, target, includeImages = false } = {}) {
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim()
  const visible = e => { const b=e.getBoundingClientRect(),s=getComputedStyle(e); return b.width>0 && b.height>0 && s.display!=='none' && s.visibility!=='hidden' }
  const roots=[...document.querySelectorAll('[data-testid="beast-core-form-item"][id="sku"]')].filter(visible)
  if(roots.length!==1) throw new Error('SKU_REGION_AMBIGUOUS')
  const tables=[...roots[0].querySelectorAll('table')].filter(visible)
  const required={color:'颜色分类',size:'尺码',stock:'库存',groupPriceMinor:'拼单价(元)',singlePriceMinor:'单买价(元)',merchantSku:'规格编码',enabled:'状态'}
  const matches=tables.map(table=>({table,headers:[...table.querySelectorAll('thead th')].map(e=>clean(e.textContent).replace(/^\*\s*/,''))})).filter(t=>Object.values(required).every(h=>t.headers.filter(v=>v===h).length===1))
  if(matches.length!==1) throw new Error('SKU_TABLE_MISSING_OR_AMBIGUOUS')
  const {table,headers}=matches[0], columns=Object.fromEntries(Object.entries(required).map(([k,h])=>[k,headers.indexOf(h)]))
  const rows=[],seen=new Set(),spans=new Map(),targets=new Map()
  const domRows=[...table.querySelectorAll('tbody tr')]
  if(domRows.some(row=>!visible(row)))throw new Error('SKU_HIDDEN_ROWS_UNSUPPORTED')
  for(const row of domRows) {
    const pending=[...row.children].filter(e=>e.tagName==='TD'),cells=[]
    for(let col=0;col<headers.length;col++) {
      const span=spans.get(col)
      if(span){cells[col]=span.cell;if(--span.left===0)spans.delete(col);continue}
      const cell=pending.shift()
      if(!cell || cell.colSpan!==1 || cell.rowSpan<1)throw new Error('SKU_ROW_STRUCTURE_UNSUPPORTED')
      cells[col]=cell
      if(cell.rowSpan>1)spans.set(col,{cell,left:cell.rowSpan-1})
    }
    if(pending.length)throw new Error('SKU_ROW_STRUCTURE_UNSUPPORTED')
    const color=clean(cells[columns.color].textContent),size=clean(cells[columns.size].textContent),key=JSON.stringify([color,size])
    if(!color || !size || seen.has(key))throw new Error('SKU_DUPLICATE_OR_EMPTY_KEY')
    seen.add(key)
    const record={key,color,size,values:{},controls:{}}
    for(const field of ['stock','groupPriceMinor','singlePriceMinor','merchantSku']) {
      const cell=cells[columns[field]]
      if(cell.parentElement!==row)throw new Error('SKU_SHARED_EDITABLE_CELL')
      const inputs=[...cell.querySelectorAll('input')].filter(e=>visible(e) && ['text','number'].includes(e.type))
      if(inputs.length!==1)throw new Error('SKU_INPUT_AMBIGUOUS:'+key+':'+field)
      const input=inputs[0]
      record.values[field]=input.value
      record.controls[field]={disabled:input.disabled || input.getAttribute('aria-disabled')==='true',readOnly:input.readOnly}
      targets.set(key+':'+field,input)
    }
    if(includeImages){
      const indexes=headers.flatMap((h,i)=>h==='预览图'?[i]:[])
      if(indexes.length!==1)throw new Error('SKU_IMAGE_HEADER_AMBIGUOUS')
      const cell=cells[indexes[0]]
      if(cell.parentElement!==row||cell.rowSpan!==1)throw new Error('SKU_SHARED_IMAGE_CELL')
      const containers=[...cell.querySelectorAll('.goods-sku-img')]
      if(containers.length!==1)throw new Error('SKU_IMAGE_CONTAINER_AMBIGUOUS')
      const previews=[...containers[0].querySelectorAll('[data-tracking-click-viewid="el_specification_batch_modification_preview_picture"]')]
      const inputs=[...containers[0].querySelectorAll('input[type="file"]')]
      if(previews.length>1||inputs.length>1||(previews.length===0&&inputs.length!==1))throw new Error('SKU_IMAGE_CONTROL_AMBIGUOUS')
      let src=null
      if(previews.length){
        const match=/^url\(["']?(https:\/\/[^"')]+)["']?\)$/.exec(previews[0].style.backgroundImage)
        if(!match)throw new Error('SKU_IMAGE_URL_UNCONFIRMED')
        src=match[1]
      }
      if(inputs.length){
        if(inputs[0].disabled||inputs[0].accept.split(',').map(v=>v.trim()).sort().join(',')!=='image/jpeg,image/png')throw new Error('SKU_IMAGE_INPUT_UNCONFIRMED')
        targets.set(key+':image',inputs[0])
      }
      record.image={src,uploadAvailable:inputs.length===1}
    }
    const stateCell=cells[columns.enabled],state=clean(stateCell.textContent)
    if(state!=='已启用' && state!=='已停用')throw new Error('SKU_STATE_UNKNOWN:'+key)
    const switches=[...stateCell.querySelectorAll('[data-testid="beast-core-switch"]')].filter(visible)
    if(stateCell.parentElement!==row || switches.length!==1)throw new Error('SKU_SWITCH_AMBIGUOUS')
    record.values.enabled=state==='已启用'
    record.controls.enabled={disabled:switches[0].matches('[disabled],[aria-disabled="true"],[data-status="disabled"]'),readOnly:false}
    targets.set(key+':enabled',switches[0]);rows.push(record)
  }
  if(spans.size || !rows.length)throw new Error('SKU_ROWS_INCOMPLETE')
  if(expectedKeys && (expectedKeys.length!==rows.length || expectedKeys.some(key=>!seen.has(key))))throw new Error('SKU_SET_MISMATCH')
  if(target){const input=targets.get(target.key+':'+target.field);if(!input)throw new Error('SKU_TARGET_MISSING');return input}
  return rows
}
