import {rebuildRows,splitLabels,updateForm,type FormData} from './mvp-form.ts'
import {sizeFields,sizeUnit,parseSizeValue,type SizeField,type MeasurementRow} from './size-fields.ts'
export type PasteChange={row:string;field:string;before:string;after:string}
export type PasteResult={form:FormData;changes:PasteChange[]}
function table(text:string){
 if(text.length>100000)throw new Error('表格过大，请仅复制当前商品的数据')
 const delimiter=text.includes('\t')?'\t':',',rows:string[][]=[],row:string[]=[];let value='',quoted=false,closed=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;continue}
  if(c===delimiter||c==='\n'||c==='\r'){row.push(value.trim());value='';closed=false;if(c!==delimiter){if(row.some(Boolean))rows.push([...row]);row.length=0;if(c==='\r'&&text[i+1]==='\n')i++}continue}
  if(closed){if(c!==' ')throw new Error('引号结束后只能跟分隔符，请检查表格格式');continue}
  if(c==='"'){if(value.trim())throw new Error('单元格中间出现未转义引号，请检查表格格式');value='';quoted=true}else value+=c
 }
 if(quoted)throw new Error('表格引号不完整');row.push(value.trim());if(row.some(Boolean))rows.push(row)
 if(rows.length<2||rows.length>101)throw new Error('请连同表头复制，至少一行数据，最多100行')
 const headers=rows[0].map(h=>h.replace(/^\uFEFF/,'').replace(/（/g,'(').replace(/）/g,')').replace(/\s/g,''))
 if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw new Error('表头不能为空或重复')
 if(rows.slice(1).some(r=>r.length!==headers.length))throw new Error('每行列数必须与表头一致，空值也需保留所在列')
 return {headers,rows:rows.slice(1)}
}
export function pastePrices(form:FormData,text:string):PasteResult{
 const {headers,rows}=table(text),aliases:Record<string,string>={'颜色':'color','颜色分类':'color','尺码':'size','拼单价':'groupPrice','拼单价(元)':'groupPrice','单买价':'singlePrice','单买价(元)':'singlePrice','库存':'stock','库存(件)':'stock'}
 const keys=headers.map(h=>aliases[h]);if(keys.some(k=>!k)||new Set(keys).size!==keys.length||!keys.includes('color')||!keys.includes('size')||keys.length<3)throw new Error('表头需包含颜色、尺码，及拼单价、单买价、库存中的至少一列；不支持的列请移除')
 const expected=rebuildRows(form)
 if(expected.length!==form.rows.length||expected.some(e=>form.rows.filter(r=>r.color===e.color&&r.size===e.size).length!==1))throw new Error('请先更新颜色尺码规格表，再粘贴价格库存')
 const result=structuredClone(form.rows),changes:PasteChange[]=[],seen=new Set(),errors:string[]=[]
 rows.forEach((values,i)=>{const data=Object.fromEntries(keys.map((k,n)=>[k,values[n]])),key=JSON.stringify([data.color,data.size]),target=result.find(r=>r.color===data.color&&r.size===data.size)
 if(seen.has(key)){errors.push(`第${i+2}行：重复规格`);return}seen.add(key)
 if(!target){errors.push(`第${i+2}行：${data.color}/${data.size}不在当前规格表`);return}
 for(const field of ['groupPrice','singlePrice','stock'] as const){if(!(field in data))continue;const value=data[field];if(field==='stock'?!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)):!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)<=0||!Number.isSafeInteger(Math.round(Number(value)*100))){errors.push(`第${i+2}行：${headers[keys.indexOf(field)]}为空或格式错误`);continue}changes.push({row:`${data.color}/${data.size}`,field:headers[keys.indexOf(field)],before:target[field],after:value});target[field]=value}
 if(target.groupPrice&&target.singlePrice&&Number(target.singlePrice)<Number(target.groupPrice))errors.push(`第${i+2}行：单买价不能低于拼单价`)
 if(!target.enabled&&Number(target.stock)!==0)errors.push(`第${i+2}行：停用规格库存须为0`)
 })
 if(errors.length)throw new Error(errors.join('\n'))
 return {form:updateForm(form,{rows:result}),changes}
}
export function pasteMeasurements(form:FormData,text:string):PasteResult{
 const {headers,rows}=table(text);if(headers.filter(h=>h==='尺码').length!==1)throw new Error('表头必须包含尺码')
 const columns=headers.map(h=>{if(h==='尺码')return null;const match=h.match(/^(.+?)(下限|上限)?(?:\((cm|kg)\))?$/);const field=(Object.keys(sizeFields) as SizeField[]).find(k=>sizeFields[k].label===match?.[1]);if(!field||match?.[3]&&match[3]!==sizeUnit(field))throw new Error(`不支持的尺寸表头或单位：${h}（体重使用kg）`);if((field==='height'||field==='weight')!==((form.sizeKind??'garment')==='body_recommendation'))throw new Error('粘贴前请先选择对应的成衣实测或身高体重表型');return {field,bound:match?.[2]}})
 const fields=[...new Set(columns.flatMap(c=>c?[c.field]:[]))];if(!fields.length)throw new Error('请至少提供一个尺寸列')
 for(const field of fields){const group=columns.filter(c=>c?.field===field);if(!(group.length===1&&!group[0]?.bound)&&!(group.length===2&&group.some(c=>c?.bound==='下限')&&group.some(c=>c?.bound==='上限')))throw new Error(`${sizeFields[field].label}需一列单值/区间，或完整的上下限两列`)}
 const sizes=splitLabels(form.sizes);if(new Set(sizes.map(s=>s.toLowerCase())).size!==sizes.length)throw new Error('当前尺码重复，请先修正');if(!sizes.length)throw new Error('请先填写当前商品尺码')
 const seen=new Set(),measurements=structuredClone(form.measurements),ranges=new Map<SizeField,boolean>(),changes:PasteChange[]=[],errors:string[]=[]
 rows.forEach((values,i)=>{const size=values[headers.indexOf('尺码')];if(!sizes.includes(size)||seen.has(size)){errors.push(`第${i+2}行：尺码不存在或重复：${size}`);return}seen.add(size);const row:MeasurementRow={...measurements[size]}
 for(const field of fields){const indices=columns.flatMap((c,n)=>c?.field===field?[n]:[]),single=indices.length===1;const value=single?values[indices[0]].replace(/[～~—–]/g,'-'):values[indices.find(n=>columns[n]?.bound==='下限')!]+'-'+values[indices.find(n=>columns[n]?.bound==='上限')!];const range=!single||value.includes('-')
 try{parseSizeValue(value,range,`${size} ${sizeFields[field].label}`);if(ranges.has(field)&&ranges.get(field)!==range)throw new Error(`${sizeFields[field].label}各行单值/区间模式必须一致`);ranges.set(field,range);changes.push({row:size,field:sizeFields[field].label,before:row[field]??'',after:value});row[field]=value}catch(e){errors.push(`第${i+2}行：${(e as Error).message}`)}}measurements[size]=row})
 for(const size of sizes)if(!seen.has(size))errors.push(`缺少当前尺码：${size}，请复制所有当前尺码的数据`)
 if(errors.length)throw new Error(errors.join('\n'))
 return {form:updateForm(form,{measurements,sizeFields:[...new Set([...(form.sizeFields??['shoulder','chest']),...fields])],rangeFields:[...(form.rangeFields??[]).filter(k=>!fields.includes(k)),...fields.filter(k=>ranges.get(k))]}),changes}
}
