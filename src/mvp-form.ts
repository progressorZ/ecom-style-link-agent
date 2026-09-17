import {measurementField,sizeFields,validSizeFields,sizeUnit,parseSizeValue,validateSizeSelection,type SizeKind,type SizeField,type MeasurementRow,type SizeTemplate} from './size-fields.ts'
// Shared by the real form and local Node service. No platform values are guessed.
export const attributeLabels:Record<string,string> = {
 collar:'领型',sleeveLength:'袖长',fabricName:'面料俗称',material:'材质',composition:'成分含量选项',
 primaryStyle:'主风格',secondaryStyle:'风格',fashionElements:'流行元素（逗号分隔）',fleece:'是否加绒',
 gramsPerSquareMeter:'面料克重选项',yarnCount:'纱支',fit:'版型',garmentLength:'衣长',sleeveType:'袖型',ageRange:'适用年龄',listingSeason:'上市年份季节'
}
export type Picture={name:string;path:string;preview?:string}
export type SkuRow={color:string;size:string;merchantSku:string;groupPrice:string;singlePrice:string;stock:string;enabled:boolean}
export type ReuseChecks={priceStock:boolean;images:boolean;sizes:boolean}
export type FormData={sample?:boolean;reuse?:{sourceTitle?:string;sourceId:string;checks:ReuseChecks};id:string;productCode:string;title:string;brand:string;attributes:Record<string,string>;colors:string;sizes:string;rows:SkuRow[];sizeModes?:Partial<Record<SizeKind,{fields:SizeField[];ranges:SizeField[]}>>;sizeKind?:SizeKind;rangeFields?:SizeField[];sizeFields?:SizeField[];measurements:Record<string,MeasurementRow>;main:Picture[];detail:Picture[];skuImages:Record<string,Picture>;referencePrice:string;discount:string;shipping:string;nearbySameDay:boolean;authenticityPromise:boolean;confirmed:boolean}
export function blankForm(id:string):FormData{return {id,productCode:'',title:'',brand:'',attributes:Object.fromEntries(Object.keys(attributeLabels).map(k=>[k,''])),colors:'',sizes:'',rows:[],measurements:{},main:[],detail:[],skuImages:{},referencePrice:'',discount:'',shipping:'48h_handover',nearbySameDay:false,authenticityPromise:false,confirmed:false}}
export function splitLabels(value:string){return value.split(/[,，\n]/).map(s=>s.trim()).filter(Boolean)}
const commonColorCodes:Record<string,string>={白色:'WHT',黑色:'BLK',灰色:'GRY',红色:'RED',粉色:'PNK',蓝色:'BLU',绿色:'GRN',黄色:'YLW',紫色:'PUR',米色:'BEI',棕色:'BRN',橙色:'ORG'}
function safeCode(value:string,fallback:string){const ascii=value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');return ascii||fallback}
export function generatedSkuCode(productCode:string,color:string,size:string,colorIndex:number){return `${safeCode(productCode,'ITEM')}-${commonColorCodes[color]??`C${String(colorIndex+1).padStart(2,'0')}`}-${((/^[A-Z0-9]+$/.test(size)&&!/^U[0-9A-F]+$/.test(size))?size:'U'+Array.from(size).map(c=>c.codePointAt(0)!.toString(16)).join('_'))}`}
export function regenerateSkuCodes(form:FormData,productCode=form.productCode):SkuRow[]{const colors=splitLabels(form.colors);return form.rows.map(r=>({...r,merchantSku:generatedSkuCode(productCode,r.color,r.size,Math.max(0,colors.indexOf(r.color)))}))}
export function rebuildRows(form:FormData):SkuRow[]{
 const colors=splitLabels(form.colors),sizes=splitLabels(form.sizes)
 if(!colors.length||!sizes.length)throw new Error('请先填写颜色和尺码，用逗号分隔')
 if(new Set(colors).size!==colors.length||new Set(sizes.map(s=>s.toLowerCase())).size!==sizes.length)throw new Error('颜色或尺码重复（包括仅大小写不同），请删除重复项')
 if(colors.length>10)throw new Error('当前最多支持10种颜色，每种颜色对应一张规格图')
 if(colors.length*sizes.length>40)throw new Error('本版单款最多支持 40 个规格，请减少组合')
 return colors.flatMap((color,ci)=>sizes.map(size=>{const previous=form.rows.find(r=>r.color===color&&r.size===size);return {color,size,merchantSku:generatedSkuCode(form.productCode,color,size,ci),groupPrice:previous?.groupPrice??'',singlePrice:previous?.singlePrice??'',stock:previous?.stock??'',enabled:previous?.enabled??true}}))
}
export function copyAsNewProduct(source:FormData,{id,productCode}:{id:string;productCode:string}):FormData{
 const copy=structuredClone(source);copy.id=id;copy.productCode=productCode;copy.rows=regenerateSkuCodes(copy,productCode);copy.confirmed=false;copy.reuse={sourceId:source.id,checks:{priceStock:false,images:false,sizes:false}};return copy
}
export function reuseConfirmed(form:FormData){return !form.reuse||(['priceStock','images','sizes'] as const).every(k=>form.reuse?.checks?.[k]===true)}
export function updateForm(form:FormData,patch:Partial<FormData>):FormData{
 const next={...form,...patch,confirmed:false}
 if(form.reuse){
  const checks={...form.reuse.checks}
  if('rows' in patch||'referencePrice' in patch||'discount' in patch)checks.priceStock=false
  if('main' in patch||'detail' in patch||'skuImages' in patch)checks.images=false
  if('sizeKind' in patch||'rangeFields' in patch||'sizeFields' in patch||'measurements' in patch||'colors' in patch||'sizes' in patch)checks.sizes=false
  if('colors' in patch||'sizes' in patch){checks.priceStock=false;checks.images=false}
  next.reuse={...form.reuse,checks}
 }
 return next
}
export function setReuseCheck(form:FormData,key:keyof ReuseChecks,checked:boolean):FormData{
 return {...form,confirmed:false,...(form.reuse?{reuse:{...form.reuse,checks:{...form.reuse.checks,[key]:checked}}}:{})}
}
function text(value:unknown,label:string):string{if(typeof value!=='string'||!value.trim())throw new Error(`请填写${label}`);return value.trim()}
function money(value:string,label:string){if(!/^\d+(\.\d{1,2})?$/.test(value))throw new Error(`${label}请输入金额，最多两位小数`);const [a,b='']=value.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0)throw new Error(`${label}必须大于 0`);return n}
export function buildPackage(form:FormData,shopKey:string,profileKey:string,now=new Date().toISOString()){
 if(!reuseConfirmed(form))throw new Error('请重新确认复用的价格库存、图片和尺码表')
 if(form.confirmed!==true)throw new Error('请先核对资料及图片，并勾选确认')
 const code=text(form.productCode,'货号'),title=text(form.title,'标题'),brand=text(form.brand,'品牌'),id=text(form.id,'商品标识')
 const expected=rebuildRows(form)
 if(form.rows.length!==expected.length||expected.some(e=>form.rows.filter(r=>r.color===e.color&&r.size===e.size).length!==1))throw new Error('颜色或尺码已更改，请重新生成规格表')
 const colors=splitLabels(form.colors),sizes=splitLabels(form.sizes),attributes:Record<string,string|string[]>={}
 for(const [key,label] of Object.entries(attributeLabels)){const v=text(form.attributes[key],label);attributes[key]=key==='fashionElements'?splitLabels(v):v}
 const variants=form.rows.map((r,i)=>({id:`v-${i}`,merchantSku:text(r.merchantSku,`${r.color}/${r.size} 规格编码`),colorKey:`color-${colors.indexOf(r.color)}`,colorLabel:r.color,sizeKey:r.size.toLowerCase(),sizeLabel:r.size}))
 if(new Set(variants.map(v=>v.merchantSku)).size!==variants.length)throw new Error('规格编码重复，请点击更新颜色尺码规格')
 if(new Set(sizes.map(s=>s.toLowerCase())).size!==sizes.length)throw new Error('尺码不能仅大小写不同')
 const assets:Array<{id:string;sourcePath:string;role:string;order:number;reviewStatus:string;colorKey?:string}>=[]
 for(const role of ['main','detail'] as const){if(form[role].length>10)throw new Error(`${role==='main'?'主图':'详情图'}最多10张，请移除多余图片`);if(!form[role].length)throw new Error(`请选择${role==='main'?'主图':'详情图'}`);form[role].forEach((p,i)=>assets.push({id:`${role}-${i}`,sourcePath:text(p.path,'图片文件'),role,order:i,reviewStatus:'approved'}))}
 colors.forEach((color,i)=>assets.push({id:`sku-${i}`,sourcePath:text(form.skuImages[color]?.path,`${color} 颜色规格图片`),role:'sku',order:i,reviewStatus:'approved',colorKey:`color-${i}`}))
 const offers=form.rows.map((r,i)=>{if(!/^\d+$/.test(r.stock)||!Number.isSafeInteger(Number(r.stock)))throw new Error(`${r.color}/${r.size} 库存必须是明确的非负整数`);return {variantId:variants[i].id,prices:[{role:'sale',amountMinor:money(r.groupPrice,`${r.color}/${r.size} 拼单价`),currency:'CNY'},{role:'platform:pdd.single',amountMinor:money(r.singlePrice,`${r.color}/${r.size} 单买价`),currency:'CNY'}],stock:Number(r.stock),enabled:r.enabled,skuAssetId:`sku-${colors.indexOf(r.color)}`}})
 const selected=form.sizeFields??['shoulder','chest']
 if(!validSizeFields(selected))throw new Error('请选择有效且不重复的尺码表字段')
 validateSizeSelection(form.sizeKind??'garment',selected,form.rangeFields??[])
 const platformFields=selected.filter(k=>sizeFields[k].platform)
 if(!platformFields.length)throw new Error('请至少选择一个平台支持的实测字段：肩宽、胸围、腰围或臀围')
 const rows=sizes.map(size=>{const m=form.measurements[size],values:Record<string,number|{min:number;max:number}>={};for(const field of selected){const value=parseSizeValue(m?.[field],form.rangeFields?.includes(field)??false,`${size} ${sizeFields[field].label}（${sizeUnit(field)}）`);if(sizeFields[field].platform)values[sizeFields[field].key]=value}return {sizeKey:size.toLowerCase(),values}})

 if(!/^([5-8](\.\d)?|9(\.[0-9])?)$/.test(form.discount))throw new Error('满2件折扣请输入 5.0～9.9；当前模板仅支持此促销形式')
 return {schemaVersion:'0.1',product:{id,productCode:code,name:title,categoryKey:'womenswear.tshirt',brand,revision:1,attributes},variants,assets,sizeCharts:[{id:'garment',kind:form.sizeKind??'garment',columns:platformFields.map(k=>({key:sizeFields[k].key,label:sizeFields[k].label,unit:sizeUnit(k)})),rows}],listing:{platform:'pdd',shopKey,categoryBindingKey:'tshirt-unverified',title,revision:1,sizeConfiguration:{templateKey:'womens-tops-cn-platform-recommended-unverified',system:'cn',selectedSizeKeys:sizes.map(s=>s.toLowerCase()),syncChartToDetail:false},offers,pricing:{referenceAmountMinor:money(form.referencePrice,'参考价'),multiItemDiscount:{count:2,discount:Number(form.discount)}},inventoryConfirmedAt:now,logistics:{profileKey,inventoryDeduction:'payment_success',shippingPromise:form.shipping},services:{goodsType:'普通商品',secondHand:'非二手',customized:'非定制',presale:'非预售',groupSize:2,sevenDayReturns:true,nearbySameDay:form.nearbySameDay,authenticityPromise:form.authenticityPromise}},evidence:[{fieldPath:'/',source:'manual',confirmed:true,reference:'用户在真实单款录入表单核对资料及图片；不代表平台审核或可售'}]}
}
export function formFromPackage(pkg:ReturnType<typeof buildPackage>):FormData{
 const f=blankForm(pkg.product.id),price=(minor:number|undefined)=>minor===undefined?'':(minor/100).toFixed(2)
 Object.assign(f,{productCode:pkg.product.productCode,title:pkg.listing.title,brand:pkg.product.brand,colors:[...new Set(pkg.variants.map(v=>v.colorLabel))].join(','),sizes:[...new Set(pkg.variants.map(v=>v.sizeLabel))].join(','),referencePrice:price(pkg.listing.pricing?.referenceAmountMinor),discount:String(pkg.listing.pricing?.multiItemDiscount?.discount??''),shipping:pkg.listing.logistics.shippingPromise,nearbySameDay:pkg.listing.services?.nearbySameDay??false,authenticityPromise:pkg.listing.services?.authenticityPromise??false})
 for(const k of Object.keys(attributeLabels)){const v=pkg.product.attributes[k];f.attributes[k]=Array.isArray(v)?v.join(','):String(v??'')}
 f.rows=pkg.variants.map(v=>{const offer=pkg.listing.offers.find(o=>o.variantId===v.id);return {color:v.colorLabel,size:v.sizeLabel,merchantSku:v.merchantSku,groupPrice:price(offer?.prices.find(p=>p.role==='sale')?.amountMinor),singlePrice:price(offer?.prices.find(p=>p.role==='platform:pdd.single')?.amountMinor),stock:offer?String(offer.stock):'',enabled:offer?.enabled??true}})
 f.sizeKind=pkg.sizeCharts[0]?.kind??'garment'
 f.sizeFields=(Object.keys(sizeFields) as SizeField[]).filter(k=>pkg.sizeCharts[0]?.columns.some(c=>c.key===sizeFields[k].key))
 for(const r of pkg.sizeCharts[0]?.rows??[]){const label=pkg.variants.find(v=>v.sizeKey===r.sizeKey)?.sizeLabel;if(label)f.measurements[label]=Object.fromEntries(f.sizeFields.map(k=>[k,typeof r.values[sizeFields[k].key]==='object'?`${(r.values[sizeFields[k].key] as {min:number;max:number}).min}-${(r.values[sizeFields[k].key] as {min:number;max:number}).max}`:String(r.values[sizeFields[k].key]??'')]))}

 f.rangeFields=f.sizeFields.filter(k=>typeof pkg.sizeCharts[0]?.rows[0]?.values[sizeFields[k].key]==='object')
 for(const asset of [...pkg.assets].sort((a,b)=>a.order-b.order)){const picture={name:asset.sourcePath.split('/').at(-1)??asset.id,path:asset.sourcePath};if(asset.role==='main'||asset.role==='detail')f[asset.role].push(picture);if(asset.role==='sku'){const color=pkg.variants.find(v=>v.colorKey===asset.colorKey)?.colorLabel;if(color)f.skuImages[color]=picture}}
 return f
}

export function applySizeTemplate(form:FormData,template:SizeTemplate):FormData{
 const measurements=Object.fromEntries(splitLabels(form.sizes).map(size=>[size,structuredClone(template.measurements[size]??{})]))
 return updateForm(switchSizeKind(form,template.kind??'garment'),{sizeKind:template.kind??'garment',rangeFields:template.rangeFields??[],sizeFields:[...template.fields],measurements})
}

export function switchSizeKind(form:FormData,kind:SizeKind):FormData{
 const current=form.sizeKind??'garment'
 const sizeModes={...form.sizeModes,[current]:{fields:[...(form.sizeFields??['shoulder','chest'])],ranges:[...(form.rangeFields??[])]}}
 const selected=sizeModes[kind]??(kind==='garment'?{fields:['shoulder','chest'] as SizeField[],ranges:[] as SizeField[]}:{fields:['height','weight'] as SizeField[],ranges:['height','weight'] as SizeField[]})
 return updateForm(form,{sizeModes,sizeKind:kind,sizeFields:[...selected.fields],rangeFields:[...selected.ranges]})
}
export function applyProductTemplate(source:FormData,identity:{id:string;productCode:string}){
 const form=copyAsNewProduct(source,identity)
 try{form.rows=rebuildRows(form);return {form,warning:''}}catch(error){return {form,warning:`规格尚未完整，请修正后更新规格表：${error instanceof Error?error.message:'资料不完整'}`}}
}

export type FormIssue={field:string;message:string}
export function collectFormIssues(form:FormData,confirmations=false):FormIssue[]{
 const issues:FormIssue[]=[],check=(field:string,fn:()=>unknown)=>{try{fn()}catch(e){issues.push({field,message:e instanceof Error?e.message:'资料无效'})}}
 for(const [key,label] of [['productCode','商品货号'],['title','商品标题'],['brand','品牌']] as const)check(key,()=>text(form[key],label))
 for(const [key,label] of Object.entries(attributeLabels))check('attributes.'+key,()=>text(form.attributes[key],label))
 check('colors',()=>{const expected=rebuildRows(form);if(expected.length!==form.rows.length||expected.some(e=>form.rows.filter(r=>r.color===e.color&&r.size===e.size).length!==1))throw new Error('颜色尺码与规格表不一致，请更新规格表')})
 const codes=new Set<string>()
 for(const r of form.rows){const prefix=`规格 ${r.color}/${r.size}`,key=`row:${r.color}:${r.size}`
 check(key,()=>{if(!r.merchantSku||codes.has(r.merchantSku))throw new Error(`${prefix}编码缺失或重复，请更新规格表`);codes.add(r.merchantSku)})
 for(const [k,label] of [['groupPrice','拼单价'],['singlePrice','单买价']] as const)check(key,()=>money(r[k],`${prefix}${label}`))
 check(key,()=>{if(!/^\d+$/.test(r.stock)||!Number.isSafeInteger(Number(r.stock)))throw new Error(`${prefix}库存须为明确的非负整数`);if(!r.enabled&&Number(r.stock)!==0)throw new Error(`${prefix}已停用，库存须为0`)})
 if(Number(r.singlePrice)<Number(r.groupPrice))issues.push({field:key,message:`${prefix}单买价不能低于拼单价`})
 }
 if(!form.rows.some(r=>r.enabled))issues.push({field:'colors',message:'至少需要一个启用规格'})
 check('referencePrice',()=>{money(form.referencePrice,'参考价');if(form.rows.some(r=>Number(r.singlePrice)>=Number(form.referencePrice)))throw new Error('参考价须高于全部单买价')})
 if(!/^([5-8](\.\d)?|9(\.[0-9])?)$/.test(form.discount))issues.push({field:'discount',message:'满2件折扣须为5.0～9.9'})
 for(const role of ['main','detail'] as const){if(!form[role].length||form[role].length>10)issues.push({field:'images',message:`${role==='main'?'主图':'详情图'}需1～10张`});const paths=new Set<string>();for(const picture of form[role]){if(!picture.path)issues.push({field:'images',message:'有图片缺少本机文件，请重新选择'});else if(paths.has(picture.path))issues.push({field:'images',message:`${role==='main'?'主图':'详情图'}存在重复文件，请移除重复项`});paths.add(picture.path)}}
 for(const color of splitLabels(form.colors))if(!form.skuImages[color]?.path)issues.push({field:`skuImage:${color}`,message:`缺少${color}颜色规格图`})
 const fields=form.sizeFields??['shoulder','chest']
 check('measurements',()=>validateSizeSelection(form.sizeKind??'garment',fields,form.rangeFields??[]))
 if(validSizeFields(fields)){
 if(!fields.some(k=>sizeFields[k].platform))issues.push({field:'measurements',message:'尺码表至少选择一个支持自动填写的字段'})
 for(const size of splitLabels(form.sizes))for(const field of fields){try{parseSizeValue(form.measurements[size]?.[field],form.rangeFields?.includes(field)??false,`${size} ${sizeFields[field].label}（${sizeUnit(field)}）`)}catch(error){const e=error as Error&{bound?:'min'|'max'};issues.push({field:measurementField(size,field,e.bound??'value'),message:e.message})}}
 }
 if(!['24h_handover','48h_handover'].includes(form.shipping))issues.push({field:'shipping',message:'请选择当前支持的发货时效'})
 if(confirmations){if(!reuseConfirmed(form))issues.push({field:'confirmation',message:'请完成复用资料的三项确认'});if(!form.confirmed)issues.push({field:'confirmation',message:'请勾选商品资料确认'})}
 return issues
}
