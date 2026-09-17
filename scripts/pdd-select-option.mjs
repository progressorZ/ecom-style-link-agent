// Inspect and scroll only the visible DOM-backed listbox; no hidden option store.
export async function findExactVisibleOption(page,name,guard,{maxScrolls=40}={}){
 const panel=page.locator('[role=listbox]:visible')
 const inspect=()=>panel.evaluate(root=>{
  const scrolls=[root,...root.querySelectorAll('*')].filter(e=>e.clientHeight>0&&e.scrollHeight>e.clientHeight&&['auto','scroll'].includes(getComputedStyle(e).overflowY))
  if(scrolls.length>1)throw new Error('ATTRIBUTE_SCROLL_AMBIGUOUS')
  if(!scrolls.length)return null
  const e=scrolls[0];return {top:e.scrollTop,height:e.clientHeight,max:e.scrollHeight-e.clientHeight}
 })
 for(let attempt=0;attempt<=maxScrolls;attempt++){
  await guard();if(await panel.count()!==1)throw new Error('ATTRIBUTE_POPUP_AMBIGUOUS')
  const option=panel.getByRole('option',{name,exact:true}),count=await option.count()
  if(count>1)throw new Error('ATTRIBUTE_OPTION_AMBIGUOUS')
  if(count===1)return option
  const state=await inspect()
  if(!state||attempt===maxScrolls||(attempt>0&&state.top>=state.max-1))throw new Error('ATTRIBUTE_OPTION_UNAVAILABLE')
  const next=attempt===0?0:Math.min(state.max,state.top+Math.max(1,Math.floor(state.height*0.75)))
  await panel.evaluate((root,top)=>{const es=[root,...root.querySelectorAll('*')].filter(e=>e.clientHeight>0&&e.scrollHeight>e.clientHeight&&['auto','scroll'].includes(getComputedStyle(e).overflowY));if(es.length!==1)throw new Error('ATTRIBUTE_SCROLL_CHANGED');es[0].scrollTop=top},next)
  await page.waitForTimeout(100)
 }
 throw new Error('ATTRIBUTE_OPTION_UNAVAILABLE')
}
