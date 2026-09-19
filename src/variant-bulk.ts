import {parseTabularInput} from './tabular-input'
import type {DraftVariant} from './listing-draft'

export type VariantBulkResult={variants:DraftVariant[];changes:number}
export function pasteVariantTable(current:DraftVariant[],text:string):VariantBulkResult{
 const {headers,rows}=parseTabularInput(text),aliases:Record<string,keyof DraftVariant|undefined>={'颜色':'color','颜色分类':'color','尺码':'size','鞋码':'size','拼单价':'groupPrice','拼单价(元)':'groupPrice','单买价':'singlePrice','单买价(元)':'singlePrice','库存':'stock','库存(件)':'stock'}
 const keys=headers.map(header=>aliases[header])
 if(keys.some(key=>!key)||!keys.includes('color')||!keys.includes('size')||!keys.some(key=>['groupPrice','singlePrice','stock'].includes(String(key))))throw new Error('表头需包含颜色、鞋码，以及拼单价、单买价、库存中的至少一列')
 const variants=structuredClone(current),seen=new Set<string>(),errors:string[]=[];let changes=0
 rows.forEach((values,index)=>{const data=Object.fromEntries(keys.map((key,column)=>[key!,values[column]])),id=`${data.color}\0${data.size}`
  if(seen.has(id)){errors.push(`第 ${index+2} 行规格重复`);return}seen.add(id)
  const target=variants.find(row=>row.color===data.color&&row.size===data.size)
  if(!target){errors.push(`第 ${index+2} 行 ${data.color}/${data.size} 不在当前规格表`);return}
  for(const key of ['groupPrice','singlePrice','stock'] as const){if(!(key in data))continue;const value=data[key];const valid=key==='stock'?/^\d+$/.test(value):/^\d+(\.\d{1,2})?$/.test(value)&&Number(value)>0;if(!valid){errors.push(`第 ${index+2} 行 ${headers[keys.indexOf(key)]} 格式错误`);continue}if(target[key]!==value){target[key]=value;changes++}}
  if(target.groupPrice&&target.singlePrice&&Number(target.singlePrice)<Number(target.groupPrice))errors.push(`第 ${index+2} 行单买价不能低于拼单价`)
 })
 if(errors.length)throw new Error(errors.join('\n'))
 return {variants,changes}
}
