import {getCategoryProfile,type CategoryProfile} from './category-profile'
import type {LocalAsset} from './local-assets'

export const LISTING_DRAFT_SCHEMA_VERSION='2.0'
export const LISTING_EXPORT_SCHEMA_VERSION='ecom-listing-draft/1.0'

export type DraftVariant={color:string;size:string;merchantSku:string;groupPrice:string;singlePrice:string;stock:string;enabled:boolean}
export type FootwearSizeSystem='eu'|'uk'|'general'|'custom'
export type FootwearSizeRow={size:string;footLengthMin:string;footLengthMax:string;footWidthMin:string;footWidthMax:string}
export type ListingServices={sevenDayReturns:boolean;authenticityPromise:boolean;goodsType:'ordinary';secondHand:false;customized:false;presale:false;groupSize:2;remoteAreaTemplate:string}
export type ListingDraft={
 schemaVersion:string;profileId:string;sample:boolean;productCode:string;title:string;brand:string;attributes:Record<string,string>
 colors:string;sizes:string;sizeSystem:FootwearSizeSystem;variants:DraftVariant[];referencePrice:string;discount:string
 sizeChartEnabled:boolean;sizeChartRange:boolean;sizeChartColumns:{footLength:boolean;footWidth:boolean};sizeChart:FootwearSizeRow[];syncSizeChartToDetail:boolean
 mainImages:LocalAsset[];auxiliaryImages:LocalAsset[];packageLabelImages:LocalAsset[];detailImages:LocalAsset[];colorImages:Record<string,LocalAsset>
 shippingPromise:'same_day_handover'|'24h_handover'|'48h_handover';services:ListingServices
}
export type DraftIssue={field:string;message:string;kind:'blocking'|'verification'}

type UnknownRecord=Record<string,unknown>
const isRecord=(value:unknown):value is UnknownRecord=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const stringValue=(value:unknown,fallback='')=>typeof value==='string'?value:fallback
const booleanValue=(value:unknown,fallback:boolean)=>typeof value==='boolean'?value:fallback
const unique=<T,>(items:T[])=>[...new Set(items)]
const assetIdPattern=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.(?:png|jpg)$/i

export const splitValues=(value:string)=>value.split(/[,，\n]/).map(item=>item.trim()).filter(Boolean)
const shortHash=(value:string)=>{let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.codePointAt(0)!,16777619);return (hash>>>0).toString(36).toUpperCase()}
const codePart=(value:string,fallback:string)=>value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'')||`${fallback}-${shortHash(value)}`
const variantKey=(color:string,size:string)=>`${color}\0${size}`
const defaultServices=():ListingServices=>({sevenDayReturns:true,authenticityPromise:false,goodsType:'ordinary',secondHand:false,customized:false,presale:false,groupSize:2,remoteAreaTemplate:'新疆西藏收费默认模板'})

function assetIdFromPath(path:string){const name=path.replaceAll('\\','/').split('/').at(-1)??'';return assetIdPattern.test(name)?name:undefined}
function normalizeAsset(value:unknown):LocalAsset|null{
 if(!isRecord(value))return null
 const name=stringValue(value.name).trim(),path=stringValue(value.path).trim(),givenId=stringValue(value.assetId).trim(),assetId=assetIdPattern.test(givenId)?givenId:assetIdFromPath(path)
 if(!name||(!path&&!assetId))return null
 return {name,path:path||assetId!,assetId,preview:assetId?`/api/live/assets/${assetId}`:stringValue(value.preview)||undefined,available:typeof value.available==='boolean'?value.available:undefined}
}
function normalizeAssets(value:unknown){return Array.isArray(value)?value.map(normalizeAsset).filter((item):item is LocalAsset=>Boolean(item)):[]}

export function createListingDraft(profile:CategoryProfile):ListingDraft{return {
 schemaVersion:LISTING_DRAFT_SCHEMA_VERSION,profileId:profile.id,sample:false,productCode:'',title:'',brand:'',
 attributes:Object.fromEntries(profile.attributeFields.map(field=>[field.key,''])),colors:profile.defaults.colors,sizes:profile.defaults.sizes,sizeSystem:'eu',variants:[],referencePrice:'',discount:'9.5',
 sizeChartEnabled:true,sizeChartRange:false,sizeChartColumns:{footLength:true,footWidth:false},sizeChart:[],syncSizeChartToDetail:false,
 mainImages:[],auxiliaryImages:[],packageLabelImages:[],detailImages:[],colorImages:{},shippingPromise:'48h_handover',services:defaultServices()
}}

export function normalizeListingDraft(value:unknown,profile:CategoryProfile):ListingDraft{
 const empty=createListingDraft(profile)
 if(!isRecord(value)||value.profileId!==profile.id)return empty
 const raw=value,rawAttributes=isRecord(raw.attributes)?raw.attributes:{},rawColumns=isRecord(raw.sizeChartColumns)?raw.sizeChartColumns:{},rawServices=isRecord(raw.services)?raw.services:{}
 const attributes=Object.fromEntries(profile.attributeFields.map(field=>[field.key,stringValue(rawAttributes[field.key])]))
 const variants=Array.isArray(raw.variants)?raw.variants.filter(isRecord).map(row=>({color:stringValue(row.color),size:stringValue(row.size),merchantSku:stringValue(row.merchantSku),groupPrice:stringValue(row.groupPrice),singlePrice:stringValue(row.singlePrice),stock:stringValue(row.stock),enabled:booleanValue(row.enabled,true)})):[]
 const sizeChart=Array.isArray(raw.sizeChart)?raw.sizeChart.filter(isRecord).map(row=>({size:stringValue(row.size),footLengthMin:stringValue(row.footLengthMin),footLengthMax:stringValue(row.footLengthMax),footWidthMin:stringValue(row.footWidthMin),footWidthMax:stringValue(row.footWidthMax)})).filter(row=>row.size):[]
 const colors=stringValue(raw.colors,empty.colors),rawColors=isRecord(raw.colorImages)?raw.colorImages:{},colorImages:Record<string,LocalAsset>={}
 for(const color of splitValues(colors)){const asset=normalizeAsset(rawColors[color]);if(asset)colorImages[color]=asset}
 const sizeSystem=['eu','uk','general','custom'].includes(stringValue(raw.sizeSystem))?stringValue(raw.sizeSystem) as FootwearSizeSystem:empty.sizeSystem
 const shippingPromise=['same_day_handover','24h_handover','48h_handover'].includes(stringValue(raw.shippingPromise))?stringValue(raw.shippingPromise) as ListingDraft['shippingPromise']:empty.shippingPromise
 return {...empty,schemaVersion:LISTING_DRAFT_SCHEMA_VERSION,sample:booleanValue(raw.sample,false),productCode:stringValue(raw.productCode),title:stringValue(raw.title),brand:stringValue(raw.brand),attributes,colors,sizes:stringValue(raw.sizes,empty.sizes),sizeSystem,variants,referencePrice:stringValue(raw.referencePrice),discount:stringValue(raw.discount,empty.discount),sizeChartEnabled:booleanValue(raw.sizeChartEnabled,empty.sizeChartEnabled),sizeChartRange:booleanValue(raw.sizeChartRange,empty.sizeChartRange),sizeChartColumns:{footLength:booleanValue(rawColumns.footLength,true),footWidth:booleanValue(rawColumns.footWidth,false)},sizeChart,syncSizeChartToDetail:booleanValue(raw.syncSizeChartToDetail,false),mainImages:normalizeAssets(raw.mainImages),auxiliaryImages:normalizeAssets(raw.auxiliaryImages),packageLabelImages:normalizeAssets(raw.packageLabelImages),detailImages:normalizeAssets(raw.detailImages),colorImages,shippingPromise,services:{...empty.services,sevenDayReturns:booleanValue(rawServices.sevenDayReturns,true),authenticityPromise:booleanValue(rawServices.authenticityPromise,false),remoteAreaTemplate:stringValue(rawServices.remoteAreaTemplate,empty.services.remoteAreaTemplate)}}
}

export function buildFootwearSizeChart(draft:ListingDraft):FootwearSizeRow[]{return splitValues(draft.sizes).map(size=>draft.sizeChart.find(row=>row.size===size)??{size,footLengthMin:'',footLengthMax:'',footWidthMin:'',footWidthMax:''})}

export function buildVariantMatrix(draft:ListingDraft):DraftVariant[]{
 const colors=splitValues(draft.colors),sizes=splitValues(draft.sizes)
 if(!colors.length||!sizes.length)throw new Error('请先填写颜色和鞋码')
 if(unique(colors).length!==colors.length||unique(sizes).length!==sizes.length)throw new Error('颜色或鞋码存在重复')
 if(colors.length*sizes.length>500)throw new Error('一次最多生成 500 个规格组合，请拆分商品')
 return colors.flatMap((color,colorIndex)=>sizes.map(size=>draft.variants.find(row=>row.color===color&&row.size===size)??{color,size,merchantSku:`${codePart(draft.productCode,'ITEM')}-C${String(colorIndex+1).padStart(2,'0')}-${codePart(size,'SIZE')}`,groupPrice:'',singlePrice:'',stock:'',enabled:true}))
}
export function regenerateVariantSkus(draft:ListingDraft,productCode=draft.productCode):DraftVariant[]{const colors=unique([...splitValues(draft.colors),...draft.variants.map(row=>row.color)]);return draft.variants.map(row=>({...row,merchantSku:`${codePart(productCode,'ITEM')}-C${String(colors.indexOf(row.color)+1).padStart(2,'0')}-${codePart(row.size,'SIZE')}`}))}

const money=(value:string)=>/^\d+(\.\d{1,2})?$/.test(value)&&Number(value)>0
const positiveMeasurement=(value:string)=>/^\d+(\.\d)?$/.test(value)&&Number(value)>0&&Number(value)<=1000
const readyAsset=(asset:LocalAsset|undefined)=>Boolean(asset&&(asset.assetId||assetIdFromPath(asset.path))&&asset.available!==false)
const containsExample=(value:string)=>/(^|[：:\s])示例|自动化测试|勿上架/.test(value)

export function validateListingDraft(draft:ListingDraft):DraftIssue[]{
 const profile=getCategoryProfile(draft.profileId),issues:DraftIssue[]=[],seenIssues=new Set<string>()
 const add=(kind:DraftIssue['kind'],field:string,message:string)=>{const key=`${kind}\0${field}\0${message}`;if(!seenIssues.has(key)){seenIssues.add(key);issues.push({field,message,kind})}},block=(field:string,message:string)=>add('blocking',field,message)
 if(draft.sample)block('sample','当前仍是完整演示资料；请替换为真实商品资料后，再点击“示例资料已全部替换”')
 if(!draft.productCode.trim())block('productCode','请填写商品货号（款式编号）')
 if(!draft.title.trim())block('title','请填写商品标题');else if(Array.from(draft.title).length>60)block('title','商品标题最多 60 个字符')
 if(!draft.brand.trim())block('brand','请填写品牌或平台对应的无品牌选项')
 if([draft.title,draft.brand,...Object.values(draft.attributes)].some(containsExample))block('sample','资料中仍含“示例/自动化测试/勿上架”内容，请全部替换')
 for(const field of profile.attributeFields){const value=draft.attributes[field.key]?.trim();if(field.required&&!value)block(`attributes.${field.key}`,`请填写${field.label}`);if(field.evidence==='unverified'&&value)add('verification',`attributes.${field.key}`,`${field.label}的平台选项仍需真实页面核对`)}
 let expected:DraftVariant[]=[];try{expected=buildVariantMatrix(draft)}catch(error){block('variants',(error as Error).message)}
 const expectedKeys=expected.map(row=>variantKey(row.color,row.size)),actualKeys=draft.variants.map(row=>variantKey(row.color,row.size))
 if(expectedKeys.length!==actualKeys.length||expectedKeys.some((key,index)=>key!==actualKeys[index])||unique(actualKeys).length!==actualKeys.length)block('variants','颜色或鞋码已修改，规格组合缺失、重复或顺序不一致，请重新生成规格矩阵')
 if(!draft.variants.some(row=>row.enabled))block('variants','至少保留一个启用规格')
 const codes=new Set<string>()
 for(const row of draft.variants){
  if(!row.merchantSku.trim()||codes.has(row.merchantSku))block('variants',`${row.color}/${row.size} 的规格编码为空或重复`);codes.add(row.merchantSku)
  if(!money(row.groupPrice))block('variants',`${row.color}/${row.size} 的拼单价无效`)
  if(!money(row.singlePrice)||Number(row.singlePrice)<Number(row.groupPrice))block('variants',`${row.color}/${row.size} 的单买价无效`)
  if(!/^\d+$/.test(row.stock)||!Number.isSafeInteger(Number(row.stock)))block('variants',`${row.color}/${row.size} 的库存必须是非负整数`)
  if(!row.enabled&&row.stock!=='0')block('variants',`${row.color}/${row.size} 已停用，库存应设为 0`)
 }
 const maxSingle=Math.max(0,...draft.variants.filter(row=>row.enabled).map(row=>Number(row.singlePrice)||0))
 if(!money(draft.referencePrice)||Number(draft.referencePrice)<=maxSingle)block('referencePrice','商品参考价必须高于全部启用规格的单买价')
 if(!/^\d(\.\d)?$/.test(draft.discount)||Number(draft.discount)<5||Number(draft.discount)>9.9)block('discount','满 2 件折扣需填写 5.0 至 9.9')
 if(draft.sizeChartEnabled){
  const expectedSizes=splitValues(draft.sizes),actualSizes=draft.sizeChart.map(row=>row.size)
  if(expectedSizes.length!==actualSizes.length||expectedSizes.some((size,index)=>size!==actualSizes[index])||unique(actualSizes).length!==actualSizes.length)block('sizeChart','鞋码已修改，尺码表行缺失、重复或顺序不一致，请更新尺码表')
  if(!draft.sizeChartColumns.footLength&&!draft.sizeChartColumns.footWidth)block('sizeChart','尺码表至少选择脚长或脚宽一列')
  for(const row of draft.sizeChart)for(const key of ['footLength','footWidth'] as const){const label=key==='footLength'?'脚长':'脚宽';if(!draft.sizeChartColumns[key])continue;const min=row[`${key}Min`],max=row[`${key}Max`];if(!positiveMeasurement(min))block('sizeChart',`${row.size} 的${label}需填写不超过 1000、最多一位小数的正数`);if(draft.sizeChartRange&&(!positiveMeasurement(max)||Number(max)<Number(min)))block('sizeChart',`${row.size} 的${label}上限不得小于下限`)}
 }
 const imageGroups=[['mainImages',draft.mainImages,10,'主图'],['auxiliaryImages',draft.auxiliaryImages,10,'商品辅助图'],['packageLabelImages',draft.packageLabelImages,10,'包装标签图'],['detailImages',draft.detailImages,50,'详情图']] as const
 if(!draft.mainImages.length)block('mainImages','至少选择一张主图')
 for(const [field,images,limit,label] of imageGroups){if(images.length>limit)block(field,`${label}最多 ${limit} 张`);if(images.some(image=>!readyAsset(image)))block(field,`${label}中有本机文件已经失效，请重新选择`)}
 for(const color of splitValues(draft.colors))if(!readyAsset(draft.colorImages[color]))block('colorImages',`缺少${color}的规格图`)
 return issues
}

function portableAsset(asset:LocalAsset){const assetId=asset.assetId||assetIdFromPath(asset.path);return {name:asset.name,assetId:assetId||null,localReference:assetId?`assets/${assetId}`:null}}
export function compileListingDraft(draft:ListingDraft){
 const profile=getCategoryProfile(draft.profileId),issues=validateListingDraft(draft),blocking=issues.filter(item=>item.kind==='blocking')
 if(blocking.length)throw new Error(`商品草稿仍有 ${blocking.length} 个需修改项，不能导出`)
 return {$schema:'./schemas/listing-draft-export.schema.json',schemaVersion:LISTING_EXPORT_SCHEMA_VERSION,profile:{id:profile.id,categoryKey:profile.categoryKey,categoryPath:profile.categoryPath,status:profile.status},product:{productCode:draft.productCode,title:draft.title,brand:draft.brand,attributes:draft.attributes},variants:draft.variants,sizeConfiguration:{system:draft.sizeSystem,chartEnabled:draft.sizeChartEnabled,range:draft.sizeChartRange,columns:draft.sizeChartColumns,rows:draft.sizeChart,syncToDetail:draft.syncSizeChartToDetail},assets:{main:draft.mainImages.map(portableAsset),auxiliary:draft.auxiliaryImages.map(portableAsset),packageLabels:draft.packageLabelImages.map(portableAsset),detail:draft.detailImages.map(portableAsset),byColor:Object.fromEntries(Object.entries(draft.colorImages).map(([color,asset])=>[color,portableAsset(asset)]))},listing:{platform:profile.platform,pricing:{referencePrice:draft.referencePrice,multiItemDiscount:{count:2,discount:draft.discount}},inventoryDeduction:'payment_success',shippingPromise:draft.shippingPromise,services:draft.services},validation:{blocking:[],verification:issues.filter(item=>item.kind==='verification')},execution:{enabled:false,reason:'类目字段与控件尚未完成真实页面写入和回读验证'}}
}

function importedAsset(value:unknown):LocalAsset|null{if(!isRecord(value))return null;const assetId=stringValue(value.assetId).trim(),localReference=stringValue(value.localReference).trim(),name=stringValue(value.name).trim(),inferred=assetIdPattern.test(assetId)?assetId:localReference.replace(/^assets\//,'');return name&&assetIdPattern.test(inferred)?{name,assetId:inferred,path:inferred,preview:`/api/live/assets/${inferred}`,available:undefined}:null}

export function setAssetAvailability(draft:ListingDraft,availableIds:string[]):ListingDraft{
 const available=new Set(availableIds),mark=(asset:LocalAsset)=>asset.assetId?{...asset,available:available.has(asset.assetId)}:asset
 return {...draft,mainImages:draft.mainImages.map(mark),auxiliaryImages:draft.auxiliaryImages.map(mark),packageLabelImages:draft.packageLabelImages.map(mark),detailImages:draft.detailImages.map(mark),colorImages:Object.fromEntries(Object.entries(draft.colorImages).map(([color,asset])=>[color,mark(asset)]))}
}

export function listingAssetIds(draft:ListingDraft){return unique([...draft.mainImages,...draft.auxiliaryImages,...draft.packageLabelImages,...draft.detailImages,...Object.values(draft.colorImages)].map(asset=>asset.assetId).filter((id):id is string=>Boolean(id)))}
export function importCompiledListingDraft(value:unknown,profile:CategoryProfile):ListingDraft{
 if(isRecord(value)&&value.profileId===profile.id)return normalizeListingDraft(value,profile)
 if(!isRecord(value)||value.schemaVersion!==LISTING_EXPORT_SCHEMA_VERSION||!isRecord(value.profile)||value.profile.id!==profile.id)throw new Error('请选择当前类目导出的商品草稿 JSON')
 const product=isRecord(value.product)?value.product:{},size=isRecord(value.sizeConfiguration)?value.sizeConfiguration:{},assets=isRecord(value.assets)?value.assets:{},listing=isRecord(value.listing)?value.listing:{},pricing=isRecord(listing.pricing)?listing.pricing:{},discount=isRecord(pricing.multiItemDiscount)?pricing.multiItemDiscount:{},services=isRecord(listing.services)?listing.services:{}
 const rawColorImages=isRecord(assets.byColor)?assets.byColor:{},colorImages:Record<string,LocalAsset>={}
 for(const [color,assetValue] of Object.entries(rawColorImages)){const asset=importedAsset(assetValue);if(asset)colorImages[color]=asset}
 const variants=Array.isArray(value.variants)?value.variants:[],raw:UnknownRecord={schemaVersion:LISTING_DRAFT_SCHEMA_VERSION,profileId:profile.id,sample:false,productCode:product.productCode,title:product.title,brand:product.brand,attributes:product.attributes,colors:unique(variants.filter(isRecord).map(row=>stringValue(row.color)).filter(Boolean)).join(','),sizes:unique(variants.filter(isRecord).map(row=>stringValue(row.size)).filter(Boolean)).join(','),variants,sizeSystem:size.system,sizeChartEnabled:size.chartEnabled,sizeChartRange:size.range,sizeChartColumns:size.columns,sizeChart:size.rows,syncSizeChartToDetail:size.syncToDetail,referencePrice:pricing.referencePrice,discount:discount.discount,shippingPromise:listing.shippingPromise,services,mainImages:(Array.isArray(assets.main)?assets.main:[]).map(importedAsset).filter(Boolean),auxiliaryImages:(Array.isArray(assets.auxiliary)?assets.auxiliary:[]).map(importedAsset).filter(Boolean),packageLabelImages:(Array.isArray(assets.packageLabels)?assets.packageLabels:[]).map(importedAsset).filter(Boolean),detailImages:(Array.isArray(assets.detail)?assets.detail:[]).map(importedAsset).filter(Boolean),colorImages}
 return normalizeListingDraft(raw,profile)
}

export function createStarterDraft(profile:CategoryProfile,identity:{productCode:string},assets:{main:LocalAsset[];detail:LocalAsset[];sku:LocalAsset}):ListingDraft{
 const draft=createListingDraft(profile);draft.sample=true;draft.productCode=identity.productCode;draft.title='示例：低帮系带休闲板鞋';draft.brand='无品牌'
 for(const field of profile.attributeFields)draft.attributes[field.key]=`示例${field.label}`
 draft.variants=buildVariantMatrix(draft).map(row=>({...row,groupPrice:'99',singlePrice:'109',stock:'10'}));draft.referencePrice='139';draft.discount='9.5';draft.sizeChart=buildFootwearSizeChart(draft).map((row,index)=>({...row,footLengthMin:String(165+index*7)}));draft.mainImages=assets.main;draft.auxiliaryImages=assets.main;draft.packageLabelImages=assets.detail;draft.detailImages=assets.detail;draft.colorImages=Object.fromEntries(splitValues(draft.colors).map(color=>[color,assets.sku]));return draft
}
