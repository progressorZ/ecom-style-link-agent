const defaultLabels=Object.freeze([
 '品牌','鞋面材质','鞋底材质','鞋帮高度','适用性别','适用年龄段','闭合方式','上市时节',
 '适用季节','适用人群','功能','风格','制作工艺','是否加绒','商品资质','童鞋尺码'
])

function discoveryErrorReason(error){
 const message=error instanceof Error?error.message:String(error)
 return message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0]??message.split('\n')[0]
}

function resolveSelect({label,target=false}){
 const visible=element=>{const box=element.getBoundingClientRect(),style=getComputedStyle(element);return box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden'}
 const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
 const labels=[...document.querySelectorAll('label')].filter(element=>visible(element)&&clean(element.textContent).replace(/^\*\s*/,'')===label)
 if(labels.length!==1)throw new Error(labels.length?'LABEL_AMBIGUOUS':'LABEL_NOT_FOUND')
 let root=labels[0]
 for(let depth=0;depth<8&&root;depth+=1,root=root.parentElement){
  const selects=[...root.querySelectorAll('[data-testid="beast-core-select"]')].filter(visible)
  if(selects.length!==1)continue
  const header=selects[0].querySelector('[data-testid="beast-core-select-header"]'),input=selects[0].querySelector('input')
  if(!header||!input||!visible(header))throw new Error('SELECT_STRUCTURE_UNSUPPORTED')
  if(target)return header
  return {value:input.value??'',disabled:Boolean(input.disabled),readOnly:Boolean(input.readOnly)}
 }
 throw new Error('SELECT_NOT_FOUND')
}

async function readAllOptions(page,{maxScrolls=80}={}){
 const panel=page.locator('[role=listbox]:visible')
 if(await panel.count()!==1)throw new Error('LISTBOX_MISSING_OR_AMBIGUOUS')
 const values=new Set()
 for(let attempt=0;attempt<=maxScrolls;attempt+=1){
  for(const value of await panel.locator('[role=option]').allTextContents()){
   const clean=value.replace(/\s+/g,' ').trim();if(clean)values.add(clean)
  }
  const state=await panel.evaluate(root=>{
   const candidates=[root,...root.querySelectorAll('*')].filter(element=>element.clientHeight>0&&element.scrollHeight>element.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(element).overflowY))
   if(candidates.length>1)return {ambiguous:true}
   if(!candidates.length)return null
   const element=candidates[0];return {top:element.scrollTop,height:element.clientHeight,max:element.scrollHeight-element.clientHeight}
  })
  if(!state)break
  if(state.ambiguous)throw new Error('LISTBOX_SCROLL_AMBIGUOUS')
  if(state.top>=state.max-1||attempt===maxScrolls)break
  await panel.evaluate((root,next)=>{const candidates=[root,...root.querySelectorAll('*')].filter(element=>element.clientHeight>0&&element.scrollHeight>element.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(element).overflowY));if(candidates.length!==1)throw new Error('LISTBOX_SCROLL_CHANGED');candidates[0].scrollTop=next},Math.min(state.max,state.top+Math.max(1,Math.floor(state.height*.8))))
  await page.waitForTimeout(80)
 }
 return [...values]
}

export async function discoverPddSelectOptions(page,{labels=defaultLabels}={}){
 const url=new URL(page.url())
 if(url.origin!=='https://mms.pinduoduo.com'||url.pathname!=='/goods/goods_add/index')throw new Error('DISCOVERY_PAGE_OUT_OF_SCOPE')
 if(await page.locator('[role=listbox]:visible').count())throw new Error('DISCOVERY_CLOSE_EXISTING_DROPDOWN')
 const results=[]
 for(const label of labels){
  const beforeUrl=page.url()
  try{
   const before=await page.evaluate(resolveSelect,{label})
   if(before.disabled){results.push({label,status:'disabled',options:[]});continue}
   const handle=await page.evaluateHandle(resolveSelect,{label,target:true})
   try{await handle.asElement().click({timeout:5000})}finally{await handle.dispose()}
   if(page.url()!==beforeUrl)throw new Error('PAGE_CHANGED')
   await page.locator('[role=listbox]:visible').waitFor({state:'visible',timeout:3000})
   const options=await readAllOptions(page)
   if(!options.length)throw new Error('LISTBOX_OPTIONS_EMPTY')
   await page.keyboard.press('Escape')
   await page.locator('[role=listbox]:visible').waitFor({state:'hidden',timeout:3000}).catch(()=>{})
   const after=await page.evaluate(resolveSelect,{label})
   if(after.value!==before.value)throw new Error('VALUE_CHANGED')
   results.push({label,status:'collected',currentValue:before.value,options})
  }catch(error){
   await page.keyboard.press('Escape').catch(()=>{})
   results.push({label,status:'unreadable',reason:discoveryErrorReason(error),options:[]})
  }
 }
 return {capturedAt:new Date().toISOString(),page:`${url.origin}${url.pathname}`,readOnly:true,results}
}

export {defaultLabels as boardShoesDiscoveryLabels}
