// Read-only observation of the captured carousel region. No inferred upload success.
export function observeCarousel(){
  const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'
  const roots=[...document.querySelectorAll('[data-testid="beast-core-form-item"][id="basic.carousel_gallery"]')].filter(visible)
  if(roots.length!==1)throw new Error('CAROUSEL_REGION_AMBIGUOUS')
  const root=roots[0],text=root.innerText.replace(/\s+/g,' ')
  const counts=[...text.matchAll(/已上传\s*(\d+)\s*\/\s*(\d+)\s*张/g)]
  if(counts.length!==1)throw new Error('CAROUSEL_COUNT_UNCONFIRMED')
  const inputs=[...root.querySelectorAll('input[type="file"][data-tracking-click-viewid="carousel_img_localfile_upload"]')]
  if(inputs.length!==1||inputs[0].disabled||!inputs[0].multiple)throw new Error('CAROUSEL_FILE_INPUT_UNCONFIRMED')
  const accept=inputs[0].accept.split(',').map(v=>v.trim()).sort()
  if(JSON.stringify(accept)!==JSON.stringify(['image/jpeg','image/png']))throw new Error('CAROUSEL_ACCEPT_CHANGED')
  if(!text.includes('宽高均大于480px')||!text.includes('1:1或3:4')||!text.includes('3M内'))throw new Error('CAROUSEL_POLICY_CHANGED')
  const boxes=[...root.querySelectorAll('[class*="MaterialModalButton_v2_imageBox__"]')].filter(visible)
  const images=boxes.map(e=>{
    const match=/^url\(["']?(https:\/\/[^"')]+)["']?\)$/.exec(e.style.backgroundImage)
    if(!match)throw new Error('CAROUSEL_REMOTE_URL_UNCONFIRMED')
    return {src:match[1]}
  })
  if(new Set(images.map(i=>i.src)).size!==images.length)throw new Error('CAROUSEL_DUPLICATE_REMOTE_URL')
  return {count:Number(counts[0][1]),capacity:Number(counts[0][2]),images,inputReady:true}
}
