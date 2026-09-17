// Self-contained callback: paired header/body tables, never the preview table.
export function resolveSizeDom({columns, sizes, target, allowExtra=false}={}) {
  const visible=e=>!!e.getClientRects().length && getComputedStyle(e).visibility!=='hidden'
  const one=(xs,reason)=>{if(xs.length!==1)throw new Error(reason);return xs[0]}
  const root=one([...document.querySelectorAll('[data-testid="beast-core-form-item"][id="newSpec"]')].filter(visible),'SIZE_ROOT_AMBIGUOUS')
  const table=one([...root.querySelectorAll('[data-testid="beast-core-table"]')].filter(e=>visible(e)&&e.querySelector('[data-testid="beast-core-table-middle-header"]')),'SIZE_TABLE_AMBIGUOUS')
  const heads=[...one([...table.querySelectorAll('[data-testid="beast-core-table-middle-header"]')],'SIZE_HEADER_AMBIGUOUS').querySelectorAll('th')]
  const names=heads.map(h=>h.textContent.replace(/区间值/g,'').trim())
  if(names[0]!=='尺码'||names.at(-1)!=='操作'||new Set(names).size!==names.length)throw new Error('SIZE_HEADERS_INVALID')
  const selected=names.slice(1,-1)
  const extra=selected.filter(n=>!columns.includes(n))
  if(extra.length&&!allowExtra)throw new Error('SIZE_EXTRA_COLUMN')
  const options=[...new Set([...columns,...selected])].map(name=>{
    const label=one([...root.querySelectorAll('label[data-testid="beast-core-checkbox"]')].filter(e=>visible(e)&&e.textContent.trim()===name),'SIZE_COLUMN_UNAVAILABLE:'+name)
    const input=one([...label.querySelectorAll('input[type="checkbox"]')],'SIZE_CHECKBOX_AMBIGUOUS')
    return {name,checked:input.checked,disabled:input.disabled,label}
  })

  const ranges={},rangeInputs=new Map()
  heads.slice(1,-1).forEach((h,i)=>{const inputs=[...h.querySelectorAll('input')];if(inputs.length>1||inputs.some(e=>e.type!=='checkbox'))throw new Error('SIZE_RANGE_CONTROL_INVALID');ranges[selected[i]]=inputs[0]?.checked??false;if(inputs[0])rangeInputs.set(selected[i],inputs[0])})
  if(options.some(o=>o.checked!==selected.includes(o.name)||o.disabled))throw new Error('SIZE_COLUMN_STATE_INVALID')
  const body=one([...table.querySelectorAll('[data-testid="beast-core-table-middle-body"]')],'SIZE_BODY_AMBIGUOUS')
  const elements=new Map(), rows=[...body.querySelectorAll('tbody tr')].map(tr=>{
    const cells=[...tr.cells]
    if(!visible(tr)||cells.length!==names.length||cells.some(c=>c.colSpan!==1||c.rowSpan!==1))throw new Error('SIZE_ROW_STRUCTURE_INVALID')
    const size=cells[0].textContent.trim(),values={}
    for(let i=1;i<names.length-1;i++){
      const inputs=[...cells[i].querySelectorAll('input')],range=ranges[names[i]]
      if(inputs.length!==(range?2:1))throw new Error('SIZE_CELL_AMBIGUOUS')
      if(inputs.some(input=>!visible(input)||input.disabled||input.readOnly||!['text','number'].includes(input.type)))throw new Error('SIZE_CELL_NOT_WRITABLE')
      values[names[i]]=range?{min:inputs[0].value,max:inputs[1].value}:inputs[0].value
      inputs.forEach((input,n)=>elements.set(JSON.stringify([size,names[i],range?(n===0?'min':'max'):null]),input))
    }
    return {size,values}
  })
  if(rows.length!==sizes.length||new Set(rows.map(r=>r.size)).size!==sizes.length||rows.some(r=>!sizes.includes(r.size)))throw new Error('SIZE_ROWSET_MISMATCH')
  if(target?.rangeColumn){const input=rangeInputs.get(target.rangeColumn);if(!input||input.disabled||!visible(input))throw new Error('SIZE_RANGE_CONTROL_UNAVAILABLE');return input}
  if(target?.column)return one(options.filter(o=>o.name===target.column),'SIZE_COLUMN_TARGET').label
  if(target){const element=elements.get(JSON.stringify([target.size,target.measurement,target.bound??null]));if(!element)throw new Error('SIZE_TARGET_MISSING');return element}
  return {selected,extra,ranges,missing:columns.filter(n=>!selected.includes(n)),rows}
}
