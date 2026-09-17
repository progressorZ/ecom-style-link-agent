// Pure read/resolve callback; all mutations are performed through Playwright handles.
export function resolveMatrixDom({target,color,size}={}) {
  const visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
  const text=e=>String(e.innerText || '').replace(/\s+/g,' ').trim()
  const prefix=(e,p)=>[...e.classList].some(c=>c.startsWith(p))
  const unique=(items,code)=>{if(items.length!==1)throw new Error(code);return items[0]}
  const root=unique([...document.querySelectorAll('[data-testid="beast-core-form-item"][id="newSpec"]')].filter(visible),'SPEC_REGION_AMBIGUOUS')
  const colors=[...root.querySelectorAll('input[placeholder="选择或输入主色"]')].filter(visible)
  const radios=[...root.querySelectorAll('label[data-testid="beast-core-radio"]')].filter(visible)
  const sizes=[...root.querySelectorAll('label[data-testid="beast-core-checkbox"]')].filter(e=>visible(e)&&e.querySelector('.check-wrapper'))
  const panelMatches=[...document.querySelectorAll('[data-tracking-impr-viewid="el_color_selection_panel"]')].filter(visible)
  const panel=panelMatches.length===1?panelMatches[0]:null
  const options=panel?[...panel.querySelectorAll('[data-tracking-click-viewid="el_color_selection_panel"]')].filter(e=>prefix(e,'colorV2_colorOption__')):[]
  if(target==='emptyColor')return unique(colors.filter(e=>!e.value),'EMPTY_COLOR_INPUT_AMBIGUOUS')
  if(target==='system')return unique(radios.filter(e=>text(e)==='中国码'),'SIZE_SYSTEM_MISSING')
  if(target==='size')return unique(sizes.filter(e=>text(e.querySelector('.check-wrapper'))===size),'SIZE_OPTION_MISSING')
  if(target==='color') {
    if(!panel)throw new Error('COLOR_PANEL_AMBIGUOUS')
    const option=unique(options.filter(e=>text(e)===color),'COLOR_OPTION_MISSING_OR_AMBIGUOUS')
    if(prefix(option,'colorV2_forbidden__'))throw new Error('COLOR_OPTION_DISABLED')
    return option
  }
  if(target==='confirmColors') {
    if(!panel)throw new Error('COLOR_PANEL_AMBIGUOUS')
    return unique([...panel.parentElement.querySelectorAll('button')].filter(e=>visible(e)&&text(e)==='确认'),'COLOR_CONFIRM_AMBIGUOUS')
  }
  const skuRoots=[...document.querySelectorAll('[data-testid="beast-core-form-item"][id="sku"]')].filter(visible)
  if(skuRoots.length!==1)throw new Error('SKU_REGION_AMBIGUOUS')
  const hasValues=scope=>[...scope.querySelectorAll('input')].some(e=>!['checkbox','radio','file'].includes(e.type)&&e.value.trim())
  return {
    colors:colors.map(e=>e.value).filter(Boolean),emptyColorCount:colors.filter(e=>!e.value).length,
    system:radios.filter(e=>e.querySelector('input[type=radio]')?.checked).map(text),
    sizes:sizes.map(e=>({name:text(e.querySelector('.check-wrapper')),checked:!!e.querySelector('input[type=checkbox]')?.checked,disabled:!!e.querySelector('input[type=checkbox]')?.disabled})),
    hasSkuData:[...skuRoots[0].querySelectorAll('tbody')].some(hasValues)||!!skuRoots[0].querySelector('img'),
    hasSizeData:[...root.querySelectorAll('table')].some(hasValues),
    colorPanelCount:panelMatches.length,colorOptions:options.map(e=>({name:text(e),selected:prefix(e,'colorV2_selected__'),disabled:prefix(e,'colorV2_forbidden__')}))
  }
}
