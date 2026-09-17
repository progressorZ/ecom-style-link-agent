export function observeDetail(){
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'
 const roots=[...document.querySelectorAll('.quick-decoration-container-v2')].filter(visible)
 if(roots.length!==1)throw new Error('DETAIL_REGION_AMBIGUOUS')
 const root=roots[0],wrappers=[...root.querySelectorAll('[class*="quick_decoration_v2_sortableWrapper__"]')].filter(visible)
 if(wrappers.length!==1)throw new Error('DETAIL_EDITOR_UNCONFIRMED')
 const editor=wrappers[0],counts=[...editor.innerText.matchAll(/已上传\s*(\d+)\s*\/\s*(\d+)\s*张/g)]
 if(counts.length!==1||Number(counts[0][2])!==50)throw new Error('DETAIL_CAPACITY_CHANGED')
 const inputs=[...editor.querySelectorAll('input[type=file][data-tracking-click-viewid=detail_img_localfile_upload]')]
 if(inputs.length!==1||inputs[0].disabled||!inputs[0].multiple||inputs[0].accept.split(',').map(s=>s.trim()).sort().join(',')!=='image/jpeg,image/png')throw new Error('DETAIL_INPUT_UNCONFIRMED')
 const cards=[...editor.querySelectorAll('[class*="quick_decoration_v2_remarkImage__"]')]
 const images=cards.map((card,index)=>{
  const imgs=[...card.querySelectorAll('img[data-tracking-click-viewid=el_preview_business_details]')],labels=[...card.querySelectorAll('[class*="ImageWithRemark_v2_remark__"]')]
  if(imgs.length>1||labels.length>1||(labels.length===1&&labels[0].textContent.trim()!==String(index+1)))throw new Error('DETAIL_IMAGE_ORDER_UNCONFIRMED')
  if(imgs.length===0||labels.length===0)return {src:null,position:index+1,loaded:false,pending:true}
  return {src:imgs[0].currentSrc||imgs[0].src,position:index+1,loaded:imgs[0].complete&&imgs[0].naturalWidth>0}
 })
 return {count:Number(counts[0][1]),capacity:50,images,emptyEditorConfirmed:root.innerText.includes('暂未编辑商详')}
}
