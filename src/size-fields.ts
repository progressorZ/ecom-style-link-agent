// Platform labels are exact; unavailable columns are handled by the live executor.
export const sizeFields = {
 height:{key:'height',label:'身高',platform:true},
 weight:{key:'weight',label:'体重',platform:true},
 shoulder:{key:'shoulderWidth',label:'肩宽',platform:true},
 chest:{key:'chestCircumference',label:'胸围',platform:true},
 waist:{key:'waistCircumference',label:'腰围',platform:true},
 hip:{key:'hipCircumference',label:'臀围',platform:true},
 length:{key:'garmentLength',label:'衣长',platform:false},
 sleeve:{key:'sleeveLength',label:'袖长',platform:false},
} as const
export type SizeField=keyof typeof sizeFields
export type MeasurementRow=Partial<Record<SizeField,string>>
export type SizeKind='garment'|'body_recommendation'
export type SizeTemplate={kind?:SizeKind;rangeFields?:SizeField[];id:string;name:string;fields:SizeField[];measurements:Record<string,MeasurementRow>}
export function validSizeFields(fields:unknown):fields is SizeField[]{return Array.isArray(fields)&&fields.length>0&&fields.every(k=>typeof k==='string'&&Object.hasOwn(sizeFields,k))&&new Set(fields).size===fields.length}
export function validateSizeTemplate(template:SizeTemplate){
 if(!template||typeof template.id!=='string'||!template.id.trim()||typeof template.name!=='string'||!template.name.trim()||template.name.length>60||!validSizeFields(template.fields)||!template.measurements||!Object.keys(template.measurements).length)throw new Error('尺码模板需要名称、尺寸字段和实测数据')
 validateSizeSelection(template.kind??'garment',template.fields,template.rangeFields??[])
 for(const [size,row] of Object.entries(template.measurements))for(const field of template.fields){if(!size.trim())throw new Error('尺码不能为空');parseSizeValue(row?.[field],template.rangeFields?.includes(field)??false,`${size} ${sizeFields[field].label}`)}

 return template
}

export function sizeUnit(field:SizeField){return field==='weight'?'kg':'cm'}
export function validateSizeSelection(kind:SizeKind,fields:SizeField[],ranges:SizeField[]){
 if(!['garment','body_recommendation'].includes(kind)||!validSizeFields(fields)||!Array.isArray(ranges)||new Set(ranges).size!==ranges.length||ranges.some(k=>!fields.includes(k)))throw new Error('尺码表类型、字段或区间设置无效')
 if(fields.some(k=>(k==='height'||k==='weight')!==(kind==='body_recommendation')))throw new Error('成衣实测与身高体重建议请分别选择模板类型')
}
export function measurementField(size:string,field:SizeField,bound:'min'|'max'|'value'='value'){return 'measurement:'+JSON.stringify([size,field,bound])}
export function parseSizeValue(value:unknown,range:boolean,label:string):number|{min:number;max:number}{
 const parts=typeof value==='string'?value.split('-').map(v=>v.trim()):[]
 const fail=(message:string,bound?:'min'|'max'):never=>{throw Object.assign(new Error(message),{bound})}
 if(!range&&(typeof value!=='string'||!value.trim()))fail(`${label}未填写，请输入实际数值`)
 if(parts.length>(range?2:1))fail(`${label}格式不正确，${range?'请分别填写区间下限和上限':'当前为单值，请只填一个数字'}`,range?'min':undefined)
 for(let i=0;i<(range?2:1);i++){
  const v=parts[i],bound=range?(i===0?'min':'max'):undefined,suffix=range?(i===0?'下限':'上限'):''
  if(!v)fail(`${label}${suffix}未填写`,bound)
  if(!/^\d+(\.\d+)?$/.test(v))fail(`${label}${suffix}只能填写数字，不要包含单位或其他文字`,bound)
  if(Number(v)<=0)fail(`${label}${suffix}必须大于0`,bound)
  if(Number(v)>300)fail(`${label}${suffix}为${v}，超过当前输入上限300，请核实单位和数值`,bound)
  if(!/^\d+(\.\d)?$/.test(v))fail(`${label}${suffix}最多保留一位小数`,bound)
 }
 if(!range)return Number(parts[0])
 const [min,max]=parts.map(Number);if(min>max)fail(`${label}下限${min}大于上限${max}，请核对区间`,'max')
 return {min,max}
}
