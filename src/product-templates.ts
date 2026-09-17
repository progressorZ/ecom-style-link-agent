import {blankForm,type FormData} from './mvp-form.ts'
export type ProductTemplate={id:string;title:string;updatedAt:string;form:FormData}
// Templates may be incomplete; publication validation remains in buildPackage.
export function templateForm(input:FormData):FormData{
 if(!input||typeof input!=='object')throw new Error('缺少商品模板资料')
 const result=blankForm('template')
 for(const key of Object.keys(result) as (keyof FormData)[]){
  if(key==='id'||key==='confirmed')continue
  const value=input[key],base=result[key]
  if(value===undefined||value===null||typeof value!==typeof base||Array.isArray(value)!==Array.isArray(base))throw new Error('商品模板资料格式不正确：'+key)
  Object.assign(result,{[key]:structuredClone(value)})
 }
 for(const key of ['sample','sizeKind','rangeFields','sizeFields','sizeModes'] as const)if(input[key]!==undefined)Object.assign(result,{[key]:structuredClone(input[key])})
 if(result.rows.some(r=>!r||['color','size','merchantSku','groupPrice','singlePrice','stock'].some(k=>typeof r[k as keyof typeof r]!=='string')||typeof r.enabled!=='boolean'))throw new Error('颜色尺码规格格式不正确')
 result.productCode='';result.rows=result.rows.map(r=>({...r,merchantSku:''}));result.confirmed=false
 return result
}
