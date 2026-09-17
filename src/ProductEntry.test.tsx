// @vitest-environment jsdom
import {act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import ProductEntry from './ProductEntry'
import {blankForm} from './mvp-form'
let root:Root,container:HTMLDivElement
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());container.remove()})
async function setup(colors='',patch:Partial<ReturnType<typeof blankForm>>={}){
 const original={...blankForm('current'),productCode:'ORIGINAL',title:'未保存的当前商品',colors,...patch}
 localStorage.setItem('mvp-entry-v1',JSON.stringify(original))
 const template={id:'t1',title:'基础商品模板',updatedAt:'now',form:{...original,id:'t1',title:'模板里的商品',productCode:''}}
 const sizeTemplate={id:'s1',name:'尺寸模板',fields:['shoulder'],measurements:{S:{shoulder:'37'}}}
 const request=vi.fn(async(path:string,body?:any):Promise<any>=>{
 if(path==='entry')return {settings:null,defaults:null,currentForm:null}
 if(path==='size-templates')return {templates:[sizeTemplate]}
 if(path==='product-templates')return {templates:[template]}
 if(path==='assets')return {name:body.name,path:'/tmp/uploaded-color.png',preview:'/api/live/assets/uploaded-color.png'}
 if(path==='test-assets')return {main:[{name:'front',path:'/tmp/front.png'}],detail:[{name:'back',path:'/tmp/back.png'}],sku:{name:'front',path:'/tmp/front.png'}}
 if(path==='next-product-code')return {id:'fresh',productCode:'NEW-1'}
 if(path==='delete-template'){expect(body.id).toBe('t1');return {templates:[]}}
 throw new Error('unexpected request '+path)
 })
 await act(async()=>root.render(<ProductEntry disabled={false} request={request} onDirty={()=>{}} onLoaded={()=>{}}/>))
 return request
}
function button(text:string){return [...container.querySelectorAll('button')].find(b=>b.textContent===text)!}
async function click(text:string){await act(async()=>button(text).click())}
async function select(value:string){const el=[...container.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value===value))!;await act(async()=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))})}
it('undo restores unsaved product values after applying an incomplete template',async()=>{
 await setup();await select('t1');await click('套用为新商品')
 expect(JSON.parse(localStorage.getItem('mvp-entry-v1')!).title).toBe('模板里的商品')
 expect(container.textContent).toContain('规格尚未完整')
 await click('撤销上次套用 / 替换')
 const restored=JSON.parse(localStorage.getItem('mvp-entry-v1')!);expect(restored.title).toBe('未保存的当前商品');expect(restored.productCode).toBe('ORIGINAL');expect(restored.confirmed).toBe(false)
})
it('template deletion requires the named inline confirmation and leaves current input intact',async()=>{
 const request=await setup();await select('t1');await click('删除所选商品模板')
 expect(request.mock.calls.some(([path])=>path==='delete-template')).toBe(false)
 expect(container.textContent).toContain('删除模板「基础商品模板」')
 await click('确认删除此模板')
 expect(request).toHaveBeenCalledWith('delete-template',{kind:'product',id:'t1',name:'基础商品模板'})
 expect(JSON.parse(localStorage.getItem('mvp-entry-v1')!).title).toBe('未保存的当前商品')
})
it('rejects too many selected images before uploading any file',async()=>{
 const request=await setup();const input=container.querySelector('input[type=file][multiple]')!
 Object.defineProperty(input,'files',{value:Array.from({length:11},()=>new File(['x'],'photo.png',{type:'image/png'}))})
 await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})))
 expect(container.textContent).toContain('最多10张');expect(request.mock.calls.some(([path])=>path==='assets')).toBe(false)
})

it('starter is opt-in, complete, and can be undone without changing store settings',async()=>{
 const request=await setup()
 expect(JSON.parse(localStorage.getItem('mvp-entry-v1')!).title).toBe('未保存的当前商品')
 expect(request.mock.calls.some(([path])=>path==='test-assets')).toBe(false)
 await click('载入完整初始示例')
 const starter=JSON.parse(localStorage.getItem('mvp-entry-v1')!);expect(starter.rows).toHaveLength(6);expect(starter.sample).toBe(true);expect(starter.confirmed).toBe(false)
 expect(request.mock.calls.some(([path])=>path==='settings'||path==='jobs')).toBe(false)
 await click('撤销上次套用 / 替换');expect(JSON.parse(localStorage.getItem('mvp-entry-v1')!).title).toBe('未保存的当前商品')
})

it('missing color image links open the exact picker and upload clears only that color issue',async()=>{
 const request=await setup('褐色,粉色')
 await click('检查全部资料（无需先勾选确认）')
 const picker=container.querySelector<HTMLInputElement>('[data-field="skuImage:褐色"]')!
 const other=container.querySelector<HTMLInputElement>('[data-field="skuImage:粉色"]')!
 const chosen=vi.spyOn(picker,'click'),untouched=vi.spyOn(other,'click')
 await click('缺少褐色颜色规格图')
 expect(chosen).toHaveBeenCalledTimes(1);expect(untouched).not.toHaveBeenCalled()
 await click('补充褐色图片');expect(chosen).toHaveBeenCalledTimes(2)
 vi.stubGlobal('createImageBitmap',async()=>({width:750,height:750,close(){}}))
 try{
 Object.defineProperty(picker,'files',{value:[new File(['fixture'],'褐色.png',{type:'image/png'})]})
 await act(async()=>{picker.dispatchEvent(new Event('change',{bubbles:true}));await vi.waitFor(()=>expect(request.mock.calls.some(([path])=>path==='assets')).toBe(true))})
 expect(button('缺少褐色颜色规格图')).toBeUndefined();expect(button('缺少粉色颜色规格图')).toBeTruthy()
 const saved=JSON.parse(localStorage.getItem('mvp-entry-v1')!);expect(saved.skuImages['褐色'].name).toBe('褐色.png');expect(saved.skuImages['粉色']).toBeUndefined()
 }finally{vi.unstubAllGlobals();chosen.mockRestore();untouched.mockRestore()}
})

it('measurement issues focus the exact size and bound with an inline explanation',async()=>{
 await setup('黑色',{sizes:'S,M',sizeFields:['hip','waist'],rangeFields:['waist'],measurements:{S:{hip:'',waist:'70-'},M:{hip:'90',waist:'70-80'}}})
 await click('检查全部资料（无需先勾选确认）')
 await click('S 臀围（cm）未填写，请输入实际数值')
 const hip=container.querySelector<HTMLInputElement>('input[aria-label="S 臀围"]')!
 expect(document.activeElement).toBe(hip);expect(hip.getAttribute('aria-invalid')).toBe('true')
 expect(document.getElementById(hip.getAttribute('aria-describedby')!)?.textContent).toContain('未填写')
 await click('S 腰围（cm）上限未填写')
 expect(document.activeElement).toBe(container.querySelector('input[aria-label="S 腰围上限"]'))
 expect(container.querySelector('input[aria-label="M 腰围上限"]')?.getAttribute('aria-invalid')).toBe('false')
})
