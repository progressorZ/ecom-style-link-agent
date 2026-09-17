// Read-only region inventory. Missing sections never become globally ready.
export function observePddRegions() {
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const visible = (e) => { const b = e.getBoundingClientRect(), s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const ids = { variants: 'sku', specifications: 'newSpec', mainImages: 'basic.carousel_gallery', packaging: 'basic.pack_label_image', video: 'basic.carousel_video', shipping: 'service.shipment_limit_second', freight: 'service.is_default_template_id' }
  const regions = Object.fromEntries(Object.entries(ids).map(([key, id]) => {
    const matches = [...document.querySelectorAll('[data-testid="beast-core-form-item"][id]')].filter(e => e.id === id && visible(e))
    const region = matches.length === 1 ? matches[0] : null
    return [key, { id, count: matches.length, status: region ? 'located' : matches.length ? 'ambiguous' : 'not_visible',
      buttons: region ? [...region.querySelectorAll('button,[role="button"]')].filter(visible).map(e => clean(e.textContent)) : [],
      fileInputs: region ? region.querySelectorAll('input[type="file"]').length : 0,
      options: region ? [...region.querySelectorAll('label')].filter(e=>visible(e) && e.querySelector('input[type="radio"],input[type="checkbox"]')).map(e=>({label:clean(e.textContent),checked:!!e.querySelector('input')?.checked,disabled:!!e.querySelector('input')?.disabled})) : [] }]
  }))
  const skuMatches = [...document.querySelectorAll('[data-testid="beast-core-form-item"][id]')].filter(e=>e.id===ids.variants && visible(e))
  const sku = skuMatches.length === 1 ? skuMatches[0] : null
  const tables = sku ? [...sku.querySelectorAll('table')].filter(visible).map(table => ({
    headers: [...table.querySelectorAll('thead th')].map(e=>clean(e.textContent).replace(/^\*\s*/, '')),
    rows: [...table.querySelectorAll('tbody tr')].filter(visible).map(row=>({ cells: [...row.children].filter(e=>e.tagName==='TD').map(cell=>({text:clean(cell.textContent), rowSpan:cell.rowSpan, colSpan:cell.colSpan, inputCount:[...cell.querySelectorAll('input')].filter(visible).length, imageCount:cell.querySelectorAll('img').length})) }))
  })) : []
  const spec = [...document.querySelectorAll('[data-testid="beast-core-form-item"][id]')].filter(e=>e.id===ids.specifications && visible(e))
  const sizeTables = spec.length===1 ? [...spec[0].querySelectorAll('table')].filter(visible).map(table=>({headers:[...table.querySelectorAll('th')].map(e=>clean(e.textContent)),rows:[...table.querySelectorAll('tbody tr')].filter(visible).map(row=>[...row.children].map(cell=>({text:clean(cell.textContent),inputCount:[...cell.querySelectorAll('input')].filter(visible).length})))})) : []
  return { regions, sizeTables, skuTables: tables, ready: false, unverified: ['categoryIdentity','sizeChart','detailImages','uploadCompletion','rowReadback','freightSelection'] }
}

export function indexSkuRows(table) {
  const normalizedHeaders=table.headers.map(h=>h==='颜色分类'?'颜色':h)
  const required = ['颜色', '尺码', '库存', '拼单价(元)', '单买价(元)', '规格编码']
  const indexes = Object.fromEntries(required.map(name => [name, normalizedHeaders.reduce((hits,h,i)=>h===name?[...hits,i]:hits,[])]))
  if (required.some(name => indexes[name].length !== 1)) throw new Error('SKU_HEADERS_MISSING_OR_AMBIGUOUS')
  const result = [], seen = new Set(), spans = new Map()
  for (const row of table.rows) {
    const cells = [], pending = [...row.cells]
    for (let col=0;col<table.headers.length;col++) {
      const span = spans.get(col)
      if (span) { cells[col]=span.cell; if (--span.left===0) spans.delete(col); continue }
      const cell=pending.shift()
      if (!cell || cell.colSpan !== 1 || !Number.isInteger(cell.rowSpan) || cell.rowSpan < 1) throw new Error('SKU_ROW_STRUCTURE_UNSUPPORTED')
      cells[col]=cell
      if (cell.rowSpan>1) spans.set(col,{cell,left:cell.rowSpan-1})
    }
    if (pending.length) throw new Error('SKU_ROW_STRUCTURE_UNSUPPORTED')
    const color = cells[indexes['颜色'][0]].text.trim(), size = cells[indexes['尺码'][0]].text.trim()
    const key=JSON.stringify([color,size])
    if (!color || !size || seen.has(key)) throw new Error('SKU_ROW_KEY_MISSING_OR_DUPLICATE')
    seen.add(key)
    const fields = Object.fromEntries(required.slice(2).map(name=>[name,{column:indexes[name][0],...cells[indexes[name][0]]}]))
    if (Object.values(fields).some(cell=>cell.inputCount!==1)) throw new Error('SKU_ROW_INPUT_MISSING_OR_AMBIGUOUS')
    result.push({key,color,size,fields})
  }
  if (spans.size) throw new Error('SKU_ROWSPAN_INCOMPLETE')
  if (!result.length) throw new Error('SKU_ROWS_EMPTY')
  return result
}
